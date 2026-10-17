import "server-only";
import { db, type Queryable } from "../db";

/** Records a sensitive admin action. Never put secrets, passwords or full payment data in metadata. */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
  q: Queryable = db(),
  ip: string | null = null,
) {
  await q`insert into audit_logs (actor_id, action, entity, entity_id, metadata, ip)
          values (${actorId}, ${action}, ${entity}, ${entityId}, ${q.json(metadata as never)}, ${ip})`;
}
