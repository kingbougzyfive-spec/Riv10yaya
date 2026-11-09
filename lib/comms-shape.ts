import { z } from "zod";
import { AUDIENCE_TYPES } from "./audience";

export const shapeLog = (l: any) => ({ id: String(l._id), at: l.createdAt, origin: l.origin, event: l.event, category: l.category, title: l.title, audience: l.audience, channels: l.channels, sentByName: l.sentByName, totals: l.totals, status: l.status, failures: (l.failures ?? []).filter((f: any) => !f.retried).length });

export const audienceSchema = z.object({ type: z.enum(AUDIENCE_TYPES), ids: z.array(z.string()).max(200).optional(), eventId: z.string().optional() });
