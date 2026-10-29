import { query } from "../server/db.js";
import { requireUser } from "../server/auth.js";
import { LIST_COLS } from "../server/jobs.js";
// One round-trip on page load: jobs + ATM fleet + the user's saved signature.
export default async function handler(req, res) {
  const user = await requireUser(req, res); if (!user) return;
  try {
    const [jobs, atms, prof] = await Promise.all([
      query(`SELECT ${LIST_COLS} FROM job_cards WHERE voided_at IS NULL ORDER BY job_no DESC LIMIT 1000`),
      query(`SELECT a.id::int AS id, a.terminal_id, a.serial_number, a.model, a.location, a.has_gbna, COALESCE(b.short_code, b.name) AS bank
             FROM atms a LEFT JOIN banks b ON b.id = a.bank_id WHERE a.status <> 'decommissioned' ORDER BY a.terminal_id`),
      query("SELECT signature FROM users WHERE id=$1", [user.id]),
    ]);
    res.json({ jobs: jobs.rows.reverse(), atms: atms.rows, profile: { signature: prof.rows[0]?.signature || "" } });
  } catch (e) { console.error(e); res.status(500).json({ error: "Could not load data" }); }
}
