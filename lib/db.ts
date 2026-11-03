import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mongoose, { type Connection } from "mongoose";
import { decrypt, encrypt, maskUri, uriHost } from "./crypto";
import { bindModels, SYNC_COLLECTIONS, type Models } from "./models";

/**
 * Multi-URI connection manager with automatic failover.
 *
 * Sources of connection strings:
 *  - Environment: MONGODB_URI (+ MONGODB_URI_BACKUP_1..3)  -> read-only, shown in the UI
 *  - Managed: added by the Super Admin (or first-run setup). Stored AES-256-GCM encrypted
 *    in .data/connections.json and mirrored into the database ("SystemConfig") so a fresh
 *    server that can reach any one database can recover the list.
 *
 * Order of use: the Super Admin's chosen "active" connection first, then the rest by priority.
 * If the running connection fails, the next healthy one is used. The preferred one is retried
 * every 60 seconds so traffic fails back automatically.
 */

export type StoredConn = {
  id: string;
  label: string;
  uriEnc: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
};
type StoreFile = { activeId: string | null; items: StoredConn[] };
export type ResolvedConn = {
  id: string;
  label: string;
  uri: string;
  priority: number;
  enabled: boolean;
  source: "env" | "managed";
};
export type Health = { ok: boolean; checkedAt: string; latencyMs?: number; error?: string };

type Cache = {
  conn?: Connection;
  runningId?: string;
  models?: Models;
  store?: StoreFile;
  health: Record<string, Health>;
  lastPreferredRetry: number;
  connecting?: Promise<{ conn: Connection; id: string }>;
  failoverNote?: string;
  hydrated?: boolean;
  lastFailAt?: number;
  lastFailDetail?: string;
};

const g = globalThis as unknown as { __yayaDb?: Cache };
const cache: Cache = (g.__yayaDb ??= { health: {}, lastPreferredRetry: 0 });

export class NoDatabaseError extends Error {
  constructor() {
    super("No database is configured yet.");
    this.name = "NoDatabaseError";
  }
}
export class AllDatabasesFailedError extends Error {
  constructor(public details: string) {
    super("Could not reach any configured database. " + details);
    this.name = "AllDatabasesFailedError";
  }
}

const STORE_PATH = path.join(process.cwd(), ".data", "connections.json");

function readStore(): StoreFile {
  if (cache.store) return cache.store;
  try {
    cache.store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as StoreFile;
  } catch {
    cache.store = { activeId: null, items: [] };
  }
  return cache.store;
}

function writeStoreFile() {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(cache.store, null, 2), { mode: 0o600 });
  } catch {
    /* read-only filesystem (e.g. serverless): the database mirror is used instead */
  }
}

function envConnections(): ResolvedConn[] {
  const out: ResolvedConn[] = [];
  const push = (id: string, label: string, uri: string | undefined, priority: number) => {
    if (uri && uri.trim()) out.push({ id, label, uri: uri.trim(), priority, enabled: true, source: "env" });
  };
  push("env-primary", "Environment primary", process.env.MONGODB_URI, 0);
  for (let i = 1; i <= 3; i++) push(`env-backup-${i}`, `Environment backup ${i}`, process.env[`MONGODB_URI_BACKUP_${i}`], 100 + i);
  return out;
}

export function listConnections(): ResolvedConn[] {
  const managed: ResolvedConn[] = [];
  for (const c of readStore().items) {
    try {
      managed.push({ id: c.id, label: c.label, uri: decrypt(c.uriEnc), priority: c.priority, enabled: c.enabled, source: "managed" });
    } catch {
      /* secret changed: cannot decrypt, skip */
    }
  }
  return [...envConnections(), ...managed];
}

function orderedCandidates(): ResolvedConn[] {
  const all = listConnections().filter((c) => c.enabled);
  const activeId = readStore().activeId;
  return all.sort((a, b) => {
    if (a.id === activeId) return -1;
    if (b.id === activeId) return 1;
    return a.priority - b.priority;
  });
}

function setHealth(id: string, h: Omit<Health, "checkedAt">) {
  cache.health[id] = { ...h, checkedAt: new Date().toISOString() };
}

async function open(uri: string): Promise<Connection> {
  const conn = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    maxPoolSize: 10,
  });
  await conn.asPromise();
  return conn;
}

/** Test a URI without saving it. */
export async function testUri(uri: string): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  if (!/^mongodb(\+srv)?:\/\//.test(uri.trim())) {
    return { ok: false, error: "Connection string must start with mongodb:// or mongodb+srv://" };
  }
  const started = Date.now();
  let conn: Connection | undefined;
  try {
    conn = await open(uri.trim());
    await conn.db!.admin().ping();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e: any) {
    return { ok: false, error: friendlyError(e) };
  } finally {
    await conn?.close().catch(() => {});
  }
}

function friendlyError(e: any): string {
  const m = String(e?.message || e);
  if (/bad auth|Authentication failed/i.test(m)) return "Authentication failed: check the username and password.";
  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(m)) return "Host not found: check the cluster address.";
  if (/ETIMEDOUT|timed out|ServerSelection|ECONNREFUSED/i.test(m))
    return "Could not reach the server. In MongoDB Atlas, add this server's IP to Network Access (or allow 0.0.0.0/0).";
  return m.slice(0, 200);
}

async function connectFirstHealthy(): Promise<{ conn: Connection; id: string }> {
  const candidates = orderedCandidates();
  if (candidates.length === 0) throw new NoDatabaseError();
  const errors: string[] = [];
  for (const c of candidates) {
    const started = Date.now();
    try {
      const conn = await open(c.uri);
      setHealth(c.id, { ok: true, latencyMs: Date.now() - started });
      if (c !== candidates[0]) {
        cache.failoverNote = `Primary unavailable. Running on "${c.label}".`;
      } else {
        cache.failoverNote = undefined;
      }
      return { conn, id: c.id };
    } catch (e: any) {
      const msg = friendlyError(e);
      setHealth(c.id, { ok: false, error: msg });
      errors.push(`${c.label}: ${msg}`);
    }
  }
  throw new AllDatabasesFailedError(errors.join(" | "));
}

/** Returns models bound to the healthy connection, failing over when needed. */
export async function getDb(): Promise<Models> {
  const healthy = cache.conn && cache.conn.readyState === 1;

  if (healthy) {
    // Fail back to the preferred connection when we're running on a backup.
    const preferred = orderedCandidates()[0];
    if (preferred && preferred.id !== cache.runningId && Date.now() - cache.lastPreferredRetry > 60_000) {
      cache.lastPreferredRetry = Date.now();
      try {
        const conn = await open(preferred.uri);
        const old = cache.conn;
        cache.conn = conn;
        cache.runningId = preferred.id;
        cache.models = bindModels(conn);
        cache.failoverNote = undefined;
        setHealth(preferred.id, { ok: true });
        old?.close().catch(() => {});
      } catch (e: any) {
        setHealth(preferred.id, { ok: false, error: friendlyError(e) });
      }
    }
    return cache.models!;
  }

  // Avoid hammering dead databases: after a total failure, fail fast for 8 seconds.
  if (cache.lastFailAt && Date.now() - cache.lastFailAt < 8000 && !cache.connecting) {
    throw new AllDatabasesFailedError(cache.lastFailDetail || "");
  }
  if (cache.conn) {
    cache.conn.close().catch(() => {});
    cache.conn = undefined;
  }
  if (!cache.connecting) {
    cache.connecting = connectFirstHealthy().finally(() => {
      cache.connecting = undefined;
    });
  }
  let result: { conn: Connection; id: string };
  try {
    result = await cache.connecting;
    cache.lastFailAt = undefined;
  } catch (e) {
    if (e instanceof AllDatabasesFailedError) {
      cache.lastFailAt = Date.now();
      cache.lastFailDetail = e.details;
    }
    throw e;
  }
  const { conn, id } = result;
  cache.conn = conn;
  cache.runningId = id;
  cache.models = bindModels(conn);
  await hydrateFromDb(cache.models);
  return cache.models;
}

/** Force a reconnect (after the Super Admin changes the list). */
export async function resetConnection() {
  const old = cache.conn;
  cache.conn = undefined;
  cache.models = undefined;
  cache.runningId = undefined;
  cache.lastPreferredRetry = 0;
  cache.lastFailAt = undefined;
  await old?.close().catch(() => {});
}

export function isDatabaseConfigured(): boolean {
  return listConnections().some((c) => c.enabled);
}

/* ---------- Managed connection CRUD (Super Admin) ---------- */

async function mirrorToDb() {
  if (!cache.models) return;
  try {
    await cache.models.SystemConfig.updateOne({ key: "connections" }, { $set: { value: readStore() } }, { upsert: true });
  } catch {
    /* ignore */
  }
}

async function hydrateFromDb(models: Models) {
  if (cache.hydrated) return;
  cache.hydrated = true;
  const store = readStore();
  if (store.items.length > 0) {
    await mirrorToDb();
    return;
  }
  try {
    const doc = await models.SystemConfig.findOne({ key: "connections" }).lean<any>();
    if (doc?.value?.items?.length) {
      cache.store = doc.value as StoreFile;
      writeStoreFile();
    }
  } catch {
    /* ignore */
  }
}

export async function addConnection(input: { label: string; uri: string; priority?: number; makeActive?: boolean }) {
  const uri = input.uri.trim();
  const dupe = listConnections().find((c) => c.uri === uri);
  if (dupe) throw new Error(`This connection string is already saved as "${dupe.label}".`);
  const store = readStore();
  const item: StoredConn = {
    id: crypto.randomUUID(),
    label: input.label.trim() || uriHost(uri),
    uriEnc: encrypt(uri),
    priority: input.priority ?? 10 + store.items.length,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  store.items.push(item);
  if (input.makeActive || (!store.activeId && listConnections().length === 1)) store.activeId = item.id;
  writeStoreFile();
  await mirrorToDb();
  return item.id;
}

export async function updateConnection(id: string, patch: { label?: string; priority?: number; enabled?: boolean }) {
  const store = readStore();
  const item = store.items.find((i) => i.id === id);
  if (!item) throw new Error("Only connections added in the app can be edited. Environment connections are read-only.");
  if (patch.label !== undefined) item.label = patch.label.trim() || item.label;
  if (patch.priority !== undefined) item.priority = patch.priority;
  if (patch.enabled !== undefined) item.enabled = patch.enabled;
  writeStoreFile();
  await mirrorToDb();
}

export async function removeConnection(id: string) {
  const store = readStore();
  if (!store.items.some((i) => i.id === id)) throw new Error("Environment connections can only be removed from your hosting settings.");
  if (listConnections().filter((c) => c.enabled).length <= 1) throw new Error("You can't remove the only connection.");
  if (cache.runningId === id) throw new Error("This is the connection currently in use. Make another one active first.");
  store.items = store.items.filter((i) => i.id !== id);
  if (store.activeId === id) store.activeId = null;
  writeStoreFile();
  await mirrorToDb();
}

export async function setActiveConnection(id: string) {
  const target = listConnections().find((c) => c.id === id);
  if (!target) throw new Error("Connection not found.");
  const test = await testUri(target.uri);
  if (!test.ok) throw new Error(`Can't switch: ${test.error}`);
  const store = readStore();
  store.activeId = id;
  writeStoreFile();
  const hadModels = !!cache.models;
  await resetConnection();
  if (hadModels) {
    await getDb();
    await mirrorToDb();
  }
}

export type ConnectionView = {
  id: string;
  label: string;
  host: string;
  masked: string;
  source: "env" | "managed";
  priority: number;
  enabled: boolean;
  isActive: boolean;
  isRunning: boolean;
  health?: Health;
};

export function connectionViews(): ConnectionView[] {
  const activeId = readStore().activeId;
  const candidates = orderedCandidates();
  const preferredId = activeId && candidates.find((c) => c.id === activeId) ? activeId : candidates[0]?.id;
  return listConnections()
    .sort((a, b) => a.priority - b.priority)
    .map((c) => ({
      id: c.id,
      label: c.label,
      host: uriHost(c.uri),
      masked: maskUri(c.uri),
      source: c.source,
      priority: c.priority,
      enabled: c.enabled,
      isActive: c.id === preferredId,
      isRunning: c.id === cache.runningId,
      health: cache.health[c.id],
    }));
}

export function failoverNote() {
  return cache.failoverNote;
}

export async function refreshHealth(): Promise<void> {
  await Promise.all(
    listConnections().map(async (c) => {
      const r = await testUri(c.uri);
      setHealth(c.id, { ok: r.ok, latencyMs: r.latencyMs, error: r.error });
    }),
  );
}

/**
 * Copy all data from the running database into another saved connection (upsert by _id).
 * Additive: nothing on the target is deleted. Run it regularly so backups are ready for failover.
 */
export async function syncToConnection(targetId: string): Promise<Record<string, number>> {
  const target = listConnections().find((c) => c.id === targetId);
  if (!target) throw new Error("Connection not found.");
  if (targetId === cache.runningId) throw new Error("That's the database currently in use. Pick a backup.");
  const source = await getDb();
  const conn = await open(target.uri);
  const dest = bindModels(conn);
  const counts: Record<string, number> = {};
  try {
    for (const name of SYNC_COLLECTIONS) {
      let n = 0;
      let batch: any[] = [];
      const flush = async () => {
        if (!batch.length) return;
        await dest[name].collection.bulkWrite(
          batch.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })),
          { ordered: false },
        );
        n += batch.length;
        batch = [];
      };
      for await (const doc of source[name].find().lean().cursor()) {
        batch.push(doc);
        if (batch.length >= 200) await flush();
      }
      await flush();
      counts[name] = n;
    }
  } finally {
    await conn.close().catch(() => {});
  }
  return counts;
}
