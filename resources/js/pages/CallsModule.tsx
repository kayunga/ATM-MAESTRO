// @ts-nocheck
/* eslint-disable */
import { useState, useEffect, useCallback } from "react";
import CallsAnalytics from "./CallsAnalytics";

// ─── PDF Export ──────────────────────────────────────────────────────────────
async function loadJsPDF() {
  if ((window as any).jspdf) return (window as any).jspdf.jsPDF;
  await new Promise<void>((res,rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=()=>res(); s.onerror=()=>rej(new Error("jsPDF load failed"));
    document.head.appendChild(s);
  });
  await new Promise<void>((res,rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
    s.onload=()=>res(); s.onerror=()=>rej(new Error("autotable load failed"));
    document.head.appendChild(s);
  });
  return (window as any).jspdf.jsPDF;
}

async function exportCallsPDF(calls: any[], filters: any, onError: (m:string)=>void) {
  if (calls.length === 0) { onError("No calls to export."); return; }
  try {
    const JsPDF = await loadJsPDF();
    const doc   = new JsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
    const W     = 297;
    const now   = new Date().toLocaleString("en-GB");

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const ri = (n:number) => Math.round(n);

    // Draw a filled rounded rectangle (jsPDF roundedRect is unreliable)
    const filledRounded = (x:number,y:number,w:number,h:number,r:number,style:"F"|"FD"="F") => {
      r = Math.min(r, w/2, h/2);
      doc.moveTo(x+r, y);
      doc.lineTo(x+w-r, y);
      doc.curveTo(x+w, y, x+w, y, x+w, y+r);
      doc.lineTo(x+w, y+h-r);
      doc.curveTo(x+w, y+h, x+w, y+h, x+w-r, y+h);
      doc.lineTo(x+r, y+h);
      doc.curveTo(x, y+h, x, y+h, x, y+h-r);
      doc.lineTo(x, y+r);
      doc.curveTo(x, y, x, y, x+r, y);
      doc.close();
      if (style==="FD") doc.fillStroke(); else doc.fill();
    };

    // ─── Header ───────────────────────────────────────────────────────────────
    doc.setFillColor(29,110,245);
    doc.rect(0,0,W,20,"F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(13); doc.setFont("helvetica","bold");
    doc.text("NCR Fleet — Calls Report", 14, 8);
    doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text(`Generated: ${now}   ·   Total: ${calls.length} calls`, 14, 15);
    doc.setFontSize(10); doc.setFont("helvetica","bold");
    doc.text(filters.periodLabel ?? "Custom Period", W-14, 8, {align:"right"});
    doc.setFontSize(8); doc.setFont("helvetica","normal");
    doc.text(`${filters.dateFrom}  →  ${filters.dateTo}`, W-14, 15, {align:"right"});

    // ─── Filter strip ─────────────────────────────────────────────────────────
    doc.setFillColor(238,243,254);
    doc.rect(0,20,W,8,"F");
    doc.setTextColor(29,110,245);
    doc.setFontSize(7.5); doc.setFont("helvetica","italic");
    const fParts:string[] = [];
    if (filters.status   && filters.status   !== "all") fParts.push(`Status: ${filters.status}`);
    if (filters.priority && filters.priority !== "all") fParts.push(`Priority: ${filters.priority}`);
    if (filters.type     && filters.type     !== "all") fParts.push(`Type: ${filters.type}`);
    doc.text(`Filters: ${fParts.length ? fParts.join("   ·   ") : "All records"}`, 14, 25.5);

    // ─── Summary cards ────────────────────────────────────────────────────────
    const total    = calls.length;
    const closed   = calls.filter(c=>c.status==="resolved"||c.status==="escalated").length;
    const active   = calls.filter(c=>c.status==="pending"||c.status==="assigned").length;
    const onHold   = calls.filter(c=>c.status==="on_hold").length;
    const breached = calls.filter(c=>c.sla_breached).length;
    const slamet   = calls.filter(c=>(c.status==="resolved"||c.status==="escalated")&&!c.sla_breached).length;
    const highP    = calls.filter(c=>c.priority==="high").length;
    const midP     = calls.filter(c=>c.priority==="medium").length;
    const lowP     = calls.filter(c=>c.priority==="low").length;

    const summaryCards = [
      {label:"Total Calls",   value:total,   r:29,  g:110,b:245},
      {label:"Closed",        value:closed,  r:16,  g:179,b:102},
      {label:"Pending/Active",value:active,  r:245, g:158,b:11 },
      {label:"On Hold",       value:onHold,  r:124, g:58, b:237},
      {label:"SLA Breached",  value:breached,r:239, g:68, b:68 },
      {label:"SLA Met",       value:slamet,  r:16,  g:179,b:102},
    ];

    const nCards = summaryCards.length;
    const cGap   = 2;
    const cW     = ri((W - 28 - cGap*(nCards-1)) / nCards);
    const cY     = 31; const cH = 14;

    summaryCards.forEach(({label,value,r,g,b},i) => {
      const cx = ri(14 + i*(cW+cGap));
      doc.setFillColor(r,g,b);
      filledRounded(cx,cY,cW,cH,2.5);
      doc.setTextColor(255,255,255);
      doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text(String(value), cx+cW/2, cY+6.5, {align:"center"});
      doc.setFontSize(5); doc.setFont("helvetica","normal");
      doc.text(label, cx+cW/2, cY+11.5, {align:"center"});
    });

    // ─── Priority row ─────────────────────────────────────────────────────────
    const pY  = cY+cH+2;
    const pW  = ri((W-28-4)/3);
    [
      {label:`${highP}  High Priority`,  r:239,g:68, b:68 },
      {label:`${midP}  Medium Priority`, r:245,g:158,b:11 },
      {label:`${lowP}  Low Priority`,    r:16, g:179,b:102},
    ].forEach(({label,r,g,b},i) => {
      const cx = ri(14 + i*(pW+2));
      doc.setFillColor(r,g,b);
      filledRounded(cx,pY,pW,8,2);
      doc.setTextColor(255,255,255);
      doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text(label, cx+6, pY+5.5);
    });

    // ─── Table ────────────────────────────────────────────────────────────────
    const tableY = pY+11;

    // Build rows — store SLA flags separately to avoid hidden column leak
    const slaFlags:string[] = [];
    const rows = calls.map((c,i) => {
      const parseD  = (s:any) => { if(!s) return null; const d=new Date(String(s).replace(" ","T")); return isNaN(d.getTime())?null:d; };
      const closedD = parseD(c.closed_at);
      const closedStr = closedD ? closedD.toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
      slaFlags.push(c.sla_breached ? "B" : (c.status==="resolved"||c.status==="escalated") ? "M" : "");
      const typeStr   = c.call_type ? c.call_type.charAt(0).toUpperCase()+c.call_type.slice(1) : "—";
      const priStr    = (c.priority??"").toUpperCase();
      const statStr   = (c.status??"").replace(/_/g," ").replace(/\w/g,(x:string)=>x.toUpperCase());
      return [
        String(i+1),
        c.atm?.bank?.short_code ?? "—",
        c.atm?.terminal_id ?? "—",
        c.atm?.location ?? "—",
        (c.fault_description??"").slice(0,55)+((c.fault_description?.length??0)>55?"…":""),
        typeStr,
        priStr,
        c.engineer?.name ?? "Unassigned",
        statStr,
        closedStr,
        (c.notes??"—").slice(0,40)+((c.notes?.length??0)>40?"…":""),
      ];
    });

    (doc as any).autoTable({
      startY:  tableY,
      margin:  {left:14, right:14},
      head:    [["#","Bank","ATM","Location","Fault","Type","Priority","Eng. Assigned","Status","Closed At","Notes"]],
      body:    rows,
      theme:   "striped",
      styles:  {fontSize:6.5, cellPadding:1.8, overflow:"linebreak", halign:"left", valign:"middle"},
      headStyles: {fillColor:[29,110,245], textColor:255, fontStyle:"bold", fontSize:7, cellPadding:2.5},
      columnStyles: {
        0:  {cellWidth:8,   halign:"center"},
        1:  {cellWidth:12},
        2:  {cellWidth:24,  fontStyle:"bold"},
        3:  {cellWidth:30},
        4:  {cellWidth:50},
        5:  {cellWidth:13},
        6:  {cellWidth:14},
        7:  {cellWidth:24},
        8:  {cellWidth:20},
        9:  {cellWidth:26},
        10: {cellWidth:48},
      },
      alternateRowStyles: {fillColor:[248,249,251]},
      didParseCell: (data:any) => {
        // Closed At — colour using slaFlags array by row index (now col 9)
        if (data.column.index===9 && data.section==="body") {
          const flag = slaFlags[data.row.index] ?? "";
          if      (flag==="B") { data.cell.styles.textColor=[239,68,68];  data.cell.styles.fontStyle="bold"; }
          else if (flag==="M") { data.cell.styles.textColor=[16,179,102]; data.cell.styles.fontStyle="bold"; }
        }
        // Priority colour (now col 6)
        if (data.column.index===6 && data.section==="body") {
          const v = (data.cell.raw??"").toString().toLowerCase();
          if      (v==="high")   data.cell.styles.textColor=[239,68,68];
          else if (v==="medium") data.cell.styles.textColor=[245,158,11];
          else if (v==="low")    data.cell.styles.textColor=[16,179,102];
          data.cell.styles.fontStyle = "bold";
        }
        // Status colour (now col 8)
        if (data.column.index===8 && data.section==="body") {
          const v = (data.cell.raw??"").toString().toLowerCase();
          if      (v==="resolved"||v==="escalated→bank") data.cell.styles.textColor=[16,179,102];
          else if (v==="assigned")                       data.cell.styles.textColor=[29,110,245];
          else if (v==="pending")                        data.cell.styles.textColor=[107,114,128];
          else if (v==="on hold")                        data.cell.styles.textColor=[124,58,237];
        }
      },
    });

    // ─── Footer ───────────────────────────────────────────────────────────────
    const pages = (doc as any).internal.getNumberOfPages();
    for (let p=1; p<=pages; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(150,150,150);
      doc.text(`NCR Fleet · Techmasters Zambia · Page ${p} of ${pages}`, W/2, 204, {align:"center"});
    }

    const slug = (filters.periodLabel??"custom").replace(/\s+/g,"-").toLowerCase();
    doc.save(`calls-report-${slug}-${filters.dateFrom}-${filters.dateTo}.pdf`);
  } catch(e:any) {
    onError(e.message??"Export failed.");
  }
}

// ─── Error Boundary ──────────────────────────────────────────────────────────
import React from "react";
class ErrorBoundary extends React.Component<{children:any},{error:string|null}> {
  constructor(p:any) { super(p); this.state={error:null}; }
  static getDerivedStateFromError(e:any) { return {error:e?.message??String(e)}; }
  render() {
    if (this.state.error) return (
      <div style={{padding:32,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>💥</div>
        <div style={{fontSize:15,fontWeight:700,color:"#ef4444",marginBottom:8}}>Calls module crashed</div>
        <div style={{fontSize:13,color:"#6b7280",background:"#f9fafb",borderRadius:10,
          padding:"12px 16px",maxWidth:500,margin:"0 auto",textAlign:"left",fontFamily:"monospace",wordBreak:"break-all"}}>
          {this.state.error}
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Bank     { id:number; name:string; short_code:string; }
interface Atm      { id:number; terminal_id:string; location:string; model:string; status:string; bank:Bank; }
interface Engineer { id:number; name:string; region:string; phone?:string; }
interface Call {
  id:number;
  call_type:"new"|"old"|"repeat";
  status:"pending"|"assigned"|"on_hold"|"escalated"|"resolved";
  priority:"low"|"medium"|"high";
  fault_description:string;
  notes?:string;
  resolution_notes?:string;
  assigned_at?:string;
  resolved_at?:string;
  escalated_at?:string;
  closed_at?:string;
  created_at:string;
  sla_breach_at?:string;
  sla_status:"active"|"breached"|"met"|"none";
  sla_minutes?:number;
  sla_hours_allowed?:number;
  sla_breached?:boolean;
  job_cards_count:number;
  atm:Atm;
  engineer?:Engineer;
  assigned_by?:string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  primary:"#1d6ef5", primaryLight:"#eef3fe",
  success:"#10b366", successLight:"#eafaf2",
  warning:"#f59e0b", warningLight:"#fffbeb",
  danger:"#ef4444",  dangerLight:"#fef2f2",
  surface:"#f8f9fb", border:"#e8eaed",
  text:"#1a1d23",    textMid:"#4b5260", textMuted:"#8b909a",
  white:"#ffffff",   purple:"#7c3aed", purpleLight:"#f5f3ff",
  teal:"#0891b2",    tealLight:"#ecfeff",
  accent:"#1d6ef5",  accentLight:"#eef3fe",
};

const PRIORITY_CFG:any = {
  high:   { color:"#ef4444", bg:"#fef2f2", label:"High",   dot:"#ef4444" },
  medium: { color:"#f59e0b", bg:"#fffbeb", label:"Medium", dot:"#f59e0b" },
  low:    { color:"#10b366", bg:"#eafaf2", label:"Low",    dot:"#10b366" },
};
const STATUS_CFG:any = {
  pending:   { color:"#6b7280", bg:"#f3f4f6",        label:"Pending"        },
  assigned:  { color:C.primary, bg:C.primaryLight,   label:"Assigned"       },
  on_hold:   { color:C.warning, bg:C.warningLight,   label:"On Hold"        },
  escalated: { color:C.success, bg:C.successLight,   label:"Escalated→Bank" },
  resolved:  { color:C.success, bg:C.successLight,   label:"Resolved"       },
};
const TYPE_CFG:any = {
  new:    { color:C.primary, bg:C.primaryLight, label:"New"    },
  old:    { color:C.warning, bg:C.warningLight, label:"Old"    },
  repeat: { color:C.danger,  bg:C.dangerLight,  label:"Repeat" },
};

function fmt(d?:string|null) {
  if (!d) return "—";
  const dt = new Date(String(d).replace(" ","T"));
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
}
function fmtTime(d?:string|null) {
  if (!d) return "—";
  const dt = new Date(String(d).replace(" ","T"));
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function getCSRF() {
  const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return (document.querySelector('meta[name="csrf-token"]') as any)?.content ?? "";
}

// ─── SLA helpers ─────────────────────────────────────────────────────────────
function slaLabel(call:Call) {
  if (call.sla_status==="none") return null;
  if (call.sla_status==="met")      return {text:"SLA Met",     color:"#10b366", bg:"#eafaf2"};
  if (call.sla_status==="breached") return {text:"SLA Breached",color:"#ef4444", bg:"#fef2f2"};
  const m = call.sla_minutes ?? 0;
  if (m <= 0) return {text:"SLA Breached", color:"#ef4444", bg:"#fef2f2"};
  const h = Math.floor(m/60), mins = m%60;
  const text = h>0 ? `${h}h ${mins}m left` : `${mins}m left`;
  const color = m < 30 ? "#ef4444" : m < 60 ? "#f59e0b" : "#1d6ef5";
  const bg    = m < 30 ? "#fef2f2" : m < 60 ? "#fffbeb" : "#eef3fe";
  return {text, color, bg};
}

function SLABadge({call}:{call:Call}) {
  const s = slaLabel(call);
  if (!s) return null;
  return (
    <span style={{background:s.bg,color:s.color,borderRadius:20,padding:"3px 9px",
      fontSize:11,fontWeight:700,whiteSpace:"nowrap",display:"inline-block"}}>
      ⏱ {s.text}
    </span>
  );
}

const Badge = ({cfg}:{cfg:any}) => (
  <span style={{background:cfg.bg,color:cfg.color,borderRadius:20,padding:"3px 10px",
    fontSize:11,fontWeight:700,whiteSpace:"nowrap",display:"inline-block"}}>
    {cfg.label}
  </span>
);

// ─── New / Edit Call Modal ────────────────────────────────────────────────────
const CallForm = ({atms,engineers,banks,initial,onSave,onClose}:any) => {
  const [form,setForm] = useState({
    atm_id:             initial?.atm?.id ?? "",
    call_type:          initial?.call_type ?? "new",
    priority:           initial?.priority ?? "medium",
    fault_description:  initial?.fault_description ?? "",
    notes:              initial?.notes ?? "",
    assigned_engineer_id: initial?.engineer?.id ?? "",
  });
  const [saving,setSaving] = useState(false);
  const set = (k:string)=>(v:any)=>setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.atm_id)                   { alert("Please select an ATM."); return; }
    if (!form.fault_description.trim()) { alert("Please describe the fault."); return; }
    setSaving(true);
    try {
      const url    = initial ? `/calls/${initial.id}` : "/calls";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type":"application/json", Accept:"application/json",
          "X-Requested-With":"XMLHttpRequest", "X-XSRF-TOKEN":getCSRF() },
        credentials: "same-origin",
        body: JSON.stringify({
          ...form,
          atm_id: Number(form.atm_id),
          assigned_engineer_id: form.assigned_engineer_id ? Number(form.assigned_engineer_id) : null,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.message||"Failed to save."); setSaving(false); return; }
      onSave();
    } finally { setSaving(false); }
  };

  const inputStyle:any = {width:"100%",padding:"10px 14px",borderRadius:10,
    border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",
    color:C.text,background:C.surface,outline:"none",boxSizing:"border-box"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      {/* ATM */}
      <div style={{marginBottom:16}}>
        <label style={{fontSize:13,fontWeight:600,color:C.textMid,display:"block",marginBottom:6}}>
          ATM <span style={{color:C.danger}}>*</span>
        </label>
        <select value={form.atm_id} onChange={e=>set("atm_id")(e.target.value)}
          style={{...inputStyle,appearance:"none"}} disabled={!!initial}>
          <option value="">— Select ATM —</option>
          {atms.map((a:any)=>(
            <option key={a.id} value={a.id}>{a.terminalId ?? a.terminal_id} · {a.location} ({(banks||[]).find((b:any)=>b.id===(a.bankId??a.bank_id))?.shortCode ?? ""})</option>
          ))}
        </select>
      </div>

      {/* Type + Priority */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:C.textMid,display:"block",marginBottom:6}}>Call Type</label>
          <div style={{display:"flex",gap:6}}>
            {(["new","old","repeat"] as const).map(t=>(
              <button key={t} type="button" onClick={()=>set("call_type")(t)} style={{
                flex:1,padding:"10px 4px",borderRadius:10,cursor:"pointer",fontFamily:"inherit",
                border:`1.5px solid ${form.call_type===t?TYPE_CFG[t].color:C.border}`,
                background:form.call_type===t?TYPE_CFG[t].bg:C.surface,
                color:form.call_type===t?TYPE_CFG[t].color:C.textMid,
                fontSize:12,fontWeight:700,textTransform:"capitalize",
              }}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:C.textMid,display:"block",marginBottom:6}}>Priority</label>
          <div style={{display:"flex",gap:6}}>
            {(["low","medium","high"] as const).map(p=>(
              <button key={p} type="button" onClick={()=>set("priority")(p)} style={{
                flex:1,padding:"10px 4px",borderRadius:10,cursor:"pointer",fontFamily:"inherit",
                border:`1.5px solid ${form.priority===p?PRIORITY_CFG[p].color:C.border}`,
                background:form.priority===p?PRIORITY_CFG[p].bg:C.surface,
                color:form.priority===p?PRIORITY_CFG[p].color:C.textMid,
                fontSize:12,fontWeight:700,textTransform:"capitalize",
              }}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Fault description */}
      <div style={{marginBottom:16}}>
        <label style={{fontSize:13,fontWeight:600,color:C.textMid,display:"block",marginBottom:6}}>
          Fault Description <span style={{color:C.danger}}>*</span>
        </label>
        <textarea value={form.fault_description} onChange={e=>set("fault_description")(e.target.value)}
          placeholder="Describe the fault in detail…" rows={4}
          style={{...inputStyle,resize:"vertical"}}/>
      </div>

      {/* Assign engineer */}
      <div style={{marginBottom:24}}>
        <label style={{fontSize:13,fontWeight:600,color:C.textMid,display:"block",marginBottom:6}}>
          Assign Engineer <span style={{color:C.textMuted,fontWeight:400}}>(optional)</span>
        </label>
        <select value={form.assigned_engineer_id} onChange={e=>set("assigned_engineer_id")(e.target.value)}
          style={{...inputStyle,appearance:"none"}}>
          <option value="">— Unassigned —</option>
          {engineers.map((e:any)=>(
            <option key={e.id} value={e.id}>{e.name} · {e.region}</option>
          ))}
        </select>
      </div>

      {/* Additional notes */}
      <div style={{marginBottom:24}}>
        <label style={{fontSize:13,fontWeight:600,color:C.textMid,display:"block",marginBottom:6}}>
          Additional Notes <span style={{color:C.textMuted,fontWeight:400}}>(optional)</span>
        </label>
        <textarea value={form.notes} onChange={e=>set("notes")(e.target.value)}
          placeholder="Hold reason, escalation context, site access notes…" rows={2}
          style={{...inputStyle,resize:"vertical"}}/>
      </div>

      {/* Actions */}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,
        borderTop:`1px solid ${C.border}`}}>
        <button onClick={onClose} disabled={saving} style={{
          background:C.surface,color:C.text,border:`1px solid ${C.border}`,
          borderRadius:10,padding:"10px 20px",fontWeight:600,fontSize:14,
          fontFamily:"inherit",cursor:"pointer"}}>Cancel</button>
        <button onClick={save} disabled={saving} style={{
          background:C.primary,color:"#fff",border:"none",
          borderRadius:10,padding:"10px 24px",fontWeight:700,fontSize:14,
          fontFamily:"inherit",cursor:"pointer",opacity:saving?0.6:1}}>
          {saving?"Saving…":initial?"Save Changes":"Log Call"}
        </button>
      </div>
    </div>
  );
};

// ─── Call Detail Panel ────────────────────────────────────────────────────────
const CallDetail = ({call,engineers,onUpdate,onClose}:any) => {
  const [status,setStatus] = useState(call.status);
  const [engineer,setEngineer] = useState(call.engineer?.id ?? "");
  const [saving,setSaving] = useState(false);

  const update = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/calls/${call.id}`, {
        method: "PUT",
        headers: { "Content-Type":"application/json", Accept:"application/json",
          "X-Requested-With":"XMLHttpRequest", "X-XSRF-TOKEN":getCSRF() },
        credentials: "same-origin",
        body: JSON.stringify({
          status,
          assigned_engineer_id: engineer ? Number(engineer) : null,
        }),
      });
      if (!res.ok) { const e=await res.json(); alert(e.message||"Failed."); setSaving(false); return; }
      onUpdate();
    } finally { setSaving(false); }
  };

  const sc = STATUS_CFG[call.status];
  const pc = PRIORITY_CFG[call.priority];
  const tc = TYPE_CFG[call.call_type];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Badges row */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Badge cfg={pc}/>
        <Badge cfg={sc}/>
        <Badge cfg={tc}/>
        <SLABadge call={call}/>
        {call.job_cards_count>0&&(
          <span style={{background:C.purpleLight,color:C.purple,borderRadius:20,
            padding:"3px 10px",fontSize:11,fontWeight:700}}>
            📋 {call.job_cards_count} job card{call.job_cards_count>1?"s":""}
          </span>
        )}
      </div>

      {/* ATM info */}
      <div style={{background:C.surface,borderRadius:12,padding:14,
        display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[
          ["ATM",      call.atm.terminal_id],
          ["Bank",     call.atm.bank?.name ?? ""],
          ["Location", call.atm.location],
          ["Model",    call.atm.model],
          ["Logged",   fmtTime(call.created_at)],
          ["SLA Limit",`${call.sla_hours_allowed ?? "?"}h`],
          ["SLA Deadline", call.sla_breach_at ? fmtTime(call.sla_breach_at) : "—"],
          ["Closed At",    call.closed_at      ? fmtTime(call.closed_at)     : "—"],
          ["Assigned", fmtTime(call.assigned_at)],
          ...(call.resolved_at  ? [["Resolved",  fmtTime(call.resolved_at)]]  : []),
          ...(call.escalated_at ? [["Escalated", fmtTime(call.escalated_at)]] : []),
        ].map(([k,v])=>(
          <div key={k}>
            <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>{k}</div>
            <div style={{fontSize:14,fontWeight:600,color:C.text,marginTop:2}}>{v||"—"}</div>
          </div>
        ))}
      </div>

      {/* Fault */}
      <div>
        <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>Fault Description</div>
        <div style={{background:C.surface,borderRadius:10,padding:"12px 14px",fontSize:14,color:C.text,lineHeight:1.7}}>
          {call.fault_description}
        </div>
      </div>

      {/* Resolution */}
      {call.notes&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>Progress Notes</div>
          <div style={{background:"#fefce8",borderLeft:"3px solid #eab308",borderRadius:"0 10px 10px 0",padding:"12px 14px",fontSize:13,color:"#713f12",lineHeight:1.7}}>
            📝 {call.notes}
          </div>
        </div>
      )}

      {call.resolution_notes&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>Resolution</div>
          <div style={{background:C.successLight,border:"1px solid #bbf7d0",borderRadius:10,padding:"12px 14px",fontSize:14,color:C.text,lineHeight:1.7}}>
            {call.resolution_notes}
          </div>
        </div>
      )}

      {/* Update controls — only for open calls */}
      {call.status!=="resolved"&&(
        <div style={{background:C.surface,borderRadius:12,padding:16}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>Update Call</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:C.textMid,display:"block",marginBottom:6}}>Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={{
                width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${C.border}`,
                fontSize:13,fontFamily:"inherit",color:C.text,background:C.white,outline:"none"}}>
                {["pending","assigned","on_hold","escalated","resolved"].map(s=>(
                  <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:C.textMid,display:"block",marginBottom:6}}>Reassign Engineer</label>
              <select value={engineer} onChange={e=>setEngineer(e.target.value)} style={{
                width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${C.border}`,
                fontSize:13,fontFamily:"inherit",color:C.text,background:C.white,outline:"none"}}>
                <option value="">— Unassigned —</option>
                {engineers.map((e:any)=>(
                  <option key={e.id} value={e.id}>{e.name} · {e.region}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{background:C.surface,color:C.text,
              border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 18px",
              fontWeight:600,fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>Close</button>
            <button onClick={update} disabled={saving} style={{background:C.primary,color:"#fff",
              border:"none",borderRadius:9,padding:"8px 20px",fontWeight:700,fontSize:13,
              fontFamily:"inherit",cursor:"pointer",opacity:saving?0.6:1}}>
              {saving?"Saving…":"Save Changes"}
            </button>
          </div>
        </div>
      )}

      {call.status==="resolved"&&(
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:C.surface,color:C.text,
            border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 20px",
            fontWeight:600,fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>Close</button>
        </div>
      )}
    </div>
  );
};

// ─── Main Module ──────────────────────────────────────────────────────────────
// ─── Export Report Modal ─────────────────────────────────────────────────────
const PERIODS = [
  {id:"eod",    label:"End of Day",   desc:"Today's calls"},
  {id:"eow",    label:"End of Week",  desc:"This week (Mon–today)"},
  {id:"eom",    label:"End of Month", desc:"This calendar month"},
  {id:"eoy",    label:"End of Year",  desc:"This calendar year"},
  {id:"custom", label:"Custom Range", desc:"Pick your own dates"},
];

function getPeriodDates(id:string):{from:string;to:string} {
  const now   = new Date();
  const pad   = (n:number) => String(n).padStart(2,"0");
  const ymd   = (d:Date)   => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const today = ymd(now);
  if (id==="eod") return {from:today, to:today};
  if (id==="eow") {
    const day = now.getDay(); // 0=Sun
    const mon = new Date(now); mon.setDate(now.getDate() - (day===0?6:day-1));
    return {from:ymd(mon), to:today};
  }
  if (id==="eom") return {from:`${now.getFullYear()}-${pad(now.getMonth()+1)}-01`, to:today};
  if (id==="eoy") return {from:`${now.getFullYear()}-01-01`, to:today};
  return {from:today, to:today};
}

const ExportModal = ({onClose, engineers}:any) => {
  const [period,setPeriod]     = useState("eom");
  const [customFrom,setFrom]   = useState(getPeriodDates("eom").from);
  const [customTo,setTo]       = useState(getPeriodDates("eom").to);
  const [status,setStatus]     = useState("all");
  const [priority,setPriority] = useState("all");
  const [callType,setCallType] = useState("all");
  const [engId,setEngId]       = useState("all");
  const [exporting,setExporting] = useState(false);
  const [error,setError]       = useState("");

  const dates = period==="custom"
    ? {from:customFrom, to:customTo}
    : getPeriodDates(period);

  const periodLabel = PERIODS.find(p=>p.id===period)?.label ?? "Custom";

  const doExport = async () => {
    setExporting(true); setError("");
    try {
      const params = new URLSearchParams({
        date_from: dates.from, date_to: dates.to,
        status, priority, call_type:callType,
        ...(engId!=="all" ? {engineer_id:engId} : {}),
      });
      const res = await fetch(`/calls?${params}&limit=9999`,{
        headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest"},
        credentials:"same-origin",
      });
      const calls = await res.json();
      await exportCallsPDF(
        Array.isArray(calls)?calls:[],
        {periodLabel, dateFrom:dates.from, dateTo:dates.to, status, priority, type:callType},
        setError
      );
    } catch(e:any) { setError(e.message??"Export failed."); }
    finally { setExporting(false); }
  };

  const sel:any = {
    width:"100%",padding:"9px 12px",borderRadius:10,border:`1.5px solid #e8eaed`,
    fontSize:13,fontFamily:"inherit",color:"#1a1d23",background:"#f8f9fb",outline:"none",
    appearance:"none",cursor:"pointer",
  };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",
      zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:20,
        width:"100%",maxWidth:560,boxShadow:"0 8px 32px rgba(0,0,0,.12)",overflow:"hidden"}}>

        {/* Header */}
        <div style={{background:"#1d6ef5",padding:"18px 24px",display:"flex",
          alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:17,fontWeight:800,color:"#fff"}}>📊 Export Calls Report</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.75)",marginTop:2}}>
              Generates a PDF with summary cards and full call table
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.2)",border:"none",
            borderRadius:8,width:30,height:30,cursor:"pointer",color:"#fff",fontSize:18,
            display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>

        <div style={{padding:24,display:"flex",flexDirection:"column",gap:16}}>

          {/* Period selector */}
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"#4b5260",marginBottom:8}}>Report Period</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {PERIODS.map(p=>(
                <button key={p.id} onClick={()=>{setPeriod(p.id);
                  if(p.id!=="custom"){const d=getPeriodDates(p.id);setFrom(d.from);setTo(d.to);}
                }} style={{
                  padding:"8px 14px",borderRadius:10,cursor:"pointer",fontFamily:"inherit",
                  border:`1.5px solid ${period===p.id?"#1d6ef5":"#e8eaed"}`,
                  background:period===p.id?"#1d6ef5":"#f8f9fb",
                  color:period===p.id?"#fff":"#4b5260",
                  fontSize:12,fontWeight:period===p.id?700:500,
                }}>
                  <div style={{fontWeight:700}}>{p.label}</div>
                  <div style={{fontSize:10,opacity:.8,marginTop:1}}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range */}
          {period==="custom"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#4b5260",marginBottom:5}}>From</div>
                <input type="date" value={customFrom} onChange={e=>setFrom(e.target.value)}
                  style={{...sel}}/>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#4b5260",marginBottom:5}}>To</div>
                <input type="date" value={customTo} onChange={e=>setTo(e.target.value)}
                  style={{...sel}}/>
              </div>
            </div>
          )}

          {/* Date preview */}
          <div style={{background:"#eef3fe",borderRadius:10,padding:"10px 14px",
            fontSize:12,color:"#1d6ef5",fontWeight:600}}>
            📅 {dates.from} → {dates.to}
          </div>

          {/* Filters */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#4b5260",marginBottom:5}}>Status</div>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={sel}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="on_hold">On Hold</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#4b5260",marginBottom:5}}>Priority</div>
              <select value={priority} onChange={e=>setPriority(e.target.value)} style={sel}>
                <option value="all">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#4b5260",marginBottom:5}}>Call Type</div>
              <select value={callType} onChange={e=>setCallType(e.target.value)} style={sel}>
                <option value="all">All types</option>
                <option value="new">New</option>
                <option value="old">Old</option>
                <option value="repeat">Repeat</option>
              </select>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#4b5260",marginBottom:5}}>Engineer</div>
              <select value={engId} onChange={e=>setEngId(e.target.value)} style={sel}>
                <option value="all">All engineers</option>
                {engineers.map((e:any)=>(
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>

          {error&&(
            <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,
              padding:"10px 14px",fontSize:13,color:"#ef4444",fontWeight:600}}>
              ⚠ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,
            borderTop:"1px solid #e8eaed"}}>
            <button onClick={onClose} style={{background:"#f8f9fb",color:"#1a1d23",
              border:"1px solid #e8eaed",borderRadius:10,padding:"10px 20px",
              fontWeight:600,fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>
              Cancel
            </button>
            <button onClick={doExport} disabled={exporting} style={{
              background:exporting?"#93c5fd":"#1d6ef5",color:"#fff",border:"none",
              borderRadius:10,padding:"10px 24px",fontWeight:700,fontSize:14,
              fontFamily:"inherit",cursor:exporting?"not-allowed":"pointer"}}>
              {exporting?"⏳ Generating…":"📥 Download PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function CallsModule({ atms, engineers, banks }: { atms: any[]; engineers: any[]; banks?: any[] }) {
  const [calls,setCalls]     = useState<Call[]>([]);
  const [showExport,setShowExport] = useState(false);
  const [loading,setLoading] = useState(true);
  const [filter,setFilter]   = useState("all");
  const [priority,setPriority] = useState("all");
  const [modal,setModal]     = useState<null|"new"|"detail"|"edit">(null);
  const [selected,setSelected] = useState<Call|null>(null);

  const [error,setError]   = useState<string|null>(null);
  const [sortKey,setSortKey] = useState<string>("created_at");
  const [sortDir,setSortDir] = useState<"asc"|"desc">("desc");
  const [page,setPage]       = useState(1);
  const PAGE_SIZE = 25;

  const toggleSort = (key:string) => {
    if (sortKey===key) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir(key==="created_at"?"desc":"asc"); }
    setPage(1);
  };

  const sortIcon = (key:string) => {
    if (sortKey!==key) return <span style={{opacity:.3,marginLeft:4}}>↕</span>;
    return <span style={{marginLeft:4,color:C.primary}}>{sortDir==="asc"?"↑":"↓"}</span>;
  };

  // Apply filter
  const filtered = calls.filter(c => {
    if (filter==="analytics") return true;
    if (filter==="closed")    return c.status==="resolved"||c.status==="escalated";
    if (filter!=="all")       return c.status===filter;
    return true;
  });

  // Apply sort
  const sorted = [...filtered].sort((a:any,b:any) => {
    let av:any, bv:any;
    if (sortKey==="created_at"||sortKey==="assigned_at") {
      av = a[sortKey] ? new Date(a[sortKey]).getTime() : 0;
      bv = b[sortKey] ? new Date(b[sortKey]).getTime() : 0;
    } else if (sortKey==="priority") {
      const order:any={high:0,medium:1,low:2};
      av = order[a.priority]??3; bv = order[b.priority]??3;
    } else if (sortKey==="status") {
      const order:any={escalated:0,pending:1,assigned:2,on_hold:3,resolved:4};
      av = order[a.status]??5; bv = order[b.status]??5;
    } else {
      av = (a[sortKey]??"").toString().toLowerCase();
      bv = (b[sortKey]??"").toString().toLowerCase();
    }
    if (av<bv) return sortDir==="asc"?-1:1;
    if (av>bv) return sortDir==="asc"?1:-1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sorted.length/PAGE_SIZE);
  const paged      = sorted.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // "closed" filter maps to both resolved and escalated on backend
      setPage(1);
      const statusParam = filter==="analytics" ? "all" : filter==="closed" ? "closed" : filter;
      const res = await fetch(
        `/calls?status=${statusParam}&priority=${priority}`,
        { headers:{ Accept:"application/json","X-Requested-With":"XMLHttpRequest" }, credentials:"same-origin" }
      );
      if (!res.ok) {
        const text = await res.text();
        // Try to parse JSON error message
        try {
          const json = JSON.parse(text);
          setError(json.message || `Server error ${res.status}`);
        } catch {
          setError(`Server returned ${res.status}. Run: php artisan migrate`);
        }
        return;
      }
      const data = await res.json();
      setCalls(Array.isArray(data) ? data : []);
    } catch(e:any) {
      setError(e.message || "Network error — could not load calls.");
    }
    finally { setLoading(false); }
  }, [filter,priority]);

  useEffect(() => { load(); }, [load]);

  const deleteCall = async (call:Call) => {
    if (!confirm(`Delete call #${call.id}? This cannot be undone.`)) return;
    await fetch(`/calls/${call.id}`, {
      method:"DELETE",
      headers:{ Accept:"application/json","X-Requested-With":"XMLHttpRequest","X-XSRF-TOKEN":getCSRF() },
      credentials:"same-origin",
    });
    load();
  };

  // Counts for filter tabs
  const counts:any = {
    all:      calls.length,
    pending:  calls.filter(c=>c.status==="pending").length,
    assigned: calls.filter(c=>c.status==="assigned").length,
    on_hold:  calls.filter(c=>c.status==="on_hold").length,
    closed:   calls.filter(c=>c.status==="resolved"||c.status==="escalated").length,
  };

  const FILTER_TABS = [
    {id:"all",       label:"All"},
    {id:"pending",   label:"Pending"},
    {id:"assigned",  label:"Assigned"},
    {id:"on_hold",   label:"On Hold"},
    {id:"closed",    label:"Closed"},
    {id:"analytics", label:"📊 Analytics"},
  ];

  return (
    <ErrorBoundary>
    <div style={{padding:24,fontFamily:"inherit"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",
        flexWrap:"wrap",gap:12,marginBottom:20}}>
        <div>
          <h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.text}}>Calls</h2>
          <p style={{margin:"4px 0 0",fontSize:13,color:C.textMuted}}>
            Manage and assign emergency ATM calls to field engineers
          </p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {/* Priority filter */}
          <select value={priority} onChange={e=>setPriority(e.target.value)} style={{
            padding:"8px 12px",borderRadius:10,border:`1px solid ${C.border}`,
            fontSize:13,fontFamily:"inherit",color:C.textMid,background:C.surface,
            outline:"none",cursor:"pointer"}}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button onClick={load} style={{background:C.surface,border:`1px solid ${C.border}`,
            borderRadius:10,padding:"8px 14px",fontSize:13,fontWeight:600,color:C.textMid,
            cursor:"pointer",fontFamily:"inherit"}}>↻ Refresh</button>
          <button onClick={()=>setShowExport(true)} style={{background:"#f8f9fb",
            border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 16px",
            fontSize:13,fontWeight:600,color:C.textMid,cursor:"pointer",fontFamily:"inherit"}}>
            📊 Export Report
          </button>
          <button onClick={()=>setModal("new")} style={{background:C.primary,color:"#fff",
            border:"none",borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:700,
            cursor:"pointer",fontFamily:"inherit"}}>+ Log Call</button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {FILTER_TABS.map(f=>{
          const active=filter===f.id;
          return (
            <button key={f.id} onClick={()=>setFilter(f.id)} style={{
              padding:"6px 14px",borderRadius:20,border:active?"none":`1px solid ${C.border}`,
              cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:active?700:500,
              background:active?C.primary:C.surface,color:active?"#fff":C.textMid}}>
              {f.id==="analytics" ? f.label : <>{f.label} <span style={{opacity:0.7}}>({counts[f.id]??0})</span></>}
            </button>
          );
        })}
      </div>

      {/* Analytics view */}
      {filter==="analytics" && <CallsAnalytics calls={calls} banks={banks||[]} />}

      {/* Table */}
      {filter!=="analytics" && <div style={{background:C.white,borderRadius:16,border:`1px solid ${C.border}`,
        boxShadow:"0 1px 3px rgba(0,0,0,.06)",overflow:"hidden"}}>
        {loading ? (
          <div style={{padding:"48px 24px",textAlign:"center",color:C.textMuted}}>Loading calls…</div>
        ) : error ? (
          <div style={{padding:"32px 24px",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
            <div style={{fontSize:15,fontWeight:700,color:C.danger,marginBottom:8}}>Could not load calls</div>
            <div style={{fontSize:13,color:C.textMuted,marginBottom:16,maxWidth:400,margin:"0 auto 16px"}}>{error}</div>
            <div style={{background:C.surface,borderRadius:12,padding:16,display:"inline-block",textAlign:"left",maxWidth:420}}>
              <div style={{fontSize:12,fontWeight:700,color:C.textMid,marginBottom:8}}>To fix this, run in your terminal:</div>
              <code style={{fontSize:12,color:C.primary,background:C.primaryLight,padding:"8px 14px",borderRadius:8,display:"block"}}>
                php artisan migrate
              </code>
            </div>
          </div>
        ) : filtered.length===0 ? (
          <div style={{padding:"48px 24px",textAlign:"center",color:C.textMuted}}>
            <div style={{fontSize:36,marginBottom:10}}>📞</div>
            <div style={{fontSize:15}}>No calls {filter!=="all"?`with status "${filter}"`:"logged yet"}</div>
            <button onClick={()=>setModal("new")} style={{marginTop:16,background:C.primary,
              color:"#fff",border:"none",borderRadius:10,padding:"9px 20px",
              fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              Log first call
            </button>
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`}}>
                  {[
                    {label:"#",       key:null},
                    {label:"ATM",     key:"atm"},
                    {label:"Bank",    key:null},
                    {label:"Type",    key:"call_type"},
                    {label:"Priority",key:"priority"},
                    {label:"Status",  key:"status"},
                    {label:"Engineer",key:"engineer"},
                    {label:"Logged",  key:"created_at"},
                    {label:"Cards",   key:null},
                    {label:"",        key:null},
                  ].map(({label,key})=>(
                    <th key={label} onClick={key?()=>toggleSort(key):undefined}
                      style={{padding:"11px 14px",textAlign:"left",fontSize:11,
                        fontWeight:700,color:sortKey===key?C.primary:C.textMuted,
                        whiteSpace:"nowrap",letterSpacing:"0.04em",textTransform:"uppercase",
                        cursor:key?"pointer":"default",userSelect:"none"}}>
                      {label}{key&&sortIcon(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((call)=>(
                  <tr key={call.id}
                    style={{borderBottom:`1px solid ${C.surface}`,cursor:"pointer",
                      borderLeft:`3px solid ${PRIORITY_CFG[call.priority].dot}`}}
                    onClick={()=>{setSelected(call);setModal("detail");}}>
                    <td style={{padding:"12px 14px",fontSize:12,color:C.textMuted,fontWeight:600}}>
                      #{call.id}
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{fontWeight:700,fontSize:13,color:C.text,fontFamily:"monospace"}}>
                        {call.atm.terminal_id}
                      </div>
                      <div style={{fontSize:11,color:C.textMuted,marginTop:1}}>{call.atm.location}</div>
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <span style={{background:C.accentLight,color:C.accent,borderRadius:5,
                        padding:"2px 8px",fontSize:11,fontWeight:700}}>
                        {call.atm.bank?.short_code ?? ""}
                      </span>
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <Badge cfg={TYPE_CFG[call.call_type]}/>
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <Badge cfg={PRIORITY_CFG[call.priority]}/>
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <Badge cfg={STATUS_CFG[call.status]}/>
                      <div style={{marginTop:4}}><SLABadge call={call}/></div>
                    </td>
                    <td style={{padding:"12px 14px",fontSize:13,color:C.textMid}}>
                      {call.engineer?.name ?? (
                        <span style={{color:C.textMuted,fontStyle:"italic"}}>Unassigned</span>
                      )}
                    </td>
                    <td style={{padding:"12px 14px",fontSize:12,color:C.textMuted,whiteSpace:"nowrap"}}>
                      {(() => {
                        const d = call.created_at ? new Date(call.created_at.replace(" ","T")) : null;
                        return d && !isNaN(d.getTime()) ? (
                          <>
                            <div>{d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>
                            <div style={{fontSize:11,marginTop:1}}>{d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</div>
                          </>
                        ) : <span style={{color:"#9ca3af"}}>—</span>;
                      })()}
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      {call.job_cards_count>0&&(
                        <span style={{background:C.purpleLight,color:C.purple,borderRadius:6,
                          padding:"2px 8px",fontSize:11,fontWeight:700}}>
                          📋 {call.job_cards_count}
                        </span>
                      )}
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>{setSelected(call);setModal("edit");}} style={{
                          background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,
                          padding:"5px 10px",fontSize:12,fontWeight:600,color:C.textMid,
                          cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                        <button onClick={()=>deleteCall(call)} style={{
                          background:C.dangerLight,border:"1px solid #fecaca",borderRadius:7,
                          padding:"5px 10px",fontSize:12,fontWeight:600,color:C.danger,
                          cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length>0&&(
          <div style={{padding:"14px 20px",borderTop:`1px solid ${C.border}`,
            display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:13,color:C.textMuted}}>
              Showing <b style={{color:C.text}}>{Math.min((page-1)*PAGE_SIZE+1,sorted.length)}–{Math.min(page*PAGE_SIZE,sorted.length)}</b> of <b style={{color:C.text}}>{sorted.length}</b> calls
            </div>
            {totalPages>1&&(
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  style={{background:page===1?C.surface:C.white,border:`1px solid ${C.border}`,
                    borderRadius:8,padding:"5px 12px",fontSize:13,fontWeight:600,
                    color:page===1?C.textMuted:C.text,cursor:page===1?"not-allowed":"pointer",
                    fontFamily:"inherit"}}>← Prev</button>
                {Array.from({length:totalPages},(_,i)=>i+1)
                  .filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
                  .reduce((acc:any[],p,i,arr)=>{
                    if(i>0&&p-arr[i-1]>1) acc.push("…");
                    acc.push(p); return acc;
                  },[])
                  .map((p:any,i)=>
                    p==="…"
                      ? <span key={`e${i}`} style={{fontSize:13,color:C.textMuted,padding:"0 4px"}}>…</span>
                      : <button key={p} onClick={()=>setPage(p)}
                          style={{background:page===p?C.primary:C.white,
                            border:`1px solid ${page===p?C.primary:C.border}`,
                            borderRadius:8,padding:"5px 11px",fontSize:13,
                            fontWeight:page===p?700:500,
                            color:page===p?"#fff":C.text,
                            cursor:"pointer",fontFamily:"inherit",minWidth:34}}>
                          {p}
                        </button>
                  )
                }
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                  style={{background:page===totalPages?C.surface:C.white,border:`1px solid ${C.border}`,
                    borderRadius:8,padding:"5px 12px",fontSize:13,fontWeight:600,
                    color:page===totalPages?C.textMuted:C.text,
                    cursor:page===totalPages?"not-allowed":"pointer",fontFamily:"inherit"}}>Next →</button>
              </div>
            )}
          </div>
        )}
      </div>}

      {/* Modals */}
      {showExport&&(
        <ExportModal onClose={()=>setShowExport(false)} engineers={engineers}/>
      )}

      {(modal==="new"||modal==="edit")&&(
        <div onClick={()=>setModal(null)} style={{position:"fixed",inset:0,
          background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",
          alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:20,
            width:"100%",maxWidth:580,maxHeight:"90vh",overflowY:"auto",
            boxShadow:"0 8px 32px rgba(0,0,0,.12)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"20px 24px 0"}}>
              <h2 style={{margin:0,fontSize:18,fontWeight:800,color:C.text}}>
                {modal==="new"?"Log New Call":`Edit Call #${selected?.id}`}
              </h2>
              <button onClick={()=>setModal(null)} style={{background:"none",border:"none",
                cursor:"pointer",fontSize:24,color:C.textMuted}}>×</button>
            </div>
            <div style={{padding:24}}>
              <CallForm
                atms={atms} engineers={engineers} banks={banks||[]}
                initial={modal==="edit"?selected:null}
                onSave={()=>{setModal(null);load();}}
                onClose={()=>setModal(null)}
              />
            </div>
          </div>
        </div>
      )}

      {modal==="detail"&&selected&&(
        <div onClick={()=>setModal(null)} style={{position:"fixed",inset:0,
          background:"rgba(0,0,0,.45)",zIndex:1000,display:"flex",
          alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:20,
            width:"100%",maxWidth:620,maxHeight:"90vh",overflowY:"auto",
            boxShadow:"0 8px 32px rgba(0,0,0,.12)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",
              padding:"20px 24px 0"}}>
              <div>
                <h2 style={{margin:0,fontSize:18,fontWeight:800,color:C.text}}>Call #{selected.id}</h2>
                <div style={{fontSize:13,color:C.textMuted,marginTop:2}}>
                  {selected.atm.terminal_id} · {selected.atm.location}
                </div>
              </div>
              <button onClick={()=>setModal(null)} style={{background:"none",border:"none",
                cursor:"pointer",fontSize:24,color:C.textMuted}}>×</button>
            </div>
            <div style={{padding:24}}>
              <CallDetail
                call={selected} engineers={engineers}
                onUpdate={()=>{setModal(null);load();}}
                onClose={()=>setModal(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
