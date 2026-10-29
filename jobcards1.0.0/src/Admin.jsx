import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Users, Landmark, Monitor, History, Plus, Search, Upload, Download, KeyRound, Copy } from "lucide-react";
import * as api from "./api";
import { C, FONT_BODY, FONT_DISPLAY, FONT_MONO, Field, TextInput, inputStyle, Sheet, btnPrimary, btnGhost, SignaturePad } from "./App.jsx";

function useApi(path) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api.admin("GET", path).then(d => { setData(d); setErr(""); }).catch(e => setErr(e.message)), [path]);
  useEffect(() => { load(); }, [load]);
  return [data, load, err];
}
const Err = ({ children }) => children ? <div role="alert" style={{ color: C.red700, background: C.redBg, borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: FONT_BODY, marginBottom: 10 }}>{children}</div> : null;
const Pill = ({ children, color = C.slate600, bg = "#E9EDF1" }) => <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{children}</span>;
const Card = ({ children, onClick }) => <div onClick={onClick} style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", cursor: onClick ? "pointer" : "default", display: "flex", alignItems: "center", gap: 10 }}>{children}</div>;
const when = (t) => new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/* ---------- users ---------- */
function SignatureField({ value, onChange }) {
  const [redraw, setRedraw] = useState(false);
  if (value && !redraw) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${C.border}`, borderRadius: 8, background: C.bgPage, padding: "6px 10px" }}>
        <img src={value} alt="Saved signature" style={{ height: 52, flex: 1, minWidth: 0, objectFit: "contain", objectPosition: "left" }} />
        <button type="button" onClick={() => { setRedraw(true); onChange(""); }} style={btnGhost}>Re-draw</button>
      </div>
    );
  }
  return <SignaturePad resetKey={0} value={value} onChange={onChange} />;
}
function UsersAdmin() {
  const [users, reload, err] = useApi("users");
  const [edit, setEdit] = useState(null);
  const [temp, setTemp] = useState(null);
  const [msg, setMsg] = useState("");
  const save = async () => {
    if (edit.role === "engineer" && !edit.phone.trim()) return setMsg("A phone number is required for engineers");
    if (edit.role === "engineer" && !edit.signature) return setMsg("Draw the engineer's signature - it is printed on every job card they file");
    try {
      if (edit.id) await api.admin("PATCH", `users/${edit.id}`, edit);
      else { const r = await api.admin("POST", "users", edit); setTemp({ name: r.user.name, email: r.user.email, password: r.tempPassword }); }
      setEdit(null); reload();
    } catch (e) { setMsg(e.message); }
  };
  const reset = async (u) => {
    if (!window.confirm(`Reset the password for ${u.name}? They must set a new one at next login.`)) return;
    try { const r = await api.admin("POST", `users/${u.id}/reset-password`); setTemp({ name: u.name, email: u.email, password: r.tempPassword }); reload(); }
    catch (e) { window.alert(e.message); }
  };
  return (
    <div>
      <Err>{err}</Err>
      <button onClick={() => { setMsg(""); setEdit({ name: "", email: "", phone: "", role: "engineer", active: true, signature: "" }); }} style={{ ...btnPrimary, marginBottom: 12 }}><Plus size={16} /> Add user</button>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(users || []).map(u => (
          <Card key={u.id}>
            <div style={{ flex: 1, minWidth: 0, opacity: u.active ? 1 : 0.55 }}>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14.5, color: C.ink900 }}>{u.name}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.slate600, overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}{u.phone ? ` · ${u.phone}` : ""}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                <Pill color={u.role === "admin" ? C.navy700 : C.slate600} bg={u.role === "admin" ? C.blueBg : "#E9EDF1"}>{u.role}</Pill>
                {!u.active && <Pill color={C.red700} bg={C.redBg}>deactivated</Pill>}
                {u.must_change_password && <Pill color={C.amber600} bg={C.amberBg}>temp password</Pill>}
                {!u.has_signature && u.role !== "admin" && <Pill color={C.amber600} bg={C.amberBg}>no signature</Pill>}
              </div>
            </div>
            <button onClick={() => reset(u)} title="Reset password" style={{ ...btnGhost, padding: 9 }}><KeyRound size={16} /></button>
            <button onClick={() => { setMsg(""); setEdit({ ...u, phone: u.phone || "", signature: u.signature || "" }); }} style={btnGhost}>Edit</button>
          </Card>
        ))}
      </div>
      {edit && (
        <Sheet title={edit.id ? "Edit user" : "Add user"} onClose={() => setEdit(null)}>
          <Err>{msg}</Err>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Full name"><TextInput value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Email (login)"><TextInput type="email" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Phone number"><TextInput type="tel" inputMode="tel" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} placeholder="+260977123456" /></Field>
            <Field label="Role">
              <select value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })} style={inputStyle}>
                <option value="engineer">Engineer - files job cards</option>
                <option value="admin">Admin - manages users, ATMs, banks</option>
              </select>
            </Field>
            <Field label={edit.role === "engineer" ? "Signature (printed on every job card they file)" : "Signature (optional for admins)"}>
              <SignatureField value={edit.signature} onChange={sig => setEdit(x => ({ ...x, signature: sig }))} />
            </Field>
            {edit.id && (
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT_BODY, fontSize: 14 }}>
                <input type="checkbox" checked={edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })} style={{ width: 20, height: 20, minHeight: 0 }} />
                Active (untick to block sign-in; their job cards stay)
              </label>
            )}
            {!edit.id && <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.slate600 }}>A temporary password is generated and shown once. They must change it at first sign-in.</div>}
            <button onClick={save} style={btnPrimary}>{edit.id ? "Save changes" : "Create user"}</button>
          </div>
        </Sheet>
      )}
      {temp && (
        <Sheet title="Temporary password" onClose={() => setTemp(null)}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.ink900, marginBottom: 10 }}>Give this to <b>{temp.name}</b> ({temp.email}). It is shown only once.</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, letterSpacing: 1, background: C.bgPage, border: `1.5px dashed ${C.navy500}`, borderRadius: 8, padding: 14, textAlign: "center", userSelect: "all", marginBottom: 12 }}>{temp.password}</div>
          <button onClick={() => navigator.clipboard?.writeText(temp.password)} style={{ ...btnPrimary, marginBottom: 8 }}><Copy size={16} /> Copy</button>
          <button onClick={() => setTemp(null)} style={{ ...btnGhost, width: "100%" }}>Done</button>
        </Sheet>
      )}
    </div>
  );
}

/* ---------- CSV helpers ---------- */
function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some(c => c.trim())) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some(c => c.trim())) rows.push(row);
  return rows;
}
const HEAD = { terminalid: "terminal_id", terminal: "terminal_id", atmid: "terminal_id", atm: "terminal_id", bank: "bank", bankname: "bank", bankcode: "bank",
  location: "location", site: "location", branch: "location", sitename: "location", model: "model", type: "model",
  serial: "serial_number", serialnumber: "serial_number", serialno: "serial_number", address: "address", gbna: "has_gbna", hasgbna: "has_gbna", gbnafitted: "has_gbna" };
function csvToRows(text) {
  const [head, ...body] = parseCsv(text);
  const cols = head.map(h => HEAD[h.toLowerCase().replace(/[^a-z]/g, "")] || null);
  if (!cols.includes("terminal_id") || !cols.includes("location")) throw new Error("CSV needs at least terminal_id and location columns");
  return body.map(r => Object.fromEntries(cols.map((c, i) => [c, (r[i] || "").trim()]).filter(([c]) => c)));
}
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- ATMs ---------- */
const STATUS_LABEL = { active: "Active", offline: "Offline", under_maintenance: "Under maintenance", decommissioned: "Decommissioned" };
function AtmsAdmin({ onChanged }) {
  const [atms, reload, err] = useApi("atms");
  const [banks] = useApi("banks");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState("");
  const [imp, setImp] = useState(null); // { rows, result, error }
  const fileRef = useRef(null);
  const list = useMemo(() => {
    const w = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const all = (atms || []).filter(a => !w.length || w.every(x => [a.terminal_id, a.bank, a.location, a.model, a.serial_number].join(" ").toLowerCase().includes(x)));
    return all;
  }, [atms, q]);
  const done = () => { reload(); onChanged?.(); };
  const save = async () => {
    try { await api.admin(edit.id ? "PATCH" : "POST", edit.id ? `atms/${edit.id}` : "atms", edit); setEdit(null); done(); }
    catch (e) { setMsg(e.message); }
  };
  const del = async () => {
    if (!window.confirm(`Delete ${edit.terminal_id}? This cannot be undone.`)) return;
    try { await api.admin("DELETE", `atms/${edit.id}`); setEdit(null); done(); } catch (e) { setMsg(e.message); }
  };
  const pickFile = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try { setImp({ rows: csvToRows(await f.text()) }); } catch (ex) { setImp({ error: ex.message }); }
  };
  const runImport = async () => {
    try { const result = await api.admin("POST", "atms/import", { rows: imp.rows }); setImp({ result }); done(); }
    catch (e) { setImp({ ...imp, error: e.message }); }
  };
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });
  return (
    <div>
      <Err>{err}</Err>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => { setMsg(""); setEdit({ terminal_id: "", bank_id: "", location: "", model: "", serial_number: "", address: "", status: "active", notes: "", has_gbna: false }); }} style={btnPrimary}><Plus size={16} /> Add ATM</button>
        <button onClick={() => fileRef.current.click()} style={btnGhost}><Upload size={15} /> Import CSV</button>
        <button onClick={() => download("atms-template.csv", "terminal_id,bank,location,model,serial_number,address,has_gbna\nATM-FNB-001,FNB,Manda Hill,NCR SelfServ 34,SN12345,Great East Road,yes\n")} style={btnGhost}><Download size={15} /> Template</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={pickFile} style={{ display: "none" }} />
      </div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={15} color={C.slate400} style={{ position: "absolute", left: 11, top: 15 }} />
        <TextInput value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${atms?.length ?? ""} ATMs…`} style={{ paddingLeft: 33 }} />
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.slate400, marginBottom: 8 }}>{list.length} ATM(s){list.length > 60 ? " - showing first 60, search to narrow" : ""}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.slice(0, 60).map(a => (
          <Card key={a.id} onClick={() => { setMsg(""); setEdit({ ...a, bank_id: a.bank_id || "" }); }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.ink900 }}>{a.terminal_id} <span style={{ fontWeight: 500, color: C.slate600 }}>· {a.bank || "no bank"}</span></div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.slate600 }}>{a.location}{a.model ? ` · ${a.model}` : ""}</div>
            </div>
            {a.has_gbna && <Pill color={C.navy700} bg={C.blueBg}>GBNA</Pill>}
            {a.status !== "active" && <Pill color={a.status === "decommissioned" ? C.red700 : C.amber600} bg={a.status === "decommissioned" ? C.redBg : C.amberBg}>{STATUS_LABEL[a.status]}</Pill>}
          </Card>
        ))}
      </div>
      {edit && (
        <Sheet title={edit.id ? `Edit ${edit.terminal_id}` : "Add ATM"} onClose={() => setEdit(null)}>
          <Err>{msg}</Err>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Terminal ID"><TextInput value={edit.terminal_id} onChange={set("terminal_id")} /></Field>
            <Field label="Bank">
              <select value={edit.bank_id} onChange={set("bank_id")} style={inputStyle}>
                <option value="">— none —</option>
                {(banks || []).map(b => <option key={b.id} value={b.id}>{b.name}{b.short_code && b.short_code !== b.name ? ` (${b.short_code})` : ""}</option>)}
              </select>
            </Field>
            <Field label="Location / Site"><TextInput value={edit.location} onChange={set("location")} /></Field>
            <Field label="Model"><TextInput value={edit.model || ""} onChange={set("model")} /></Field>
            <Field label="Serial number"><TextInput value={edit.serial_number || ""} onChange={set("serial_number")} /></Field>
            <Field label="Address"><TextInput value={edit.address || ""} onChange={set("address")} /></Field>
            <Field label="Status">
              <select value={edit.status} onChange={set("status")} style={inputStyle}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: FONT_BODY, fontSize: 14, color: C.ink900 }}>
              <input type="checkbox" checked={!!edit.has_gbna} onChange={e => setEdit({ ...edit, has_gbna: e.target.checked })} style={{ width: 20, height: 20, minHeight: 0, marginTop: 1 }} />
              <span>GBNA (deposit module) fitted<br /><span style={{ fontSize: 12, color: C.slate600 }}>Adds the GBNA checks to this ATM's preventive maintenance cards.</span></span>
            </label>
            <button onClick={save} disabled={!edit.terminal_id.trim() || !edit.location.trim()} style={btnPrimary}>{edit.id ? "Save changes" : "Add ATM"}</button>
            {edit.id && <button onClick={del} style={{ ...btnGhost, color: C.red700, borderColor: C.red700 }}>Delete ATM{edit.jobs ? ` (has ${edit.jobs} job cards - use Decommissioned)` : ""}</button>}
          </div>
        </Sheet>
      )}
      {imp && (
        <Sheet title="Import ATMs" onClose={() => setImp(null)}>
          <Err>{imp.error}</Err>
          {imp.rows && !imp.result && (
            <>
              <div style={{ fontFamily: FONT_BODY, fontSize: 14, marginBottom: 12 }}><b>{imp.rows.length}</b> row(s) found. ATMs whose terminal ID already exists are updated; new ones are added; unknown banks are created.</div>
              <button onClick={runImport} style={btnPrimary}>Import {imp.rows.length} ATMs</button>
            </>
          )}
          {imp.result && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 14 }}>
              <div>✓ <b>{imp.result.created}</b> added, <b>{imp.result.updated}</b> updated{imp.result.banksCreated ? `, ${imp.result.banksCreated} new bank(s)` : ""}.</div>
              {imp.result.errors.length > 0 && <div style={{ marginTop: 10, color: C.red700 }}>{imp.result.errors.slice(0, 8).map((x, i) => <div key={i}>{x}</div>)}{imp.result.errors.length > 8 && <div>…and {imp.result.errors.length - 8} more</div>}</div>}
              <button onClick={() => setImp(null)} style={{ ...btnGhost, width: "100%", marginTop: 14 }}>Close</button>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

/* ---------- banks ---------- */
function BanksAdmin({ onChanged }) {
  const [banks, reload, err] = useApi("banks");
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState("");
  const save = async () => {
    try { await api.admin(edit.id ? "PATCH" : "POST", edit.id ? `banks/${edit.id}` : "banks", edit); setEdit(null); reload(); onChanged?.(); }
    catch (e) { setMsg(e.message); }
  };
  const del = async () => {
    if (!window.confirm(`Delete ${edit.name}?`)) return;
    try { await api.admin("DELETE", `banks/${edit.id}`); setEdit(null); reload(); } catch (e) { setMsg(e.message); }
  };
  return (
    <div>
      <Err>{err}</Err>
      <button onClick={() => { setMsg(""); setEdit({ name: "", short_code: "" }); }} style={{ ...btnPrimary, marginBottom: 12 }}><Plus size={16} /> Add bank</button>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(banks || []).map(b => (
          <Card key={b.id} onClick={() => { setMsg(""); setEdit({ ...b }); }}>
            <div style={{ flex: 1, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14.5 }}>{b.name} {b.short_code && <span style={{ fontWeight: 500, color: C.slate600 }}>· {b.short_code}</span>}</div>
            <Pill>{b.atm_count} ATMs</Pill>
          </Card>
        ))}
      </div>
      {edit && (
        <Sheet title={edit.id ? "Edit bank" : "Add bank"} onClose={() => setEdit(null)}>
          <Err>{msg}</Err>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Bank name"><TextInput value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Short code (shown on job cards, e.g. FNB)"><TextInput value={edit.short_code || ""} onChange={e => setEdit({ ...edit, short_code: e.target.value })} /></Field>
            <button onClick={save} disabled={!edit.name.trim()} style={btnPrimary}>Save</button>
            {edit.id && <button onClick={del} style={{ ...btnGhost, color: C.red700, borderColor: C.red700 }}>Delete bank</button>}
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ---------- activity + voided cards ---------- */
const ACTION = { user_created: "created user", user_updated: "updated user", password_reset: "reset password for user", password_changed: "changed password", bank_created: "added bank", bank_updated: "edited bank", bank_deleted: "deleted bank",
  atm_created: "added ATM", atm_updated: "edited ATM", atm_deleted: "deleted ATM", atms_imported: "imported ATMs", job_voided: "voided job card", job_restored: "restored job card", job_edited: "corrected job card" };
function ActivityAdmin() {
  const [log, , err] = useApi("audit");
  const [voided, reloadV] = useApi("voided");
  const restore = async (no) => { try { await api.admin("POST", `jobs/${no}/restore`); reloadV(); } catch (e) { window.alert(e.message); } };
  return (
    <div>
      <Err>{err}</Err>
      <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, color: C.slate600, textTransform: "uppercase", letterSpacing: 0.5, margin: "4px 0 8px" }}>Voided job cards</div>
      {(voided || []).length === 0 && <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.slate400, marginBottom: 14 }}>None.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {(voided || []).map(v => (
          <Card key={v.job_no}>
            <div style={{ flex: 1, minWidth: 0, fontFamily: FONT_BODY }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>No.{v.job_no} · {v.bank} {v.site}</div>
              <div style={{ fontSize: 12.5, color: C.slate600 }}>“{v.void_reason}” - {v.voided_by}, {when(v.voided_at)}</div>
            </div>
            <button onClick={() => restore(v.job_no)} style={btnGhost}>Restore</button>
          </Card>
        ))}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12, color: C.slate600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Recent activity</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(log || []).map(l => (
          <div key={l.id} style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.ink900, padding: "7px 10px", background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <b>{l.user_name || "System"}</b> {ACTION[l.action] || l.action}{l.entity_id ? ` #${l.entity_id}` : ""}
            <div style={{ fontSize: 11.5, color: C.slate400 }}>{when(l.at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- shell ---------- */
const SUBS = [
  { key: "users", label: "Users", icon: Users },
  { key: "atms", label: "ATMs", icon: Monitor },
  { key: "banks", label: "Banks", icon: Landmark },
  { key: "activity", label: "Activity", icon: History },
];
export default function Admin({ onAtmsChanged }) {
  const [sub, setSub] = useState("users");
  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600, color: C.navy900, marginBottom: 12 }}>Admin</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {SUBS.map(s => {
          const Icon = s.icon, on = sub === s.key;
          return (
            <button key={s.key} onClick={() => setSub(s.key)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap",
              border: `1.5px solid ${on ? C.navy700 : C.border}`, background: on ? C.navy700 : "#fff", color: on ? "#fff" : C.slate600, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13,
            }}><Icon size={15} /> {s.label}</button>
          );
        })}
      </div>
      {sub === "users" && <UsersAdmin />}
      {sub === "atms" && <AtmsAdmin onChanged={onAtmsChanged} />}
      {sub === "banks" && <BanksAdmin onChanged={onAtmsChanged} />}
      {sub === "activity" && <ActivityAdmin />}
    </div>
  );
}
