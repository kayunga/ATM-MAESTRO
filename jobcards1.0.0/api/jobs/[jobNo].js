import { query } from "../../server/db.js";
import { requireUser, methodNot } from "../../server/auth.js";
import { audit } from "../../server/audit.js";
import { clean, FULL_COLS } from "../../server/jobs.js";
export default async function handler(req, res) {
  const user = await requireUser(req, res); if (!user) return;
  const jobNo = Number(req.query.jobNo);
  if (!Number.isInteger(jobNo)) return res.status(400).json({ error: "Bad job number" });
  try {
    if (req.method === "GET") {
      const { rows } = await query(`SELECT ${FULL_COLS} FROM job_cards WHERE job_no=$1`, [jobNo]);
      return rows[0] ? res.json(rows[0]) : res.status(404).json({ error: "Not found" });
    }
    if (req.method === "PATCH") {
      if (!user.admin) return res.status(403).json({ error: "Only an admin can correct a filed job card" });
      const d = clean(req.body || {});
      const cols = Object.keys(d);
      if (!cols.length) return res.status(400).json({ error: "Nothing to update" });
      const sets = cols.map((c, i) => `${c}=$${i + 1}`).join(",");
      const r = await query(`UPDATE job_cards SET ${sets}, updated_at=now() WHERE job_no=$${cols.length + 1} RETURNING job_no`,
        [...cols.map((c) => d[c]), jobNo]);
      if (r.rowCount) audit(user.id, "job_edited", "job_card", jobNo, { fields: cols });
      return r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: "Not found" });
    }
    methodNot(res, "GET, PATCH");
  } catch (e) { console.error(e); res.status(500).json({ error: "Update failed: " + e.message }); }
}
