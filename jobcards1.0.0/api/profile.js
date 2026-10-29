import { query } from "../server/db.js";
import { requireUser, methodNot, verifyPassword, hashPassword } from "../server/auth.js";
import { audit } from "../server/audit.js";
// Signed-in user's own password change. (Signatures are managed by admins.)
export default async function handler(req, res) {
  if (req.method !== "PUT") return methodNot(res, "PUT");
  const user = await requireUser(req, res, { allowMustChange: true }); if (!user) return;
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (String(newPassword || "").length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
    const { rows } = await query("SELECT password_hash FROM users WHERE id=$1", [user.id]);
    if (!(await verifyPassword(String(currentPassword || ""), rows[0].password_hash))) return res.status(400).json({ error: "Current password is incorrect" });
    if (currentPassword === newPassword) return res.status(400).json({ error: "Choose a different password" });
    await query("UPDATE users SET password_hash=$1, must_change_password=false, updated_at=now() WHERE id=$2", [await hashPassword(newPassword), user.id]);
    audit(user.id, "password_changed", "user", user.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "Could not save" }); }
}
