import { z } from "zod";
import { handle, audit } from "@/lib/api";
import { ApiError, requireApiUser } from "@/lib/auth";
import {
  addConnection, connectionViews, failoverNote, getDb, refreshHealth, removeConnection,
  setActiveConnection, syncToConnection, testUri, updateConnection,
} from "@/lib/db";
import { PERMS } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handle(async (req) => {
  await requireApiUser(PERMS.database);
  await getDb().catch(() => {});
  if (new URL(req.url).searchParams.get("refresh")) await refreshHealth();
  return { connections: connectionViews(), note: failoverNote() ?? null };
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("test"), uri: z.string().min(10).max(600) }),
  z.object({ action: z.literal("add"), label: z.string().max(60).default(""), uri: z.string().min(10).max(600), priority: z.number().int().min(1).max(99).optional(), makeActive: z.boolean().optional() }),
  z.object({ action: z.literal("activate"), id: z.string() }),
  z.object({ action: z.literal("update"), id: z.string(), label: z.string().max(60).optional(), priority: z.number().int().min(1).max(99).optional(), enabled: z.boolean().optional() }),
  z.object({ action: z.literal("remove"), id: z.string() }),
  z.object({ action: z.literal("sync"), id: z.string() }),
]);

export const POST = handle(async (req) => {
  const user = await requireApiUser(PERMS.database);
  const i = schema.parse(await req.json());
  switch (i.action) {
    case "test":
      return testUri(i.uri);
    case "add": {
      const t = await testUri(i.uri);
      if (!t.ok) throw new ApiError(400, t.error || "Could not connect with that string.");
      const id = await addConnection({ label: i.label, uri: i.uri, priority: i.priority, makeActive: i.makeActive });
      if (i.makeActive) await setActiveConnection(id);
      await audit(user, "database.add", i.label || "connection", { makeActive: !!i.makeActive }, req);
      return { ok: true, id };
    }
    case "activate":
      await setActiveConnection(i.id);
      await audit(user, "database.activate", i.id, undefined, req);
      return { ok: true };
    case "update":
      await updateConnection(i.id, i);
      await audit(user, "database.update", i.id, undefined, req);
      return { ok: true };
    case "remove":
      await removeConnection(i.id);
      await audit(user, "database.remove", i.id, undefined, req);
      return { ok: true };
    case "sync": {
      const counts = await syncToConnection(i.id);
      await audit(user, "database.sync", i.id, counts, req);
      return { ok: true, counts };
    }
  }
});
