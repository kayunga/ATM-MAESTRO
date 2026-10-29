// Column handling shared by the jobs endpoints.
export const WRITABLE = [
  "job_type","atm_id","bank","site","atm_name","model","serial_number",
  "service_date","start_time","end_time","fault_category","description","parts_used",
  "status","checklist","notes","technician","technician_signature","technician_phone",
  "custodian1_name","custodian1_signature","custodian2_name","custodian2_signature",
  "source","raw_message","assigned_at",
];
const BASE = `job_no::int AS job_no, job_type, atm_id::int AS atm_id,
  bank, site, atm_name, model, serial_number,
  to_char(service_date,'YYYY-MM-DD') AS service_date,
  to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time,
  fault_category, description, parts_used, status, checklist, notes, technician, technician_phone,
  custodian1_name, custodian2_name, source, raw_message, assigned_at, created_at`;
// List omits base64 signatures (they would blow Vercel's 4.5 MB response cap); detail includes them.
export const LIST_COLS = BASE;
export const FULL_COLS = `${BASE}, technician_signature, custodian1_signature, custodian2_signature`;

export function clean(body) {
  const out = {};
  for (const k of WRITABLE) {
    if (!(k in body)) continue;
    const v = body[k];
    out[k] = v === "" || v === undefined ? null : v;
  }
  return out;
}
