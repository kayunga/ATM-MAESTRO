import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { query } from "./db.js";
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || "");
const COOKIE = "jc_session";
const MAX_AGE = 60 * 60 * 12; // 12h

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export async function startSession(res, userId) {
  if ((process.env.SESSION_SECRET || "").length < 32) throw new Error("SESSION_SECRET must be 32+ chars");
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(String(userId))
    .setExpirationTime(`${MAX_AGE}s`).sign(key());
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`);
}
export function endSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}
// The token only identifies the user; role/active are read from the DB on every request,
// so deactivating a user or changing a role takes effect immediately.
export async function getUser(req) {
  const m = /(?:^|;\s*)jc_session=([^;]+)/.exec(req.headers.cookie || "");
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], key());
    const { rows } = await query("SELECT id, name, email, role, active, must_change_password FROM users WHERE id=$1", [Number(payload.sub)]);
    const u = rows[0];
    if (!u || !u.active) return null;
    return { id: u.id, name: u.name, email: u.email, admin: u.role === "admin", mustChange: u.must_change_password };
  } catch { return null; }
}
/** Returns user, or sends 401/403 and returns null. */
export async function requireUser(req, res, { admin = false, allowMustChange = false } = {}) {
  const u = await getUser(req);
  if (!u) { res.status(401).json({ error: "Not signed in" }); return null; }
  if (u.mustChange && !allowMustChange) { res.status(403).json({ error: "Password change required", code: "MUST_CHANGE_PASSWORD" }); return null; }
  if (admin && !u.admin) { res.status(403).json({ error: "Admin only" }); return null; }
  return u;
}
export const methodNot = (res, allowed) => { res.setHeader("Allow", allowed); res.status(405).json({ error: "Method not allowed" }); };
