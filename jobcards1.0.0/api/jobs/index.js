import { query } from "../../server/db.js";
import { requireUser, methodNot } from "../../server/auth.js";
import { clean, LIST_COLS } from "../../server/jobs.js";
export default async function handler(req, res) {
  const user = await requireUser(req, res); if (!user) return;
  try {
    if (req.method === "GET") {
      const { rows } = await query(`SELECT ${LIST_COLS} FROM job_cards WHERE voided_at IS NULL ORDER BY job_no DESC LIMIT 1000`);
      return res.json(rows);
    }
    if (req.method === "POST") {
      const d = clean(req.body || {});
      if (!["repair", "maintenance", "incident"].includes(d.job_type)) return res.status(400).json({ error: "Invalid job_type" });
      // Bank / site / model / serial come from the ATM record, never from the request body.
      if (!d.atm_id) return res.status(400).json({ error: "Select an ATM from the list" });
      const atm = (await query(`SELECT a.terminal_id, a.model, a.location, a.serial_number, a.has_gbna, COALESCE(b.short_code, b.name) AS bank
                                FROM atms a LEFT JOIN banks b ON b.id = a.bank_id WHERE a.id = $1`, [d.atm_id])).rows[0];
      if (!atm) return res.status(400).json({ error: "That ATM no longer exists - pick it again" });
      Object.assign(d, { bank: atm.bank, site: atm.location, atm_name: atm.terminal_id, model: atm.model, serial_number: atm.serial_number, technician: user.name });
      // The engineer's name and signature come from their user record (set by an admin), not from the form.
      const urow = (await query("SELECT signature, phone FROM users WHERE id=$1", [user.id])).rows[0];
      const sig = urow?.signature;
      if (!sig) return res.status(400).json({ error: "Your signature isn't on file yet. Ask an admin to add it." });
      d.technician_signature = sig; d.technician_phone = urow.phone;
      // GBNA checks belong only on ATMs that have a GBNA fitted.
      if (d.job_type === "maintenance" && d.checklist) {
        if (!atm.has_gbna) delete d.checklist.gbna;
        else if (!d.checklist.gbna) return res.status(400).json({ error: "This ATM has a GBNA - complete the GBNA checks" });
      }
      d.created_by = user.id;
      const cols = Object.keys(d);
      const sql = `INSERT INTO job_cards (${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING job_no`;
      const ins = await query(sql, cols.map((c) => d[c]));
      const { rows } = await query(`SELECT ${LIST_COLS} FROM job_cards WHERE job_no=$1`, [ins.rows[0].job_no]);
      return res.status(201).json(rows[0]);
    }
    methodNot(res, "GET, POST");
  } catch (e) { console.error(e); res.status(500).json({ error: "Could not save job card: " + e.message }); }
}
