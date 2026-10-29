import { query } from "./db.js";
export const audit = (userId, action, entity, entityId, detail) =>
  query("INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES ($1,$2,$3,$4,$5)",
    [userId, action, entity, String(entityId ?? ""), detail ?? null]).catch((e) => console.error("audit failed", e.message));
