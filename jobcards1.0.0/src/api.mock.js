// UI-only sandbox: data lives in memory and resets on refresh.
const user = { id: 1, name: "Philip", email: "philip@techmasters.zm", admin: true, mustChange: false };
let signedIn = true;
let next = 11418;
const jobs = [
  { job_no: 11416, job_type: "repair", atm_id: 1, bank: "FNB", site: "Mkushi Branch", atm_name: "8002", model: "6684/82", serial_number: "", service_date: "2026-07-02", start_time: "15:25", end_time: "19:06", fault_category: "Card Reader", description: "Failing to clear card reader. Card reader reworked, pre-head replaced, test done and passed.", parts_used: "Pre-head sensor", status: "In Service", technician: "Terence", custodian1_name: "Cleopatra", custodian2_name: "Kafwalya Cynthia", created_at: "2026-07-02T19:06:00Z" },
  { job_no: 11417, job_type: "maintenance", atm_id: 2, bank: "FNB", site: "Manda Hill", atm_name: "1003", model: "6654", service_date: "2026-06-15", start_time: "10:00", end_time: "10:40",
    checklist: { canopyHood: ["ok","ok","ok","ok","ok"], cashDispenser: ["ok","ok","ok","ok","ok","nr","na"], atmRoom: ["ok","ok","fail"] },
    technician: "Mapalo", custodian1_name: "Moffat", custodian2_name: "Veronica", created_at: "2026-06-15T10:40:00Z" },
];
// 320 sample ATMs to exercise the search picker
const banks = ["FNB", "ABS", "ZNC", "SCB", "SBZ", "ZICB"];
const towns = ["Lusaka CBD", "Kitwe", "Ndola", "Livingstone", "Kabwe", "Chipata", "Mkushi", "Solwezi", "Mongu", "Kasama", "Manda Hill", "Levy Mall", "Arcades", "Cairo Road"];
const atms = Array.from({ length: 320 }, (_, i) => {
  const b = banks[i % banks.length];
  return { id: i + 1, terminal_id: `ATM-${b}-${i + 1}`, has_gbna: i % 4 === 0, serial_number: i % 3 ? `SN${100000 + i * 7}` : "", model: i % 2 ? "NCR SelfServ 34" : "NCR SelfServ 22 (6654)", location: `${towns[i % towns.length]} ${i % 5 ? "Branch" : "Mall"}`, bank: b };
});
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120));
export const me = () => wait(signedIn ? user : null);
export const login = () => { signedIn = true; return wait(user); };
export const logout = () => { signedIn = false; return wait({ ok: true }); };
let sig = "";
export const saveSignature = (s) => { sig = s; return wait({ ok: true }); };
export const bootstrap = () => wait({ jobs, atms, profile: { signature: sig } });
export const createJob = (row) => {
  const j = { ...row, job_no: next++, created_at: new Date().toISOString() };
  jobs.push(j); return wait(j);
};
export const getJob = (n) => wait(jobs.find((j) => j.job_no === Number(n)));
export const updateJob = (n, u) => { Object.assign(jobs.find((j) => j.job_no === Number(n)), u); return wait({ ok: true }); };

export const changePassword = () => wait({ ok: true });
// ---- admin sandbox ----
const SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const users = [
  { id: 1, name: "Philip", email: "philip@techmasters.zm", phone: "+260977000001", role: "admin", active: true, must_change_password: false, has_signature: true, signature: SIG },
  { id: 2, name: "Terence", email: "terence@techmasters.zm", phone: "+260977000002", role: "engineer", active: true, must_change_password: false, has_signature: true, signature: SIG },
  { id: 3, name: "Mapalo", email: "mapalo@techmasters.zm", phone: "+260977000003", role: "engineer", active: false, must_change_password: false, has_signature: true, signature: SIG },
];
const banksList = banks.map((c, i) => ({ id: i + 1, name: c === "FNB" ? "First National Bank" : c, short_code: c }));
let nid = 100;
const audit = [{ id: 1, action: "user_created", entity: "user", entity_id: "3", detail: { role: "engineer" }, at: new Date().toISOString(), user_name: "Philip" }];
const voided = [];
const adminAtm = (a) => ({ ...a, bank_id: (banksList.find(b => b.short_code === a.bank) || {}).id || null, status: a.status || "active", address: a.address || "", notes: a.notes || "", jobs: 0 });
export const admin = async (method, path, body = {}) => {
  const [r, id, action] = path.split("/");
  const n = Number(id);
  if (r === "users") {
    if (method === "GET") return wait(users);
    if (method === "POST" && !id) { const u = { id: nid++, name: body.name, email: body.email, phone: body.phone, role: body.role || "engineer", active: true, must_change_password: true, has_signature: !!body.signature, signature: body.signature }; users.push(u); return wait({ user: u, tempPassword: "Temp4829xK" }); }
    if (action === "reset-password") return wait({ tempPassword: "Reset7315mQ" });
    Object.assign(users.find(u => u.id === n), body); return wait({ ok: true });
  }
  if (r === "banks") {
    if (method === "GET") return wait(banksList.map(b => ({ ...b, atm_count: atms.filter(a => a.bank === b.short_code).length })));
    if (method === "POST") { banksList.push({ id: nid++, name: body.name, short_code: body.short_code }); return wait({ ok: true }); }
    if (method === "PATCH") { Object.assign(banksList.find(b => b.id === n), body); return wait({ ok: true }); }
    banksList.splice(banksList.findIndex(b => b.id === n), 1); return wait({ ok: true });
  }
  if (r === "atms") {
    if (method === "GET") return wait(atms.map(adminAtm));
    if (id === "import") { let created = 0; body.rows.forEach(x => { if (x.terminal_id && x.location) { atms.push({ id: nid++, terminal_id: x.terminal_id, bank: x.bank, location: x.location, model: x.model, serial_number: x.serial_number }); created++; } }); return wait({ created, updated: 0, banksCreated: 0, errors: [] }); }
    const bank = (banksList.find(b => b.id === Number(body.bank_id)) || {}).short_code || "";
    if (method === "POST") { atms.push({ id: nid++, ...body, bank }); return wait({ ok: true }); }
    if (method === "PATCH") { Object.assign(atms.find(a => a.id === n), body, { bank }); return wait({ ok: true }); }
    atms.splice(atms.findIndex(a => a.id === n), 1); return wait({ ok: true });
  }
  if (r === "audit") return wait(audit);
  if (r === "voided") return wait(voided);
  if (r === "jobs") {
    if (action === "void") { const i = jobs.findIndex(j => j.job_no === n); voided.push({ ...jobs[i], void_reason: body.reason, voided_at: new Date().toISOString(), voided_by: "Philip" }); jobs.splice(i, 1); }
    else { const i = voided.findIndex(j => j.job_no === n); jobs.push(voided[i]); voided.splice(i, 1); }
    return wait({ ok: true });
  }
  return wait({});
};
