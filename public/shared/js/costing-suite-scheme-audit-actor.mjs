/**
 * Non-identifying display token for an audit actor.
 * No directory lookup or additional personal-data fetch is performed.
 * The server audit view exposes actor_user_id (uuid), not an actor display name.
 */
export function formatSchemeMasterAuditActor(row) {
  if (!row || typeof row !== "object") return "--";
  for (const key of ["actor", "event_actor", "created_by"]) {
    const label = row[key];
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  const value = row.actor_user_id;
  if (typeof value !== "string") return "--";
  const uuid = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return "--";
  }
  return `Actor ID ${uuid.slice(0, 8)}…${uuid.slice(-4)}`;
}
