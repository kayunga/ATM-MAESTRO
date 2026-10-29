import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import {
  Wrench, ClipboardList, BarChart3, Search, Plus, X, Clock,
  MapPin, CheckCircle2, AlertTriangle, PauseCircle, ChevronRight,
  Stamp, TrendingUp, Users, Building2, Timer, Eraser, PenLine,
  Printer, FileDown, MessageCircle, UserPlus, Send, MinusCircle, ShieldCheck, Settings, Lock
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell
} from "recharts";
import * as api from "./api";
const Admin = lazy(() => import("./Admin.jsx"));

/* ---------- design tokens ---------- */
export const C = {
  bgPage: "#EEF1F5",
  bgPanel: "#FFFFFF",
  border: "#D7DEE6",
  navy900: "#0E2338",
  navy700: "#1B3A5C",
  navy500: "#2C5282",
  ink900: "#132433",
  slate600: "#5C6B7A",
  slate400: "#8B98A6",
  amber500: "#E3A03D",
  amber600: "#B97E24",
  amberBg: "#FBF0DC",
  teal700: "#2A6E68",
  tealBg: "#E3F0EE",
  red700: "#AE3B2E",
  redBg: "#F7E4E1",
  blueBg: "#E7EEF7",
};

export const FONT_DISPLAY = "'Oswald', 'Arial Narrow', sans-serif";
export const FONT_BODY = "'Inter', -apple-system, sans-serif";
export const FONT_MONO = "'JetBrains Mono', 'Courier New', monospace";

const FAULT_CATEGORIES = [
  "Card Reader", "Cash Dispenser", "GBNA", "Receipt Printer", "Network / Communication",
  "Power / UPS", "Software / Configuration", "PIN Pad", "Other",
];
const STATUS_OPTS = ["In Service", "Out of Service", "Pending Parts"];
const JOB_TYPES = [
  { key: "repair", label: "Repair Job Card" },
  { key: "maintenance", label: "Preventive Maintenance" },
];

const PM_SECTIONS = [
  {
    key: "canopyHood", title: "Canopy / Hood Devices", items: [
      "Encrypting PIN pad and FDKs working",
      "Card reader: cleaned, transport clear, test transaction done",
      "Journal printer cleaned, print legible",
      "Receipt printer cleaned and working",
      "PC opened and cleaned",
    ],
  },
  {
    key: "cashDispenser", title: "Cash Dispenser Modules", items: [
      "All cassettes working (self-test run, notes learned)",
      "All pick modules / slots working",
      "D-wheel timing and status of all pick lines checked",
      "Carriage, Bill Aligner Module and SNT checked & cleaned",
      "Worn suction cups replaced",
      "Filter replaced",
      "Exit shutter cleaned",
    ],
  },
  {
    key: "gbna", title: "GBNA Module (if fitted)", items: [
      "Pre-acceptor cleaned, status checked",
      "Cassettes accepting notes for configured denominations",
      "Escrow / reservoir and bill validator cleaned and checked",
      "Transport test: upper, lower and exit shutter",
    ],
  },
  {
    key: "atmRoom", title: "ATM Room", items: [
      "Inverter / UPS installed and working",
      "Air conditioner installed and working",
    ],
  },
];
// Per-item answers. "nr" covers "checked, nothing to clean/replace".
const PM_ORDER = ["ok", "na", "nr", "fail"];
const PM_STATUS = {
  ok:   { label: "Done",             short: "Done",      hint: "Work carried out / item OK", color: C.teal700, bg: C.tealBg, icon: CheckCircle2 },
  fail: { label: "Not OK",           short: "Not OK",    hint: "Fault found - needs attention", color: C.red700, bg: C.redBg, icon: AlertTriangle },
  na:   { label: "N/A",              short: "N/A",       hint: "Not fitted / not applicable to this ATM", color: C.slate600, bg: "#E9EDF1", icon: MinusCircle },
  nr:   { label: "No action needed", short: "No action", hint: "Inspected - good condition, nothing to clean or replace", color: C.navy500, bg: C.blueBg, icon: ShieldCheck },
};
function blankChecklist() {
  const obj = {};
  PM_SECTIONS.forEach(s => { obj[s.key] = s.items.map(() => null); });
  return obj;
}
function checklistSummary(checklist) {
  if (!checklist) return { total: 0, ok: 0, fail: 0, unset: 0 };
  let total = 0, ok = 0, fail = 0, unset = 0;
  Object.values(checklist).forEach(arr => arr.forEach(s => {
    total++;
    if (s === "ok") ok++; else if (s === "fail") fail++; else unset++;
  }));
  return { total, ok, fail, unset };
}

/* ---------- SQLite row <-> app-shape mapping ---------- */
function toRow(job) {
  return {
    job_no: job.jobNo,
    atm_id: job.atmId,
    engineer_id: job.engineerId,
    job_type: job.jobType,
    bank: job.bank,
    site: job.site,
    atm_name: job.atmName,
    model: job.model,
    serial_number: job.serialNumber,
    service_date: job.date,
    start_time: job.startTime,
    end_time: job.endTime,
    fault_category: job.faultCategory,
    description: job.description,
    parts_used: job.partsUsed,
    status: job.status,
    checklist: job.checklist,
    notes: job.notes,
    technician: job.technician,
    technician_signature: job.technicianSignature,
    technician_phone: job.technicianPhone,
    custodian1_name: job.custodian1Name,
    custodian1_signature: job.custodian1Signature,
    custodian2_name: job.custodian2Name,
    custodian2_signature: job.custodian2Signature,
    source: job.source,
    raw_message: job.rawMessage,
    assigned_at: job.assignedAt,
    created_at: job.createdAt,
  };
}
function fromRow(row) {
  return {
    jobNo: row.job_no,
    atmId: row.atm_id,
    engineerId: row.engineer_id,
    jobType: row.job_type,
    bank: row.bank,
    site: row.site,
    atmName: row.atm_name,
    model: row.model,
    serialNumber: row.serial_number,
    date: row.service_date,
    startTime: row.start_time,
    endTime: row.end_time,
    faultCategory: row.fault_category,
    description: row.description,
    partsUsed: row.parts_used,
    status: row.status,
    checklist: row.checklist,
    notes: row.notes,
    technician: row.technician,
    technicianSignature: row.technician_signature,
    technicianPhone: row.technician_phone,
    custodian1Name: row.custodian1_name,
    custodian1Signature: row.custodian1_signature,
    custodian2Name: row.custodian2_name,
    custodian2Signature: row.custodian2_signature,
    source: row.source,
    rawMessage: row.raw_message,
    assignedAt: row.assigned_at,
    createdAt: row.created_at,
  };
}

/* ---------- helpers ---------- */
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function durationMinutes(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return null;
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}
function fmtDuration(mins) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function statusStyle(status) {
  if (status === "In Service") return { bg: C.tealBg, fg: C.teal700, icon: CheckCircle2 };
  if (status === "Pending Parts") return { bg: C.amberBg, fg: C.amber600, icon: PauseCircle };
  return { bg: C.redBg, fg: C.red700, icon: AlertTriangle };
}
function jobStatusMeta(job) {
  if (job.jobType === "incident") {
    return job.status === "Unassigned"
      ? { bg: C.amberBg, fg: C.amber600, icon: AlertTriangle, label: "Unassigned" }
      : { bg: C.tealBg, fg: C.teal700, icon: CheckCircle2, label: job.status || "Assigned" };
  }
  if (job.jobType === "maintenance") {
    const { fail } = checklistSummary(job.checklist);
    if (job.status === "Out of Service") return { bg: C.redBg, fg: C.red700, icon: AlertTriangle, label: "Out of Service" };
    if (job.status === "Pending Parts") return { bg: C.amberBg, fg: C.amber600, icon: PauseCircle, label: "Pending Parts" };
    return fail > 0
      ? { bg: C.amberBg, fg: C.amber600, icon: AlertTriangle, label: `In Service · ${fail} Not OK` }
      : { bg: C.tealBg, fg: C.teal700, icon: CheckCircle2, label: "Completed" };
  }
  return { ...statusStyle(job.status), label: job.status };
}

/* ---------- stamp badge (signature element) ---------- */
function StampBadge({ jobNo, size = "md", animate = false }) {
  const dims = size === "lg" ? { fs: 22, pad: "10px 16px" } : { fs: 14, pad: "5px 10px" };
  return (
    <div
      className={animate ? "stamp-pop" : ""}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: FONT_MONO, fontWeight: 700, fontSize: dims.fs,
        color: C.red700, padding: dims.pad,
        border: `2px solid ${C.red700}`, borderRadius: 4,
        transform: "rotate(-3deg)", letterSpacing: 0.5,
        boxShadow: `2px 2px 0px ${C.red700}22`,
        background: "rgba(174,59,46,0.04)", whiteSpace: "nowrap",
      }}
    >
      <Stamp size={dims.fs - 4} strokeWidth={2.5} />
      No.{jobNo}
    </div>
  );
}

/* ---------- signature pad ---------- */
export function SignaturePad({ value, onChange, resetKey }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const CW = 600, CH = 150;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, CW, CH);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = C.navy900;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, CW, CH);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * (CW / rect.width), y: (clientY - rect.top) * (CH / rect.height) };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, CW, CH);
    onChange("");
  };

  return (
    <div>
      <div style={{ position: "relative" }}>
        {!value && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none", color: C.slate400, fontFamily: FONT_BODY, fontSize: 12, gap: 5,
          }}>
            <PenLine size={13} /> Sign here
          </div>
        )}
        <canvas
          ref={canvasRef} width={CW} height={CH}
          style={{
            width: "100%", height: 110, background: "#fff", borderRadius: 6,
            border: `1.5px dashed ${C.border}`, touchAction: "none", cursor: "crosshair", display: "block",
          }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
      </div>
      <button type="button" onClick={clear} style={{
        marginTop: 6, fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: C.slate600,
        background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0,
      }}>
        <Eraser size={13} /> Clear signature
      </button>
    </div>
  );
}

/* ---------- printable job card (for PDF export via browser print) ---------- */
function PrintRow({ label, value, wide }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined, borderBottom: "1px solid #999", padding: "3px 2px" }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#111", marginTop: 1, whiteSpace: "pre-wrap" }}>{value || "—"}</div>
    </div>
  );
}
function PrintSignature({ label, name, sig }) {
  return (
    <div style={{ border: "1px solid #999", borderRadius: 4, padding: 5, flex: 1 }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
      <div style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa", marginBottom: 2 }}>
        {sig ? <img src={sig} alt="" style={{ maxHeight: 36, maxWidth: "100%" }} /> : <span style={{ fontSize: 9, color: "#aaa" }}>No signature</span>}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 600, textAlign: "center" }}>{name || "—"}</div>
    </div>
  );
}
function PrintChecklist({ checklist }) {
  const cl = checklist || {};
  const cell = { border: "1px solid #bbb", padding: "2px 5px" };
  return PM_SECTIONS.filter(sec => sec.key !== "gbna" || cl.gbna).map(sec => (
    <table key={sec.key} style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6, fontSize: 10.5, tableLayout: "fixed" }}>
      <colgroup><col /><col style={{ width: 96 }} /></colgroup>
      <thead>
        <tr style={{ background: "#EEF1F5" }}>
          <th style={{ ...cell, textAlign: "left", fontSize: 9.5, textTransform: "uppercase", color: "#0E2338" }}>{sec.title.replace(" (if fitted)", "")}</th>
          <th style={{ ...cell, fontSize: 8.5, textTransform: "uppercase", color: "#333" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {sec.items.map((label, i) => {
          const m = PM_STATUS[(cl[sec.key] && cl[sec.key][i]) || ""];
          return (
            <tr key={i}>
              <td style={cell}>{label}</td>
              <td style={{ ...cell, textAlign: "center", fontWeight: 700, color: m ? m.color : "#aaa" }}>{m ? m.label : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  ));
}
function PrintableJobCard({ job }) {
  if (!job) return null;
  const isPM = job.jobType === "maintenance";
  const dur = durationMinutes(job.startTime, job.endTime);
  return (
    <div style={{ fontFamily: FONT_BODY, color: "#111" }}>
      <img src="/logo.png" alt="TechMasters" style={{ width: "100%", maxHeight: 64, objectFit: "contain", objectPosition: "left", display: "block" }} />
      <div style={{ borderTop: "2px solid #0E2338", margin: "6px 0 8px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 600, color: "#0E2338" }}>
          {isPM ? "ATM Preventive Maintenance Job Card" : "ATM Repair Job Card"}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: "#AE3B2E", border: "2px solid #AE3B2E", borderRadius: 4, padding: "1px 8px" }}>
          No.{job.jobNo}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", marginBottom: 8 }}>
        <PrintRow label="Bank" value={job.bank} />
        <PrintRow label="Date" value={fmtDate(job.date)} />
        <PrintRow label="Location / Site" value={job.site} />
        <PrintRow label="ATM Name" value={job.atmName} />
        <PrintRow label="Model / Type" value={job.model} />
        <PrintRow label="Serial Number" value={job.serialNumber} />
        <PrintRow label="CE Start Time" value={job.startTime} />
        <PrintRow label="CE End Time" value={job.endTime ? `${job.endTime} (${fmtDuration(dur)})` : ""} />
      </div>
      {isPM ? (
        <>
          <PrintChecklist checklist={job.checklist} />
          <PrintRow label="Notes / Remarks" value={job.notes} wide />
          <PrintRow label="ATM Status After Visit" value={job.status} wide />
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr" }}>
          <PrintRow label="Fault Category" value={job.faultCategory} wide />
          <PrintRow label="Description of Repair" value={job.description} wide />
          <PrintRow label="Spare Parts / Compound Used" value={job.partsUsed} wide />
          <PrintRow label="Status After Repair" value={job.status} wide />
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <PrintSignature label="Engineer Name and Signature" name={job.technician} sig={job.technicianSignature} />
        <PrintSignature label="Custodian 1" name={job.custodian1Name} sig={job.custodian1Signature} />
        <PrintSignature label="Custodian 2" name={job.custodian2Name} sig={job.custodian2Signature} />
      </div>
      <div style={{ textAlign: "center", fontSize: 8.5, color: "#999", marginTop: 8, fontStyle: "italic" }}>
        Inventing TECH · Changing Lives
      </div>
    </div>
  );
}

/* ---------- searchable ATM picker (300+ ATMs) ---------- */
function AtmPicker({ atms, value, onPick, bank }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const selected = atms.find(a => a.id === value) || null;
  const pool = useMemo(() => (bank ? atms.filter(a => a.bank === bank) : atms), [atms, bank]);
  const { results, total } = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = words.length
      ? pool.filter(a => {
          const hay = [a.terminal_id, a.bank, a.location, a.model, a.serial_number].join(" ").toLowerCase();
          return words.every(w => hay.includes(w));
        })
      : pool;
    return { results: list.slice(0, 40), total: list.length };
  }, [pool, q]);
  const choose = (a) => { onPick(a); setOpen(false); setQ(""); };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && open && results[hi]) { e.preventDefault(); choose(results[hi]); }
    else if (e.key === "Escape") setOpen(false);
  };
  if (selected && !open) {
    return (
      <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setOpen(true)}>
          <b>{selected.terminal_id}</b> <span style={{ color: C.slate600 }}>· {selected.bank} · {selected.location}</span>
        </div>
        <button type="button" onClick={() => onPick(null)} title="Clear" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
          <X size={16} color={C.slate600} />
        </button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <Search size={15} color={C.slate400} style={{ position: "absolute", left: 11, top: 13 }} />
      <input
        autoFocus={!!selected} value={q} disabled={!atms.length}
        onChange={e => { setQ(e.target.value); setHi(0); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey}
        placeholder={atms.length ? `Search ${pool.length}${bank ? " " + bank : ""} ATMs by terminal ID or site…` : "No ATMs loaded yet - ask an admin to import the ATM list"}
        style={{ ...inputStyle, paddingLeft: 33 }}
      />
      {open && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 20, background: "#fff",
          border: `1.5px solid ${C.border}`, borderRadius: 8, maxHeight: 280, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        }}>
          {results.length === 0 && <div style={{ padding: 12, fontSize: 13, color: C.slate400, fontFamily: FONT_BODY }}>No matching ATM. Ask an admin to add it under Admin → ATMs.</div>}
          {results.map((a, i) => (
            <div key={a.id} onMouseDown={e => { e.preventDefault(); choose(a); }} onMouseEnter={() => setHi(i)}
              style={{ padding: "8px 12px", cursor: "pointer", background: i === hi ? C.blueBg : "#fff", fontFamily: FONT_BODY, borderBottom: `1px solid ${C.bgPage}` }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink900 }}>{a.terminal_id} <span style={{ fontWeight: 500, color: C.slate600 }}>· {a.bank}</span></div>
              <div style={{ fontSize: 12, color: C.slate600 }}>{a.location}{a.model ? ` · ${a.model}` : ""}</div>
            </div>
          ))}
          {total > results.length && <div style={{ padding: "8px 12px", fontSize: 11.5, color: C.slate400, fontFamily: FONT_BODY }}>Showing {results.length} of {total} - keep typing to narrow down</div>}
        </div>
      )}
    </div>
  );
}

/* ---------- field primitives ---------- */
export function Field({ label, children, span, id, error, required }) {
  return (
    <div id={id} style={{ gridColumn: span ? "1 / -1" : undefined, scrollMarginTop: 90 }}>
      <label style={{
        display: "block", fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600,
        color: error ? C.red700 : C.slate600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5,
      }}>{label}{required && <span style={{ color: C.red700 }}> *</span>}</label>
      <div style={error ? { outline: `2px solid ${C.red700}`, outlineOffset: 2, borderRadius: 8 } : undefined}>{children}</div>
      {error && <div role="alert" style={{ color: C.red700, fontSize: 12.5, fontWeight: 600, marginTop: 5, fontFamily: FONT_BODY }}>{error}</div>}
    </div>
  );
}
export const inputStyle = {
  width: "100%", boxSizing: "border-box", fontFamily: FONT_BODY, fontSize: 15,
  color: C.ink900, background: C.bgPage, border: `1.5px solid ${C.border}`,
  borderRadius: 6, padding: "9px 11px", outline: "none",
};

export function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}
function TimeInput({ value, onChange }) {
  const now = () => { const d = new Date(); onChange(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`); };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <TextInput type="time" value={value} onChange={e => onChange(e.target.value)} />
      <button type="button" onClick={now} style={{ flexShrink: 0, border: `1.5px solid ${C.navy500}`, background: "#fff", color: C.navy500, borderRadius: 6, padding: "0 14px", fontWeight: 700, fontSize: 12.5, fontFamily: FONT_BODY, cursor: "pointer" }}>Now</button>
    </div>
  );
}
function Select({ options, ...props }) {
  return (
    <select {...props} style={{ ...inputStyle, ...props.style }}>
      <option value="">Select…</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
function TextArea(props) {
  return <textarea {...props} style={{ ...inputStyle, resize: "vertical", minHeight: 80, ...props.style }} />;
}

/* ---------- checklist (preventive maintenance) ---------- */
function ChecklistItemRow({ label, status, onChange, invalid }) {
  const m = PM_STATUS[status];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 10px", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
      <div style={{ flex: "1 1 220px", fontFamily: FONT_BODY, fontSize: 13.5, color: C.ink900, lineHeight: 1.35 }}>{label}</div>
      <select value={status || ""} onChange={e => onChange(e.target.value || null)} style={{
        width: 150, padding: "7px 9px", borderRadius: 8, fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
        border: `1.5px solid ${m ? m.color : invalid ? C.red700 : C.border}`, background: m ? m.bg : invalid ? C.redBg : "#fff", color: m ? m.color : C.slate600,
      }}>
        <option value="">Select status…</option>
        {PM_ORDER.map(k => <option key={k} value={k}>{PM_STATUS[k].label}</option>)}
      </select>
    </div>
  );
}
function ChecklistSection({ section, values, onChange, onAll, onRemove, invalid }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { if (invalid) setOpen(true); }, [invalid]);
  const answered = values.filter(Boolean).length;
  const complete = answered === values.length;
  const small = { background: "none", border: "none", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, padding: "4px 0" };
  return (
    <div id={`f-checklist-${section.key}`} style={{ background: C.bgPanel, border: `${invalid ? 2 : 1}px solid ${invalid ? C.red700 : complete ? C.teal700 : C.border}`, borderRadius: 10, padding: "6px 16px 10px", scrollMarginTop: 90 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <button type="button" onClick={() => setOpen(o => !o)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "8px 0" }}>
          <ChevronRight size={16} color={C.slate600} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
          <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.navy900, textTransform: "uppercase", letterSpacing: 0.5 }}>{section.title}</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: complete ? C.teal700 : C.slate400, whiteSpace: "nowrap" }}>{answered}/{values.length}</span>
        </button>
        <div style={{ display: "flex", gap: 14 }}>
          {open && <button type="button" onClick={onAll} style={{ ...small, color: C.teal700 }}>✓ All done</button>}
          {onRemove && <button type="button" onClick={onRemove} style={{ ...small, color: C.red700 }}>Remove</button>}
        </div>
      </div>
      {open && section.items.map((label, i) => (
        <ChecklistItemRow key={i} label={label} status={values[i]} invalid={invalid} onChange={(v) => onChange(i, v)} />
      ))}
    </div>
  );
}


/* ---------- shared sheet / buttons / password ---------- */
export const btnPrimary = { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: C.navy700, color: "#fff", border: "none", borderRadius: 9, padding: "12px 16px", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, cursor: "pointer" };
export const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#fff", color: C.navy700, border: `1.5px solid ${C.border}`, borderRadius: 9, padding: "9px 14px", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, cursor: "pointer" };
export function Sheet({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(14,35,56,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bgPanel, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", borderRadius: "14px 14px 0 0", padding: "18px 18px calc(22px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: C.navy900 }}>{title}</div>
          {onClose && <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={22} color={C.slate600} /></button>}
        </div>
        {children}
      </div>
    </div>
  );
}
function ChangePassword({ forced, onDone, onCancel }) {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setErr("New password must be at least 8 characters");
    if (pw !== pw2) return setErr("The two new passwords don't match");
    setBusy(true); setErr("");
    try { await api.changePassword(cur, pw); onDone(); } catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return (
    <Sheet title={forced ? "Set your new password" : "Change password"} onClose={forced ? undefined : onCancel}>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        {forced && <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.slate600 }}>You signed in with a temporary password. Choose your own to continue.</div>}
        <Field label={forced ? "Temporary password" : "Current password"}><TextInput type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} /></Field>
        <Field label="New password (8+ characters)"><TextInput type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
        <Field label="Repeat new password"><TextInput type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></Field>
        {err && <div role="alert" style={{ color: C.red700, background: C.redBg, borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: FONT_BODY }}>{err}</div>}
        <button type="submit" disabled={busy || !cur || !pw || !pw2} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </Sheet>
  );
}

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, toast.type === "error" ? 7000 : 4000);
    return () => clearTimeout(t);
  }, [toast]); // eslint-disable-line
  if (!toast) return null;
  const err = toast.type === "error";
  const Icon = err ? AlertTriangle : CheckCircle2;
  return (
    <div role={err ? "alert" : "status"} onClick={onClose} className="toast-pop" style={{
      position: "fixed", left: 12, right: 12, top: "calc(env(safe-area-inset-top) + 10px)", maxWidth: 480, margin: "0 auto", zIndex: 90,
      display: "flex", gap: 10, alignItems: "flex-start", background: err ? C.redBg : C.tealBg, color: err ? C.red700 : C.teal700,
      border: `1.5px solid ${err ? C.red700 : C.teal700}`, borderRadius: 12, padding: "12px 14px", boxShadow: "0 8px 28px rgba(0,0,0,0.18)", cursor: "pointer", fontFamily: FONT_BODY,
    }}>
      <Icon size={20} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{toast.title}</div>
        {toast.body && <div style={{ fontSize: 13, marginTop: 2, color: C.ink900 }}>{toast.body}</div>}
      </div>
    </div>
  );
}
function ReadOnly({ value, empty }) {
  return (
    <div title="Filled in automatically" style={{ ...inputStyle, background: "#EEF1F5", color: value ? C.ink900 : C.slate400, display: "flex", alignItems: "center", gap: 7, cursor: "not-allowed", minHeight: 42 }}>
      <Lock size={13} color={C.slate400} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || empty}</span>
    </div>
  );
}
const FIELD_LABEL = {
  bank: "Bank", atm: "ATM", date: "Date", startTime: "Start time", endTime: "End time",
  faultCategory: "Fault category", description: "Description of repair", checklist: "Checklist items",
custodian1Name: "Custodian 1 name", custodian1Signature: "Custodian 1 signature",
  custodian2Name: "Custodian 2 name", custodian2Signature: "Custodian 2 signature",
};

/* ---------- New Job Card form ---------- */
function NewJobForm({ nextJobNo, onCreate, atms = [], engineer, notify }) {
  const DRAFT_KEY = "jc_draft_" + (engineer?.id ?? "x");
  const blank = {
    atmId: null, bank: "",
    date: new Date().toISOString().slice(0, 10), startTime: "", endTime: "",
    faultCategory: "", description: "", partsUsed: "", status: "In Service",
    checklist: blankChecklist(), notes: "",
    custodian1Name: "", custodian1Signature: "",
    custodian2Name: "", custodian2Signature: "",
  };
  const draft = useMemo(() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; } }, []); // eslint-disable-line
  const [jobType, setJobType] = useState(draft?.jobType || "repair");
  const [form, setForm] = useState(draft?.form ? { ...blank, ...draft.form } : blank);
  const [padKey, setPadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const banks = useMemo(() => [...new Set(atms.map(a => a.bank).filter(Boolean))].sort((x, y) => x.localeCompare(y)), [atms]);
  const atm = atms.find(a => a.id === form.atmId) || null; // site/model/serial always come from the database
  const includeGbna = !!atm?.has_gbna;                       // GBNA checks only exist on ATMs fitted with one

  // autosave draft so a dropped signal / accidental refresh never loses a card
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ jobType, form, includeGbna })); } catch { /* storage full/blocked */ } }, 600);
    return () => clearTimeout(t);
  }, [jobType, form, includeGbna]); // eslint-disable-line
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = (key, idx, v) => setForm(f => {
    const arr = [...f.checklist[key]];
    arr[idx] = v;
    return { ...f, checklist: { ...f.checklist, [key]: arr } };
  });
  const markAllDone = (key) => setForm(f => ({ ...f, checklist: { ...f.checklist, [key]: f.checklist[key].map(x => x ?? "ok") } }));

  const pickBank = (e) => {
    const bank = e.target.value;
    setForm(f => (f.atmId && atms.find(a => a.id === f.atmId)?.bank === bank) ? { ...f, bank } : { ...f, bank, atmId: null });
  };
  const pickAtm = (a) => setForm(f => a ? { ...f, atmId: a.id, bank: a.bank || f.bank } : { ...f, atmId: null });

  // everything that must be filled before a card can be filed
  const errors = useMemo(() => {
    const e = {};
    if (!form.bank) e.bank = "Choose the bank";
    if (!atm) e.atm = form.bank ? "Choose the ATM from the list" : "Choose a bank, then the ATM";
    if (!form.date) e.date = "Pick the service date";
    if (!form.startTime) e.startTime = "Enter the start time";
    if (!form.endTime) e.endTime = "Enter the end time";
    if (jobType === "repair") {
      if (!form.faultCategory) e.faultCategory = "Select the fault category";
      if (!form.description.trim()) e.description = "Describe what was faulty and what you did";
    } else {
      const missing = {};
      PM_SECTIONS.filter(sec => sec.key !== "gbna" || includeGbna).forEach(sec => {
        const n = form.checklist[sec.key].filter(v => !v).length;
        if (n) missing[sec.key] = n;
      });
      if (Object.keys(missing).length) e.checklist = missing;
    }
    if (!form.custodian1Name.trim()) e.custodian1Name = "Enter the custodian's name";
    if (!form.custodian1Signature) e.custodian1Signature = "The custodian must sign";
    if (form.custodian2Name.trim() && !form.custodian2Signature) e.custodian2Signature = "Signature missing (or clear the name)";
    if (form.custodian2Signature && !form.custodian2Name.trim()) e.custodian2Name = "Name missing for this signature";
    return e;
  }, [form, atm, jobType, includeGbna]);
  const show = (k) => (attempted ? errors[k] : undefined);

  const handleSubmit = async () => {
    if (saving) return;
    const keys = Object.keys(FIELD_LABEL).filter(k => errors[k]);
    if (keys.length) {
      setAttempted(true);
      const names = keys.map(k => k === "checklist"
        ? `${Object.values(errors.checklist).reduce((a, b) => a + b, 0)} checklist item(s)` : FIELD_LABEL[k]);
      notify({
        type: "error",
        title: keys.length === 1 ? "One thing is missing" : `${keys.length} things are missing`,
        body: names.slice(0, 5).join(" · ") + (names.length > 5 ? ` · +${names.length - 5} more` : ""),
      });
      const first = keys[0];
      const id = first === "checklist" ? `f-checklist-${Object.keys(errors.checklist)[0]}` : `f-${first}`;
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    const checklist = { ...form.checklist };
    if (!includeGbna) delete checklist.gbna; // GBNA is optional
    // bank / site / ATM / model / serial are taken from the database record, never from typed text
    const record = { ...form, checklist, jobType, atmId: atm.id, bank: atm.bank, site: atm.location, atmName: atm.terminal_id, model: atm.model || "", serialNumber: atm.serial_number || "", technician: engineer?.name || "" };
    setSaving(true);
    const saved = await onCreate(record);
    setSaving(false);
    if (!saved) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
    setForm(blank);
    setAttempted(false);
    setPadKey(k => k + 1);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {JOB_TYPES.map(t => {
          const active = jobType === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setJobType(t.key)} style={{
              flex: 1, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, letterSpacing: 0.2,
              padding: "9px 6px", borderRadius: 8, cursor: "pointer",
              border: active ? `1.5px solid ${C.navy700}` : `1.5px solid ${C.border}`,
              background: active ? C.navy700 : C.bgPanel, color: active ? "#fff" : C.slate600,
            }}>
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600, color: C.navy900, letterSpacing: 0.3 }}>
            {jobType === "repair" ? "New Repair Job Card" : "New Preventive Maintenance Card"}
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.slate600, marginTop: 2 }}>
            Fields marked <span style={{ color: C.red700 }}>*</span> are required
          </div>
        </div>
        <StampBadge jobNo={nextJobNo} />
      </div>

      <div className="form-grid" style={{
        background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10,
        padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16,
      }}>
        <Field label="Bank" id="f-bank" required error={show("bank")}>
          <select value={form.bank} onChange={pickBank} style={inputStyle}>
            <option value="">Select bank…</option>
            {banks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Date" id="f-date" required error={show("date")}><TextInput type="date" value={form.date} onChange={set("date")} /></Field>
        <Field label="ATM" span id="f-atm" required error={show("atm")}>
          <AtmPicker atms={atms} bank={form.bank} value={form.atmId} onPick={pickAtm} />
        </Field>
        <Field label="Location / Site"><ReadOnly value={atm?.location} empty="Auto-filled from ATM" /></Field>
        <Field label="Model / Type"><ReadOnly value={atm?.model} empty="Auto-filled from ATM" /></Field>
        <Field label="Serial Number"><ReadOnly value={atm ? (atm.serial_number || "Not on record") : ""} empty="Auto-filled from ATM" /></Field>
        <div />
        <Field label="CE Start Time" id="f-startTime" required error={show("startTime")}><TimeInput value={form.startTime} onChange={v => setForm(f => ({ ...f, startTime: v }))} /></Field>
        <Field label="CE End Time" id="f-endTime" required error={show("endTime")}><TimeInput value={form.endTime} onChange={v => setForm(f => ({ ...f, endTime: v }))} /></Field>

        {jobType === "maintenance" && (
          <Field label="ATM Status After Visit" span><Select options={STATUS_OPTS} value={form.status} onChange={set("status")} /></Field>
        )}
        {jobType === "repair" && (
          <>
            <Field label="Fault Category" id="f-faultCategory" required error={show("faultCategory")}><Select options={FAULT_CATEGORIES} value={form.faultCategory} onChange={set("faultCategory")} /></Field>
            <Field label="Status After Repair"><Select options={STATUS_OPTS} value={form.status} onChange={set("status")} /></Field>
            <Field label="Description of Repair" span id="f-description" required error={show("description")}>
              <TextArea value={form.description} onChange={set("description")} placeholder="What was faulty, and what was done…" />
            </Field>
            <Field label="Spare Parts / Compound Used" span>
              <TextInput value={form.partsUsed} onChange={set("partsUsed")} placeholder="e.g. Pre-head sensor" />
            </Field>
          </>
        )}
      </div>

      {jobType === "maintenance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
          {PM_SECTIONS.filter(sec => sec.key !== "gbna" || includeGbna).map(sec => (
            <ChecklistSection
              key={sec.key} section={sec} values={form.checklist[sec.key]}
              invalid={attempted && !!errors.checklist?.[sec.key]}
              onChange={(idx, v) => setCheck(sec.key, idx, v)} onAll={() => markAllDone(sec.key)}
            />
          ))}
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
            <Field label="Notes / Remarks (describe any Not OK items)">
              <TextArea value={form.notes} onChange={set("notes")} placeholder="Anything else observed during the service…" />
            </Field>
          </div>
        </div>
      )}

      <div className="form-grid" style={{
        background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10,
        padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
      }}>
        <Field label="Custodian 1 – Name" id="f-custodian1Name" required error={show("custodian1Name")}><TextInput value={form.custodian1Name} onChange={set("custodian1Name")} /></Field>
        <div />
        <Field label="Custodian 1 – Signature" span id="f-custodian1Signature" required error={show("custodian1Signature")}>
          <SignaturePad
            resetKey={padKey}
            value={form.custodian1Signature}
            onChange={sig => setForm(f => ({ ...f, custodian1Signature: sig }))}
          />
        </Field>

        <Field label="Custodian 2 – Name (optional)" id="f-custodian2Name" error={show("custodian2Name")}><TextInput value={form.custodian2Name} onChange={set("custodian2Name")} /></Field>
        <div />
        <Field label="Custodian 2 – Signature (optional)" span id="f-custodian2Signature" error={show("custodian2Signature")}>
          <SignaturePad
            resetKey={padKey}
            value={form.custodian2Signature}
            onChange={sig => setForm(f => ({ ...f, custodian2Signature: sig }))}
          />
        </Field>
      </div>

      <div className="save-bar">
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            width: "100%", fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 600,
            letterSpacing: 0.5, color: "#fff", background: saving ? C.slate400 : C.navy700,
            border: "none", borderRadius: 10, padding: "14px 0", cursor: saving ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(14,35,56,0.25)",
          }}
        >
          <Stamp size={18} /> {saving ? "Submitting…" : "File Job Card"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Log view ---------- */
function LogView({ jobs, onPrint, isAdmin, onVoid }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter(j => {
      if (typeFilter && j.jobType !== typeFilter) return false;
      if (statusFilter && j.status !== statusFilter) return false;
      if (!q) return true;
      return [j.bank, j.site, j.atmName, j.technician, String(j.jobNo), j.faultCategory].join(" ").toLowerCase().includes(q);
    }).sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.jobNo - a.jobNo);
  }, [jobs, query, statusFilter, typeFilter]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600, color: C.navy900, marginBottom: 14 }}>
        Job Log <span style={{ color: C.slate400, fontSize: 16 }}>({filtered.length})</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={16} color={C.slate400} style={{ position: "absolute", left: 11, top: 12 }} />
          <TextInput value={query} onChange={e => setQuery(e.target.value)} placeholder="Search bank, site, ATM, technician…" style={{ paddingLeft: 34 }} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inputStyle, width: 170 }}>
          <option value="">All card types</option>
          {JOB_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 170 }}>
          <option value="">All statuses</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.slate400, fontFamily: FONT_BODY, fontSize: 14, border: `1.5px dashed ${C.border}`, borderRadius: 10 }}>
          No job cards match. Try a different search, or file a new one.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(j => {
          const st = jobStatusMeta(j);
          const StIcon = st.icon;
          const TypeIcon = j.jobType === "maintenance" ? ClipboardList : Wrench;
          return (
            <div key={j.jobNo} onClick={() => setSelected(j)} style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <StampBadge jobNo={j.jobNo} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, color: C.ink900, display: "flex", alignItems: "center", gap: 6 }}>
                    <TypeIcon size={13} color={C.slate400} /> {j.bank} · {j.site}
                  </div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.slate600, marginTop: 2, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span><MapPin size={12} style={{ verticalAlign: -1 }} /> ATM {j.atmName || "—"}</span>
                    <span>{fmtDate(j.date)}</span>
                    {j.jobType === "maintenance" ? <span>Preventive Maintenance</span> : (j.faultCategory && <span>{j.faultCategory}</span>)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: st.fg, background: st.bg, borderRadius: 20, padding: "5px 10px", whiteSpace: "nowrap" }}>
                  <StIcon size={13} /> {st.label}
                </div>
                <button onClick={(e) => { e.stopPropagation(); onPrint(j); }} title="Download / Print PDF"
                  style={{ background: C.bgPage, border: `1px solid ${C.border}`, borderRadius: 7, padding: 7, cursor: "pointer", display: "flex", flexShrink: 0 }}>
                  <FileDown size={15} color={C.navy700} />
                </button>
                <ChevronRight size={18} color={C.slate400} />
              </div>
            </div>
          );
        })}
      </div>
      {selected && <JobDetailModal job={selected} onClose={() => setSelected(null)} onPrint={onPrint} isAdmin={isAdmin} onVoid={onVoid} />}
    </div>
  );
}

function JobDetailModal({ job: jobProp, onClose, onPrint, isAdmin, onVoid }) {
  const [sigs, setSigs] = useState({});
  useEffect(() => {
    api.getJob(jobProp.jobNo).then(r => {
      const f = fromRow(r);
      setSigs({ technicianSignature: f.technicianSignature, custodian1Signature: f.custodian1Signature, custodian2Signature: f.custodian2Signature });
    }).catch(() => {});
  }, [jobProp.jobNo]);
  const job = { ...jobProp, ...sigs };
  const st = jobStatusMeta(job);
  const dur = durationMinutes(job.startTime, job.endTime);
  const isPM = job.jobType === "maintenance";
  const cl = job.checklist || {};
  const label = { fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: C.slate400, textTransform: "uppercase", letterSpacing: 0.5 };
  const Row = ({ label: l, value }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={label}>{l}</div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 15, color: C.ink900, marginTop: 2 }}>{value || "—"}</div>
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(14,35,56,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bgPanel, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto", borderRadius: "14px 14px 0 0", padding: 22, boxShadow: "0 -8px 30px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
          <img src="/logo.png" alt="TechMasters" style={{ width: "100%", maxHeight: 70, objectFit: "contain" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <StampBadge jobNo={job.jobNo} size="lg" />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isAdmin && (
              <button onClick={async () => {
                const reason = window.prompt(`Void job card No.${job.jobNo}? Give a reason (it stays in the audit log and can be restored):`);
                if (!reason || reason.trim().length < 3) return;
                await onVoid(job.jobNo, reason.trim()); onClose();
              }} style={{ background: "#fff", color: C.red700, border: `1.5px solid ${C.red700}`, borderRadius: 7, padding: "7px 11px", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700 }}>Void</button>
            )}
            <button onClick={() => onPrint(job)} style={{ display: "flex", alignItems: "center", gap: 6, background: C.navy700, color: "#fff", border: "none", borderRadius: 7, padding: "8px 12px", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700 }}>
              <FileDown size={14} /> PDF
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={22} color={C.slate600} /></button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: st.fg, background: st.bg, borderRadius: 20, padding: "5px 10px" }}>{st.label}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: C.navy700, background: C.blueBg, borderRadius: 20, padding: "5px 10px" }}>
            {isPM ? <ClipboardList size={13} /> : <Wrench size={13} />} {isPM ? "Preventive Maintenance" : "Repair"}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          <Row label="Bank" value={job.bank} />
          <Row label="Site" value={job.site} />
          <Row label="ATM Name" value={job.atmName} />
          <Row label="Model / Type" value={job.model} />
          <Row label="Serial Number" value={job.serialNumber} />
          <Row label="Date" value={fmtDate(job.date)} />
          <Row label="Service Window" value={job.startTime && job.endTime ? `${job.startTime} – ${job.endTime} (${fmtDuration(dur)})` : "—"} />
          {!isPM && <Row label="Fault Category" value={job.faultCategory} />}
        </div>
        {isPM ? (
          <>
            {PM_SECTIONS.filter(sec => sec.key !== "gbna" || cl.gbna).map(sec => (
              <div key={sec.key} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.navy900, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{sec.title}</div>
                {sec.items.map((text, i) => {
                  const m = PM_STATUS[(cl[sec.key] && cl[sec.key][i]) || ""] || { label: "Not marked", color: C.slate400, icon: PauseCircle };
                  const MIcon = m.icon;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
                      <MIcon size={15} color={m.color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 13, color: C.ink900, lineHeight: 1.35 }}>{text}</div>
                      <div style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: m.color, whiteSpace: "nowrap" }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
            ))}
            {job.notes && <Row label="Notes / Remarks" value={job.notes} />}
          </>
        ) : (
          <>
            <Row label="Description of Repair" value={job.description} />
            <Row label="Parts / Compound Used" value={job.partsUsed} />
          </>
        )}
        <div style={{ ...label, marginBottom: 8 }}>Engineer Sign-off</div>
        <SignatureCard name={job.technician} sig={job.technicianSignature} full />
        <div style={{ ...label, margin: "14px 0 8px" }}>Custodian Sign-off</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
          <SignatureCard name={job.custodian1Name} sig={job.custodian1Signature} />
          <SignatureCard name={job.custodian2Name} sig={job.custodian2Signature} />
        </div>
      </div>
    </div>
  );
}

function SignatureCard({ name, sig, full }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{
        height: 60, display: "flex", alignItems: "center", justifyContent: "center",
        background: C.bgPage, borderRadius: 6, marginBottom: 6, overflow: "hidden",
      }}>
        {sig
          ? <img src={sig} alt="signature" style={{ maxWidth: "100%", maxHeight: "100%" }} />
          : <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.slate400 }}>No signature</span>}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: C.ink900, textAlign: "center" }}>
        {name || "—"}
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div style={{
      background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: "16px 18px", flex: "1 1 150px", minWidth: 140,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ background: accent + "1c", color: accent, borderRadius: 6, padding: 6, display: "flex" }}>
          <Icon size={16} />
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: C.slate600, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {label}
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700, color: C.navy900 }}>{value}</div>
    </div>
  );
}

function MiniBarChart({ data, dataKey = "count", color }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontFamily: FONT_BODY, fontSize: 12, fill: C.ink900 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ fontFamily: FONT_BODY, fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} cursor={{ fill: C.bgPage }} />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} fill={color} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Dashboard({ jobs }) {
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = jobs.filter(j => {
      const d = new Date(j.date + "T00:00:00");
      return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const group = (keyFn, src) => {
      const m = {};
      src.forEach(j => { const k = keyFn(j) || "Unspecified"; m[k] = (m[k] || 0) + 1; });
      return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    };
    const repairs = jobs.filter(j => j.jobType !== "maintenance");
    const pms = jobs.filter(j => j.jobType === "maintenance");
    return {
      total: jobs.length, thisMonth, repairs: repairs.length, pms: pms.length,
      attention: pms.filter(j => checklistSummary(j.checklist).fail > 0).length,
      bySite: group(j => j.site, jobs), byFault: group(j => j.faultCategory, repairs),
    };
  }, [jobs]);
  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600, color: C.navy900, marginBottom: 16 }}>Dashboard</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard icon={ClipboardList} label="Total Cards" value={stats.total} accent={C.navy500} />
        <StatCard icon={TrendingUp} label="This Month" value={stats.thisMonth} accent={C.teal700} />
        <StatCard icon={Wrench} label="Repairs" value={stats.repairs} accent={C.amber600} />
        <StatCard icon={ClipboardList} label="Preventive Maint." value={stats.pms} accent={C.navy700} />
        <StatCard icon={AlertTriangle} label="PM: Not OK Items" value={stats.attention} accent={C.amber600} />
      </div>
      {jobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: C.slate400, fontFamily: FONT_BODY, fontSize: 14, border: `1.5px dashed ${C.border}`, borderRadius: 10 }}>
          File a few job cards to see trends here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel title="Jobs by Branch / Site" icon={MapPin}><MiniBarChart data={stats.bySite} color={C.navy500} /></Panel>
          {stats.byFault.length > 0 && <Panel title="Repairs by Fault Category" icon={Wrench}><MiniBarChart data={stats.byFault} color={C.amber600} /></Panel>}
        </div>
      )}
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <Icon size={16} color={C.navy700} />
        <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: C.navy900 }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

/* ---------- App shell ---------- */
const TABS = [
  { key: "new", label: "New Card", icon: Plus },
  { key: "log", label: "Log", icon: ClipboardList },
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
];

function JobCardSystem({ user, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [atms, setAtms] = useState([]);
  const [showPw, setShowPw] = useState(false);
  const [toast, setToast] = useState(null);
  const notify = useCallback((t) => setToast({ ...t, id: Date.now() }), []);
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState("");
  const [tab, setTab] = useState("new");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await api.bootstrap();
        if (!cancelled) {
          setJobs(data.jobs.map(fromRow));
          setAtms(data.atms);
        }
      } catch (err) {
        console.error("Failed to load data:", err.message);
        if (!cancelled) setDatabaseError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const nextJobNo = useMemo(() => {
    const max = jobs.reduce((m, j) => Math.max(m, Number(j.jobNo) || 0), 11416);
    return max + 1;
  }, [jobs]);

  const reloadAtms = useCallback(async () => {
    try { setAtms((await api.bootstrap()).atms); } catch { /* keep current list */ }
  }, []);
  const handleVoid = useCallback(async (jobNo, reason) => {
    try {
      await api.admin("POST", `jobs/${jobNo}/void`, { reason });
      setJobs(prev => prev.filter(j => j.jobNo !== jobNo));
    } catch (e) { window.alert("Couldn't void this card: " + e.message); }
  }, []);
  const handleCreate = useCallback(async (record) => {
    try {
      const saved = fromRow(await api.createJob(toRow({ ...record, technician: record.technician || user.name })));
      setJobs(prev => [...prev, saved]);
      setTab("log");
      notify({ type: "success", title: `Job card No.${saved.jobNo} submitted`, body: [saved.bank, saved.site].filter(Boolean).join(" · ") });
      return saved;
    } catch (err) {
      console.error("Failed to save job card:", err.message);
      notify({ type: "error", title: "Couldn't submit - your entries are kept", body: err.message + ". Check your connection and tap File Job Card again." });
    }
  }, []);

  const [printJob, setPrintJob] = useState(null);

  const handlePrint = useCallback(async (job) => {
    let full = job;
    try { full = { ...job, ...fromRow(await api.getJob(job.jobNo)) }; } catch { /* print without signatures */ }
    setPrintJob(full);
    // PDF file name = document title
    const prev = document.title;
    document.title = `JobCard-${full.jobNo}${full.atmName ? "-" + full.atmName : ""}`;
    window.addEventListener("afterprint", () => { document.title = prev; }, { once: true });
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }, []);


  return (
    <div className="app-root" style={{ minHeight: "100vh", background: C.bgPage, fontFamily: FONT_BODY }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { border-color: ${C.navy500} !important; }
        @keyframes stampPop {
          0% { opacity: 0; transform: scale(1.4) rotate(-3deg); }
          60% { opacity: 1; transform: scale(0.96) rotate(-3deg); }
          100% { opacity: 1; transform: scale(1) rotate(-3deg); }
        }
        .stamp-pop { animation: stampPop 0.32s ease-out; }
        @media (max-width: 640px) {
          .jc-form-grid { grid-template-columns: 1fr !important; }
        }
        button, select { touch-action: manipulation; }
        .app-header { position: sticky; top: 0; z-index: 30; padding-top: calc(10px + env(safe-area-inset-top)) !important; }
        .save-bar { position: sticky; bottom: 0; z-index: 25; padding: 12px 0 4px; background: linear-gradient(to bottom, transparent, ${C.bgPage} 35%); }
        @media (max-width: 640px) {
          .form-grid { grid-template-columns: 1fr !important; padding: 14px !important; gap: 12px !important; }
          .form-grid > div { grid-column: 1 / -1 !important; }
          .form-grid > div:empty { display: none; }
          input, select, textarea { font-size: 16px !important; min-height: 46px; }
          button { min-height: 44px; }
          .tabs-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -2px 12px rgba(0,0,0,0.15); }
          .content-pad { padding: 14px 12px calc(90px + env(safe-area-inset-bottom)) !important; }
          .save-bar { bottom: calc(58px + env(safe-area-inset-bottom)); }
        }
        @keyframes toastIn { from { transform: translateY(-16px); opacity: 0 } to { transform: none; opacity: 1 } }
        .toast-pop { animation: toastIn .22s ease-out; }
        @page { size: A4 portrait; margin: 0; }
        #print-area { display: none; }
        @media print {
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          html, body { margin: 0; background: #fff; }
          .no-print { display: none !important; }
          .app-root { background: #fff !important; min-height: 0 !important; }
          #print-area { display: block !important; padding: 10mm; break-inside: avoid; page-break-after: avoid; }
          #print-area table, #print-area tr { break-inside: avoid; }
        }
      `}</style>

      <Toast toast={toast} onClose={() => setToast(null)} />
      {showPw && <ChangePassword onDone={() => setShowPw(false)} onCancel={() => setShowPw(false)} />}

      {/* header */}
      <div className="no-print app-header" style={{ background: "#fff", borderBottom: `3px solid ${C.navy900}`, padding: "10px 18px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="TechMasters" style={{ flex: 1, minWidth: 0, maxHeight: 54, objectFit: "contain", objectPosition: "left" }} />
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: C.navy900 }}>{user.name}</div>
            <button onClick={() => setShowPw(true)} style={{ background: "none", border: "none", padding: 0, marginRight: 10, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 11.5, color: C.navy500, fontWeight: 600 }}>Password</button>
            <button onClick={onLogout} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 11.5, color: C.red700, fontWeight: 600 }}>Sign out</button>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="no-print tabs-bar" style={{ background: C.navy700, borderBottom: `1px solid ${C.navy900}` }}>
        <div style={{ maxWidth: 780, margin: "0 auto", display: "flex" }}>
          {(user.admin ? [...TABS, { key: "admin", label: "Admin", icon: Settings }] : TABS).map(t => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1, background: active ? C.bgPage : "transparent", border: "none",
                borderBottom: active ? `3px solid ${C.amber500}` : "3px solid transparent",
                color: active ? C.navy900 : "#C7D5E3", fontFamily: FONT_BODY, fontWeight: 700,
                fontSize: 13, padding: "12px 6px", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="no-print content-pad" style={{ padding: "22px 16px 60px" }}>
        {databaseError ? (
          <div role="alert" style={{ maxWidth: 780, margin: "30px auto", padding: 16, background: C.redBg, color: C.red700, borderRadius: 8, fontFamily: FONT_BODY }}>
            Could not load data: {databaseError}
          </div>
        ) : loading ? (
          <div style={{ textAlign: "center", color: C.slate400, fontFamily: FONT_BODY, padding: 60 }}>Loading job cards…</div>
        ) : tab === "new" ? (
          <NewJobForm notify={notify} nextJobNo={nextJobNo} onCreate={handleCreate} atms={atms} engineer={{ id: user.id, name: user.name }} />
        ) : tab === "log" ? (
          <LogView jobs={jobs} onPrint={handlePrint} isAdmin={user.admin} onVoid={handleVoid} />
        ) : tab === "admin" && user.admin ? (
          <Suspense fallback={<div style={{ textAlign: "center", color: C.slate400, padding: 40, fontFamily: FONT_BODY }}>Loading…</div>}>
            <Admin onAtmsChanged={reloadAtms} />
          </Suspense>
        ) : (
          <Dashboard jobs={jobs} />
        )}
      </div>

      <div id="print-area">
        <PrintableJobCard job={printJob} />
      </div>
    </div>
  );
}


/* ---------- auth shell ---------- */
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { onLogin(await api.login(email.trim(), password)); }
    catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return (
    <div style={{ minHeight: "100vh", background: C.bgPage, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FONT_BODY }}>
      <form onSubmit={submit} style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, width: "100%", maxWidth: 380 }}>
        <img src="/logo.png" alt="TechMasters" style={{ width: "100%", maxHeight: 70, objectFit: "contain", marginBottom: 14 }} />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: C.navy900, marginBottom: 14 }}>Job Card System</div>
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Email"><TextInput type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Password"><TextInput type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
          {err && <div role="alert" style={{ color: C.red700, background: C.redBg, borderRadius: 6, padding: "8px 10px", fontSize: 13 }}>{err}</div>}
          <button type="submit" disabled={busy || !email || !password} style={{ background: C.navy700, color: "#fff", border: "none", borderRadius: 7, padding: "11px", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Root() {
  const [user, setUser] = useState(undefined);
  useEffect(() => { api.me().then(setUser).catch(() => setUser(null)); }, []);
  if (user === undefined) return <div style={{ textAlign: "center", padding: 60, color: C.slate400, fontFamily: FONT_BODY }}>Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;
  if (user.mustChange) return (
    <div style={{ minHeight: "100vh", background: C.bgPage }}>
      <ChangePassword forced onDone={() => api.me().then(setUser)} />
    </div>
  );
  return <JobCardSystem user={user} onLogout={async () => { await api.logout().catch(() => {}); setUser(null); }} />;
}
