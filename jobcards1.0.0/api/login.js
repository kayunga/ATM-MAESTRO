import { query } from "../server/db.js";
import { verifyPassword, startSession, methodNot } from "../server/auth.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNot(res, "POST");
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const { rows } = await query("SELECT * FROM users WHERE lower(email) = lower($1)", [String(email).trim()]);
    const u = rows[0];
    if (u?.locked_until && new Date(u.locked_until) > new Date()) return res.status(429).json({ error: "Too many failed attempts. Try again in 15 minutes." });
    const ok = u && u.active && (await verifyPassword(password, u.password_hash));
    if (!ok) {
      if (u) await query("UPDATE users SET failed_logins = failed_logins + 1, locked_until = CASE WHEN failed_logins + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END WHERE id=$1", [u.id]);
      return res.status(401).json({ error: "Invalid email or password" }); // same message for unknown/inactive/wrong password
    }
    await query("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id=$1", [u.id]);
    await startSession(res, u.id);
    res.json({ id: u.id, name: u.name, email: u.email, admin: u.role === "admin", mustChange: u.must_change_password });
  } catch (e) { console.error(e); res.status(500).json({ error: "Login failed" }); }
}
