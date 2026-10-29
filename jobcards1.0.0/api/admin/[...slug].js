// All admin operations in ONE serverless function (Vercel plans cap the function count).
// Routes: users | banks | atms (+ atms/import) | audit | voided | jobs/:no/void|restore
import crypto from "node:crypto";
import { pool, query } from "../../server/db.js";
import { requireUser, hashPassword } from "../../server/auth.js";
import { audit } from "../../server/audit.js";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // no look-alike characters
const tempPassword = () => Array.from(crypto.randomBytes(10), (b) => ALPHABET[b % ALPHABET.length]).join("");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ATM_STATUS = ["active", "offline", "under_maintenance", "decommissioned"];
const okSig = (s) => typeof s === "string" && s.startsWith("data:image/png;base64,") && s.length <= 400000;
const normPhone = (v) => String(v ?? "").replace(/[\s()-]/g, "");
const PHONE = /^\+?[0-9]{9,15}$/;
const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const uniq = (e, msg) => { if (e.code === "23505") throw new HttpError(409, msg); throw e; };

export default async function handler(req, res) {
  const me = await requireUser(req, res, { admin: true }); if (!me) return;
  const [r, id, action] = [].concat(req.query.slug || []);
  const m = req.method, b = req.body || {};
  try {
    /* ---------- users ---------- */
    if (r === "users") {
      if (m === "GET" && !id) {
        const { rows } = await query(`SELECT id, name, email, phone, role, active, must_change_password, signature, (coalesce(signature,'') <> '') AS has_signature, created_at
                                      FROM users ORDER BY lower(name)`);
        return res.json(rows);
      }
      if (m === "POST" && !id) {
        const name = str(b.name), email = str(b.email).toLowerCase(), role = b.role === "admin" ? "admin" : "engineer";
        if (!name || !EMAIL.test(email)) throw new HttpError(400, "Name and a valid email are required");
        const phone = normPhone(b.phone);
        if (phone && !PHONE.test(phone)) throw new HttpError(400, "Enter a valid phone number, e.g. +260977123456");
        if (role === "engineer" && !phone) throw new HttpError(400, "A phone number is required for engineers");
        if (b.signature && !okSig(b.signature)) throw new HttpError(400, "Invalid signature image");
        if (role === "engineer" && !b.signature) throw new HttpError(400, "Capture the engineer's signature - it is printed on every job card they file");
        const pw = tempPassword();
        try {
          const { rows } = await query("INSERT INTO users (name,email,password_hash,role,signature,phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, email, role, active",
            [name, email, await hashPassword(pw), role, b.signature || null, phone || null]);
          audit(me.id, "user_created", "user", rows[0].id, { email, role });
          return res.status(201).json({ user: rows[0], tempPassword: pw });
        } catch (e) { uniq(e, "A user with that email already exists"); }
      }
      if (m === "PATCH" && id) {
        const uid = Number(id);
        const cur = (await query("SELECT * FROM users WHERE id=$1", [uid])).rows[0];
        if (!cur) throw new HttpError(404, "User not found");
        const name = b.name !== undefined ? str(b.name) : cur.name;
        const email = b.email !== undefined ? str(b.email).toLowerCase() : cur.email;
        const role = b.role !== undefined ? (b.role === "admin" ? "admin" : "engineer") : cur.role;
        const active = b.active !== undefined ? !!b.active : cur.active;
        if (!name || !EMAIL.test(email)) throw new HttpError(400, "Name and a valid email are required");
        const losingAdmin = cur.role === "admin" && cur.active && (role !== "admin" || !active);
        if (losingAdmin) {
          if (uid === me.id) throw new HttpError(400, "You can't remove your own admin access or deactivate yourself");
          const n = (await query("SELECT count(*)::int AS n FROM users WHERE role='admin' AND active AND id<>$1", [uid])).rows[0].n;
          if (n === 0) throw new HttpError(400, "There must be at least one active admin");
        }
        const phone = b.phone !== undefined ? normPhone(b.phone) : (cur.phone || "");
        if (phone && !PHONE.test(phone)) throw new HttpError(400, "Enter a valid phone number, e.g. +260977123456");
        if (active && role === "engineer" && !phone) throw new HttpError(400, "A phone number is required for engineers");
        if (active && role === "engineer" && !b.signature && !cur.signature) throw new HttpError(400, "Capture the engineer's signature - it is printed on every job card");
        if (b.signature && !okSig(b.signature)) throw new HttpError(400, "Invalid signature image");
        try {
          const { rows } = await query("UPDATE users SET name=$1,email=$2,role=$3,active=$4,signature=COALESCE($6,signature),phone=$7,updated_at=now() WHERE id=$5 RETURNING id,name,email,role,active", [name, email, role, active, uid, b.signature || null, phone || null]);
          audit(me.id, "user_updated", "user", uid, { role, active });
          return res.json(rows[0]);
        } catch (e) { uniq(e, "A user with that email already exists"); }
      }
      if (m === "POST" && id && action === "reset-password") {
        const pw = tempPassword();
        const r2 = await query("UPDATE users SET password_hash=$1, must_change_password=true, failed_logins=0, locked_until=NULL, updated_at=now() WHERE id=$2 RETURNING id", [await hashPassword(pw), Number(id)]);
        if (!r2.rowCount) throw new HttpError(404, "User not found");
        audit(me.id, "password_reset", "user", id);
        return res.json({ tempPassword: pw });
      }
    }

    /* ---------- banks ---------- */
    if (r === "banks") {
      if (m === "GET" && !id) {
        const { rows } = await query(`SELECT b.id, b.name, b.short_code, count(a.id)::int AS atm_count FROM banks b LEFT JOIN atms a ON a.bank_id=b.id GROUP BY b.id ORDER BY lower(b.name)`);
        return res.json(rows);
      }
      if ((m === "POST" && !id) || (m === "PATCH" && id)) {
        const name = str(b.name); if (!name) throw new HttpError(400, "Bank name is required");
        try {
          const { rows } = m === "POST"
            ? await query("INSERT INTO banks (name, short_code) VALUES ($1,$2) RETURNING id", [name, str(b.short_code) || null])
            : await query("UPDATE banks SET name=$1, short_code=$2 WHERE id=$3 RETURNING id", [name, str(b.short_code) || null, Number(id)]);
          if (!rows[0]) throw new HttpError(404, "Bank not found");
          audit(me.id, m === "POST" ? "bank_created" : "bank_updated", "bank", rows[0].id, { name });
          return res.status(m === "POST" ? 201 : 200).json({ ok: true });
        } catch (e) { if (e instanceof HttpError) throw e; uniq(e, "A bank with that name already exists"); }
      }
      if (m === "DELETE" && id) {
        const n = (await query("SELECT count(*)::int AS n FROM atms WHERE bank_id=$1", [Number(id)])).rows[0].n;
        if (n) throw new HttpError(409, `This bank still has ${n} ATM(s). Move or remove them first.`);
        await query("DELETE FROM banks WHERE id=$1", [Number(id)]);
        audit(me.id, "bank_deleted", "bank", id);
        return res.json({ ok: true });
      }
    }

    /* ---------- atms ---------- */
    if (r === "atms") {
      if (m === "GET" && !id) {
        const { rows } = await query(`SELECT a.id::int AS id, a.terminal_id, a.serial_number, a.model, a.location, a.address, a.status, a.has_gbna, a.notes, a.bank_id::int AS bank_id,
                                             COALESCE(b.short_code, b.name) AS bank, (SELECT count(*)::int FROM job_cards j WHERE j.atm_id=a.id) AS jobs
                                      FROM atms a LEFT JOIN banks b ON b.id=a.bank_id ORDER BY a.terminal_id`);
        return res.json(rows);
      }
      if (m === "POST" && id === "import") {
        const rows = Array.isArray(b.rows) ? b.rows : [];
        if (!rows.length || rows.length > 3000) throw new HttpError(400, "Provide between 1 and 3000 rows");
        const client = await pool.connect();
        const out = { created: 0, updated: 0, banksCreated: 0, errors: [] };
        try {
          await client.query("BEGIN");
          const banks = new Map();
          for (const x of (await client.query("SELECT id, name, short_code FROM banks")).rows) {
            banks.set(x.name.toLowerCase(), x.id); if (x.short_code) banks.set(x.short_code.toLowerCase(), x.id);
          }
          for (let i = 0; i < rows.length; i++) {
            const x = rows[i], tid = str(x.terminal_id), loc = str(x.location);
            if (!tid || !loc) { out.errors.push(`Row ${i + 2}: terminal_id and location are required`); continue; }
            let bankId = null; const bn = str(x.bank);
            if (bn) {
              bankId = banks.get(bn.toLowerCase()) ?? null;
              if (!bankId) {
                bankId = (await client.query("INSERT INTO banks (name, short_code) VALUES ($1,$1) RETURNING id", [bn])).rows[0].id;
                banks.set(bn.toLowerCase(), bankId); out.banksCreated++;
              }
            }
            const g = x.has_gbna === undefined || str(x.has_gbna) === "" ? null : /^(1|y|yes|true|x)$/i.test(str(x.has_gbna));
            const r2 = await client.query(`INSERT INTO atms (terminal_id, serial_number, model, location, address, bank_id, has_gbna)
              VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,false))
              ON CONFLICT (lower(terminal_id)) DO UPDATE SET serial_number=EXCLUDED.serial_number, model=EXCLUDED.model, location=EXCLUDED.location,
                address=EXCLUDED.address, bank_id=COALESCE(EXCLUDED.bank_id, atms.bank_id), has_gbna=COALESCE($7, atms.has_gbna), updated_at=now()
              RETURNING (xmax = 0) AS inserted`, [tid, str(x.serial_number) || null, str(x.model) || null, loc, str(x.address) || null, bankId, g]);
            r2.rows[0].inserted ? out.created++ : out.updated++;
          }
          await client.query("COMMIT");
        } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
        audit(me.id, "atms_imported", "atm", "", { created: out.created, updated: out.updated });
        return res.json(out);
      }
      if ((m === "POST" && !id) || (m === "PATCH" && id)) {
        const tid = str(b.terminal_id), loc = str(b.location), status = b.status || "active";
        if (!tid || !loc) throw new HttpError(400, "Terminal ID and location are required");
        if (!ATM_STATUS.includes(status)) throw new HttpError(400, "Invalid status");
        const vals = [tid, str(b.serial_number) || null, str(b.model) || null, loc, str(b.address) || null, b.bank_id ? Number(b.bank_id) : null, status, str(b.notes) || null, !!b.has_gbna];
        try {
          const { rows } = m === "POST"
            ? await query("INSERT INTO atms (terminal_id,serial_number,model,location,address,bank_id,status,notes,has_gbna) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id", vals)
            : await query("UPDATE atms SET terminal_id=$1,serial_number=$2,model=$3,location=$4,address=$5,bank_id=$6,status=$7,notes=$8,has_gbna=$9,updated_at=now() WHERE id=$10 RETURNING id", [...vals, Number(id)]);
          if (!rows[0]) throw new HttpError(404, "ATM not found");
          audit(me.id, m === "POST" ? "atm_created" : "atm_updated", "atm", rows[0].id, { terminal_id: tid, status });
          return res.status(m === "POST" ? 201 : 200).json({ ok: true });
        } catch (e) { if (e instanceof HttpError) throw e; uniq(e, "An ATM with that terminal ID already exists"); }
      }
      if (m === "DELETE" && id) {
        const n = (await query("SELECT count(*)::int AS n FROM job_cards WHERE atm_id=$1", [Number(id)])).rows[0].n;
        if (n) throw new HttpError(409, `This ATM has ${n} job card(s). Set its status to Decommissioned instead of deleting.`);
        await query("DELETE FROM atms WHERE id=$1", [Number(id)]);
        audit(me.id, "atm_deleted", "atm", id);
        return res.json({ ok: true });
      }
    }

    /* ---------- activity + voided cards ---------- */
    if (r === "audit" && m === "GET") {
      const { rows } = await query(`SELECT l.id, l.action, l.entity, l.entity_id, l.detail, l.at, u.name AS user_name
                                    FROM audit_log l LEFT JOIN users u ON u.id=l.user_id ORDER BY l.at DESC LIMIT 200`);
      return res.json(rows);
    }
    if (r === "voided" && m === "GET") {
      const { rows } = await query(`SELECT j.job_no::int AS job_no, j.job_type, j.bank, j.site, j.atm_name, j.void_reason, j.voided_at, u.name AS voided_by
                                    FROM job_cards j LEFT JOIN users u ON u.id=j.voided_by WHERE j.voided_at IS NOT NULL ORDER BY j.voided_at DESC LIMIT 100`);
      return res.json(rows);
    }
    if (r === "jobs" && m === "POST" && id && (action === "void" || action === "restore")) {
      const no = Number(id);
      if (action === "void") {
        const reason = str(b.reason); if (reason.length < 3) throw new HttpError(400, "Give a reason for voiding this card");
        const r2 = await query("UPDATE job_cards SET voided_at=now(), voided_by=$1, void_reason=$2 WHERE job_no=$3 AND voided_at IS NULL RETURNING job_no", [me.id, reason, no]);
        if (!r2.rowCount) throw new HttpError(404, "Job card not found or already voided");
        audit(me.id, "job_voided", "job_card", no, { reason });
      } else {
        const r2 = await query("UPDATE job_cards SET voided_at=NULL, voided_by=NULL, void_reason=NULL WHERE job_no=$1 AND voided_at IS NOT NULL RETURNING job_no", [no]);
        if (!r2.rowCount) throw new HttpError(404, "Job card not found");
        audit(me.id, "job_restored", "job_card", no);
      }
      return res.json({ ok: true });
    }
    res.status(404).json({ error: "Unknown admin route" });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.code).json({ error: e.message });
    console.error(e); res.status(500).json({ error: "Server error" });
  }
}
