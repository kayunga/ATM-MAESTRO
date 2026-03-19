// @ts-nocheck
/* eslint-disable */
import { useState, useCallback, useRef, useEffect } from "react";
import { router, usePage } from "@inertiajs/react";

// ── Modules ──────────────────────────────────────────────────────────────────
import { C, NCR_MODELS, STATUSES, MAINT_TYPES, MAINT_STATUS, ZAMBIA_BANKS, bankColor, PAGE_SIZE } from "./constants";
import { fmt, fmtISO, today, qtr, statusColor, statusBg, mColor, mBg, normAtm, normBank, normMaint } from "./helpers";
import { useToast, usePagination } from "./hooks";
import { Badge, Btn, Input, Modal, Card, StatCard, EmptyState, Confirm, Checkbox, Paginator, BulkBar } from "./components/ui";
import type { PageProps } from "./types";
import "./atm-fleet.css";
import JobCardsModule from "./JobCardsModule";

// ─── PDF Export ───────────────────────────────────────────────────────────────
// Uses jsPDF + jspdf-autotable loaded from CDN via a one-time dynamic import.
// Falls back gracefully if the CDN is unavailable.

async function loadJsPDF() {
  if ((window as any).jspdf) return (window as any).jspdf.jsPDF;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("jsPDF load failed"));
    document.head.appendChild(s);
  });
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("autotable load failed"));
    document.head.appendChild(s);
  });
  return (window as any).jspdf.jsPDF;
}

async function exportMaintenancePDF(
  records: any[],
  atms: any[], engineers: any[], banks: any[],
  meta: { search: string; fStatus: string; fQ: string; fBank: string },
  toast: (msg: string, type: any) => void
) {
  if (records.length === 0) { toast("No records to export", "warning"); return; }
  try {
    const JsPDF = await loadJsPDF();
    const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const cQ = qtr(today), cY = today.getFullYear();
    const now = new Date().toLocaleString("en-GB");

    // ── Header band ──────────────────────────────────────────────────────────
    doc.setFillColor(29, 110, 245);
    doc.rect(0, 0, 297, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("NCR Fleet ATM Manager — Maintenance Report", 14, 9);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${now}   ·   Records: ${records.length}`, 14, 16);

    // ── Active filters summary ────────────────────────────────────────────────
    const filters: string[] = [];
    if (meta.search)   filters.push(`Search: "${meta.search}"`);
    if (meta.fBank)    filters.push(`Bank: ${banks.find(b => String(b.id) === meta.fBank)?.name ?? meta.fBank}`);
    if (meta.fStatus)  filters.push(`Status: ${meta.fStatus}`);
    if (meta.fYear)    filters.push(`Year: ${meta.fYear}`);
    if (meta.fQ)       filters.push(`Quarter: Q${meta.fQ}`);
    const filterLine = filters.length ? filters.join("   ·   ") : "All records (no filters applied)";

    doc.setFillColor(238, 243, 254);
    doc.rect(0, 22, 297, 10, "F");
    doc.setTextColor(29, 110, 245);
    doc.setFontSize(8); doc.setFont("helvetica", "italic");
    doc.text(`Filters: ${filterLine}`, 14, 28.5);

    // ── Summary chips ─────────────────────────────────────────────────────────
    const statusCounts: Record<string,number> = {};
    records.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
    const chips = [
      ["Completed",   statusCounts["Completed"]   || 0, [16,179,102]],
      ["Scheduled",   statusCounts["Scheduled"]   || 0, [245,158,11]],
      ["In Progress", statusCounts["In Progress"] || 0, [29,110,245]],
      ["Cancelled",   statusCounts["Cancelled"]   || 0, [139,144,154]],
    ] as const;
    let cx = 14;
    chips.forEach(([label, count, [r,g,b]]) => {
      doc.setFillColor(r,g,b);
      doc.roundedRect(cx, 34, 52, 10, 2, 2, "F");
      doc.setTextColor(255,255,255);
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(`${count}`, cx + 4, 40.5);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(label, cx + 16, 40.5);
      cx += 56;
    });

    // ── Table ─────────────────────────────────────────────────────────────────
    const rows = records.map((m, idx) => {
      const atm  = atms.find(a => a.id == m.atmId);
      const eng  = engineers.find(e => e.id == m.engineerId);
      const bank = banks.find(b => b.id == atm?.bankId);
      return [
        idx + 1,
        atm?.terminalId ?? "—",
        bank?.shortCode ?? "—",
        atm?.location   ?? "—",
        m.type,
        `Q${m.quarter} ${m.year}`,
        eng?.name       ?? "—",
        fmt(m.scheduledDate),
        m.completedDate ? fmt(m.completedDate) : "—",
        m.status,
        m.notes || "—",
      ];
    });

    const statusColor = (s: string) => {
      if (s === "Completed")   return [16,179,102];
      if (s === "Scheduled")   return [245,158,11];
      if (s === "In Progress") return [29,110,245];
      return [139,144,154];
    };

    (doc as any).autoTable({
      startY: 47,
      head: [["#","Terminal ID","Bank","Location","Type","Quarter","Engineer","Scheduled","Completed","Status","Notes"]],
      body: rows,
      styles: { fontSize: 7.5, cellPadding: 2.5, font: "helvetica", textColor: [26,29,35] },
      headStyles: { fillColor: [26,29,35], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248,249,251] },
      columnStyles: {
        0:  { cellWidth: 8,  halign: "center" },
        1:  { cellWidth: 26, fontStyle: "bold", textColor: [29,110,245] },
        2:  { cellWidth: 18 },
        3:  { cellWidth: 32 },
        4:  { cellWidth: 28 },
        5:  { cellWidth: 18 },
        6:  { cellWidth: 28 },
        7:  { cellWidth: 20 },
        8:  { cellWidth: 20 },
        9:  { cellWidth: 22 },
        10: { cellWidth: "auto" },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 9) {
          const s = data.cell.raw as string;
          const [r,g,b] = statusColor(s);
          data.cell.styles.textColor = [r,g,b];
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: (data: any) => {
        // Footer on every page
        const pCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(7.5); doc.setTextColor(139,144,154); doc.setFont("helvetica","normal");
        doc.text(`NCR Fleet ATM Manager · Confidential`, 14, 205);
        doc.text(`Page ${data.pageNumber} of ${pCount}`, 270, 205, { align: "right" });
      },
      margin: { top: 47, left: 14, right: 14, bottom: 12 },
    });

    const bankLabel  = meta.fBank   ? `_${banks.find(b=>String(b.id)===meta.fBank)?.shortCode??meta.fBank}` : "";
    const statusLabel= meta.fStatus ? `_${meta.fStatus.replace(/ /g,"_")}` : "";
    const yearLabel  = meta.fYear   ? `_${meta.fYear}`                      : "";
    const qLabel     = meta.fQ      ? `_Q${meta.fQ}`                        : "";
    const filename   = `maintenance_report${bankLabel}${statusLabel}${yearLabel}${qLabel}.pdf`;
    doc.save(filename);
    toast(`Report exported — ${records.length} records`, "success");
  } catch (e) {
    console.error(e);
    toast("Export failed. Check your internet connection.", "error");
  }
}

// ─── Bulk PM Wizard (3-step) ──────────────────────────────────────────────────
const BulkPMWizard = ({atms,engineers,banks,onSave,onClose}) => {
  const cQ=qtr(today), cY=today.getFullYear();
  const [step,setStep] = useState(1);
  const [cfg,setCfg]   = useState({type:"Quarterly PM",status:"Completed",scheduledDate:fmtISO(today),completedDate:fmtISO(today),quarter:String(cQ),year:String(cY),notes:"",filterBank:"",filterStatus:""});
  const set = k=>v=>setCfg(f=>({...f,[k]:v}));

  const candidates = atms.filter(a=>(!cfg.filterBank||String(a.bankId)===cfg.filterBank)&&(!cfg.filterStatus||a.status===cfg.filterStatus));
  const [sel,setSel] = useState(null);
  const resolved = sel??new Set(candidates.map(a=>a.id));
  const [engOver,setEngOver] = useState({});
  const getEng = (atm) => engOver[atm.id]??atm.engineerId;
  const setEng = (aid,eid) => setEngOver(p=>({...p,[aid]:Number(eid)}));
  const toggleOne = (id) => { const n=new Set(resolved); n.has(id)?n.delete(id):n.add(id); setSel(n); };
  const toggleAll = (c) => setSel(c?new Set(candidates.map(a=>a.id)):new Set());
  const selList = candidates.filter(a=>resolved.has(a.id));

  const doSave = () => {
    onSave(selList.map(atm=>({atmId:atm.id,engineerId:getEng(atm),type:cfg.type,status:cfg.status,scheduledDate:cfg.scheduledDate,completedDate:cfg.status==="Completed"?cfg.completedDate:null,quarter:Number(cfg.quarter),year:Number(cfg.year),notes:cfg.notes})));
    setStep(3);
  };

  const steps=["Configure","Review & Select","Done"];
  const StepDot=({n,label})=>(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:28,height:28,borderRadius:14,background:step>n?C.green:step===n?C.accent:C.border,color:step>n||step===n?"#fff":C.textMuted,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,transition:"all .2s"}}>{step>n?"✓":n}</div>
      <span style={{fontSize:13,fontWeight:step===n?700:500,color:step===n?C.text:C.textMuted}}>{label}</span>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      {/* Steps */}
      <div style={{display:"flex",alignItems:"center",marginBottom:24,background:C.surface,borderRadius:10,padding:"14px 20px"}}>
        {steps.map((label,i)=>(
          <div key={label} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"auto"}}>
            <StepDot n={i+1} label={label}/>
            {i<steps.length-1&&<div style={{flex:1,height:2,background:step>i+1?C.green:C.border,margin:"0 12px",borderRadius:2,transition:"background .3s"}}/>}
          </div>
        ))}
      </div>

      {step===1&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:C.tealLight,border:`1px solid ${C.teal}44`,borderRadius:10,padding:"12px 16px",fontSize:13,color:C.teal,fontWeight:500}}>
            📋 Configure the shared maintenance details, then filter and pick exactly which ATMs to include.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Input label="Maintenance Type" value={cfg.type}           onChange={set("type")}           options={MAINT_TYPES}/>
            <Input label="Status"           value={cfg.status}         onChange={set("status")}         options={MAINT_STATUS}/>
            <Input label="Scheduled Date"   value={cfg.scheduledDate}  onChange={set("scheduledDate")}  type="date"/>
            <Input label="Completed Date"   value={cfg.completedDate}  onChange={set("completedDate")}  type="date"/>
            <Input label="Quarter"          value={cfg.quarter}        onChange={set("quarter")}        options={["1","2","3","4"]}/>
            <Input label="Year"             value={cfg.year}           onChange={set("year")}           type="number" placeholder="2024"/>
          </div>
          <Input label="Shared Notes (applied to all records)" value={cfg.notes} onChange={set("notes")} placeholder="e.g. Q3 2024 scheduled PM cycle" rows={2}/>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
            <div style={{fontSize:13,fontWeight:700,color:C.textMid,marginBottom:10}}>FILTER ATMs TO INCLUDE</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Input label="By Bank" value={cfg.filterBank} onChange={v=>{set("filterBank")(v); setSel(null);}} options={banks.map(b=>({value:b.id,label:b.name}))}/>
              <Input label="By ATM Status" value={cfg.filterStatus} onChange={v=>{set("filterStatus")(v); setSel(null);}} options={STATUSES}/>
            </div>
            <div style={{marginTop:10,background:C.surface,borderRadius:8,padding:"10px 14px",fontSize:13,color:C.textMid}}>
              <span style={{fontWeight:700,color:C.accent}}>{candidates.length}</span> ATMs match your filter
              {cfg.filterBank&&<span> · Bank: <b>{banks.find(b=>String(b.id)===cfg.filterBank)?.shortCode}</b></span>}
              {cfg.filterStatus&&<span> · Status: <b>{cfg.filterStatus}</b></span>}
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}>
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn onClick={()=>{setSel(new Set(candidates.map(a=>a.id)));setStep(2);}} disabled={candidates.length===0}>Next: Review {candidates.length} ATMs →</Btn>
          </div>
        </div>
      )}

      {step===2&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:C.surface,borderRadius:10,padding:"12px 16px",display:"flex",gap:20,flexWrap:"wrap",fontSize:13}}>
            <span><b style={{color:C.text}}>Type:</b> <span style={{color:C.textMid}}>{cfg.type}</span></span>
            <span><b style={{color:C.text}}>Status:</b> <span style={{color:C.textMid}}>{cfg.status}</span></span>
            <span><b style={{color:C.text}}>Quarter:</b> <span style={{color:C.textMid}}>Q{cfg.quarter} {cfg.year}</span></span>
            <span><b style={{color:C.text}}>Date:</b> <span style={{color:C.textMid}}>{fmt(cfg.scheduledDate)}</span></span>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 4px"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <Checkbox checked={resolved.size===candidates.length} indeterminate={resolved.size>0&&resolved.size<candidates.length} onChange={toggleAll}/>
              <span style={{fontSize:13,fontWeight:600,color:C.textMid}}>{resolved.size} of {candidates.length} ATMs selected</span>
            </div>
            <div style={{fontSize:12,color:C.textMuted}}>Override engineer per ATM if needed</div>
          </div>
          <div style={{border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",maxHeight:380,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0}}>
                  <th style={{padding:"10px 14px",width:40}}/>
                  {["Terminal ID","Bank","Location","Status","Engineer"].map(h=>(
                    <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map(atm=>{
                  const bank=banks.find(b=>b.id==atm.bankId);
                  const bi=banks.findIndex(b=>b.id==atm.bankId);
                  const col=bankColor(bi);
                  const isSelected=resolved.has(atm.id);
                  return (
                    <tr key={atm.id} style={{borderBottom:`1px solid ${C.surface}`,background:isSelected?"#fff":C.surface+"88"}}>
                      <td style={{padding:"10px 14px",textAlign:"center"}}><Checkbox checked={isSelected} onChange={()=>toggleOne(atm.id)}/></td>
                      <td style={{padding:"10px 14px",fontWeight:700,fontSize:13,color:isSelected?C.text:C.textMuted,fontFamily:"monospace"}}>{atm.terminalId}</td>
                      <td style={{padding:"10px 14px"}}>{bank&&<span style={{background:col+"18",border:`1px solid ${col}30`,borderRadius:5,padding:"2px 6px",fontSize:11,fontWeight:700,color:col}}>{bank.shortCode}</span>}</td>
                      <td style={{padding:"10px 14px",fontSize:13,color:C.textMid}}>{atm.location}</td>
                      <td style={{padding:"10px 14px"}}><Badge label={atm.status} color={statusColor(atm.status)} bg={statusBg(atm.status)}/></td>
                      <td style={{padding:"10px 14px"}}>
                        <select value={getEng(atm)} onChange={e=>setEng(atm.id,e.target.value)} disabled={!isSelected}
                          style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,fontFamily:"inherit",color:isSelected?C.text:C.textMuted,background:"#fff",opacity:isSelected?1:.5}}>
                          {engineers.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",marginTop:4}}>
            <Btn variant="secondary" onClick={()=>setStep(1)}>← Back</Btn>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:13,color:C.textMuted}}>Creates <b style={{color:C.text}}>{resolved.size}</b> records</span>
              <Btn onClick={doSave} disabled={resolved.size===0}>✓ Log {resolved.size} Records</Btn>
            </div>
          </div>
        </div>
      )}

      {step===3&&(
        <div style={{textAlign:"center",padding:"32px 20px"}}>
          <div style={{fontSize:56,marginBottom:16}}>✅</div>
          <h3 style={{margin:"0 0 8px",fontSize:20,fontWeight:800,color:C.text}}>Bulk PM Logged!</h3>
          <p style={{color:C.textMid,fontSize:14,margin:"0 0 24px"}}>
            Successfully created <b style={{color:C.green}}>{selList.length}</b> maintenance records for {cfg.type} · Q{cfg.quarter} {cfg.year}.
          </p>
          <Btn onClick={onClose}>Close</Btn>
        </div>
      )}
    </div>
  );
};

// ─── Bulk Status Modal ────────────────────────────────────────────────────────
const BulkStatusModal = ({atms:sel,onSave,onClose}) => {
  const [ns,setNs]=useState("");
  return (
    <Modal title="Bulk Status Update" subtitle={`Update status for ${sel.length} ATMs`} onClose={onClose} width={440}>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{background:C.surface,borderRadius:8,padding:"10px 14px",maxHeight:160,overflowY:"auto"}}>
          {sel.map(a=><div key={a.id} style={{fontSize:13,color:C.text,padding:"3px 0"}}><span style={{fontFamily:"monospace",fontWeight:600}}>{a.terminalId}</span> <span style={{color:C.textMuted}}>— {a.location}</span></div>)}
        </div>
        <Input label="New Status" value={ns} onChange={setNs} required options={STATUSES}/>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={()=>ns&&onSave(ns)} disabled={!ns}>Update {sel.length} ATMs</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Bulk Reassign Modal ──────────────────────────────────────────────────────
const BulkReassignModal = ({atms:sel,engineers,onSave,onClose}) => {
  const [eid,setEid]=useState("");
  const eng=engineers.find(e=>String(e.id)===eid);
  return (
    <Modal title="Bulk Reassign Engineer" subtitle={`Reassign engineer for ${sel.length} ATMs`} onClose={onClose} width={440}>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{background:C.surface,borderRadius:8,padding:"10px 14px",maxHeight:160,overflowY:"auto"}}>
          {sel.map(a=><div key={a.id} style={{fontSize:13,color:C.text,padding:"3px 0"}}><span style={{fontFamily:"monospace",fontWeight:600}}>{a.terminalId}</span> <span style={{color:C.textMuted}}>— {a.location}</span></div>)}
        </div>
        <Input label="New Engineer" value={eid} onChange={setEid} required options={engineers.map(e=>({value:e.id,label:`${e.name} (${e.region})`}))}/>
        {eng&&<div style={{background:C.accentLight,borderRadius:8,padding:"10px 14px",fontSize:13,color:C.accent,fontWeight:500}}>👷 {eng.name} will be assigned to {sel.length} ATM{sel.length!==1?"s":""}</div>}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={()=>eid&&onSave(Number(eid))} disabled={!eid}>Reassign {sel.length} ATMs</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Bulk Delete Modal ────────────────────────────────────────────────────────
const BulkDeleteModal = ({atms:sel,onConfirm,onClose}) => (
  <Modal title="Bulk Delete ATMs" onClose={onClose} width={440}>
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{background:C.redLight,border:"1px solid #fecaca",borderRadius:8,padding:"12px 14px",fontSize:13,color:C.red,fontWeight:500}}>
        ⚠️ Permanently delete {sel.length} ATM{sel.length!==1?"s":""} and all their maintenance records. This cannot be undone.
      </div>
      <div style={{background:C.surface,borderRadius:8,padding:"10px 14px",maxHeight:180,overflowY:"auto"}}>
        {sel.map(a=><div key={a.id} style={{fontSize:13,padding:"3px 0"}}><span style={{fontFamily:"monospace",fontWeight:600,color:C.text}}>{a.terminalId}</span> <span style={{color:C.textMuted}}>— {a.location}</span></div>)}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm}>Delete {sel.length} ATMs</Btn>
      </div>
    </div>
  </Modal>
);

// ─── Forms ────────────────────────────────────────────────────────────────────
const defaultBank = {name:"",shortCode:"",contactPerson:"",contactPhone:"",contactEmail:"",headquarters:"",notes:""};
const BankForm = ({initial,onSave,onClose}) => {
  const [form,setForm]=useState(initial||defaultBank);
  const set=k=>v=>setForm(f=>({...f,[k]:v}));
  const valid=form.name&&form.shortCode;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Input label="Bank Name" value={form.name} onChange={set("name")} required options={ZAMBIA_BANKS.map(b=>({value:b,label:b}))}/>
        <Input label="Short Code" value={form.shortCode} onChange={set("shortCode")} required placeholder="ZNC"/>
        <Input label="Contact Person" value={form.contactPerson} onChange={set("contactPerson")} placeholder="John Doe"/>
        <Input label="Contact Phone" value={form.contactPhone} onChange={set("contactPhone")} placeholder="+260 211 000 000"/>
        <Input label="Contact Email" value={form.contactEmail} onChange={set("contactEmail")} type="email" placeholder="ops@bank.zm"/>
        <Input label="Headquarters" value={form.headquarters} onChange={set("headquarters")} placeholder="Street, City"/>
      </div>
      <Input label="Notes" value={form.notes} onChange={set("notes")} placeholder="Any remarks…" rows={2}/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={()=>valid&&onSave(form)} disabled={!valid}>Save Bank</Btn></div>
    </div>
  );
};

const defaultAtm={terminalId:"",model:"",location:"",address:"",bankId:"",engineerId:"",status:"Active",installDate:"",serialNumber:"",notes:""};
const AtmForm = ({initial,engineers,banks,onSave,onClose}) => {
  const [form,setForm]=useState(initial||defaultAtm);
  const set=k=>v=>setForm(f=>({...f,[k]:v}));
  const valid=form.terminalId&&form.model&&form.location&&form.engineerId&&form.bankId;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Input label="Terminal ID" value={form.terminalId} onChange={set("terminalId")} placeholder="ATM-ZNC-001" required/>
        <Input label="Serial Number" value={form.serialNumber} onChange={set("serialNumber")} placeholder="NCR684001ZM"/>
        <Input label="NCR Model" value={form.model} onChange={set("model")} required options={NCR_MODELS}/>
        <Input label="Status" value={form.status} onChange={set("status")} options={STATUSES}/>
        <Input label="Bank / Client" value={form.bankId} onChange={set("bankId")} required options={banks.map(b=>({value:b.id,label:`${b.name} (${b.shortCode})`}))}/>
        <Input label="Assigned Engineer" value={form.engineerId} onChange={set("engineerId")} required options={engineers.map(e=>({value:e.id,label:`${e.name} (${e.region})`}))}/>
        <Input label="Location Name" value={form.location} onChange={set("location")} placeholder="Cairo Road Branch" required/>
        <Input label="Install Date" value={form.installDate} onChange={set("installDate")} type="date"/>
      </div>
      <Input label="Full Address" value={form.address} onChange={set("address")} placeholder="Street, City"/>
      <Input label="Notes" value={form.notes} onChange={set("notes")} placeholder="Any remarks…" rows={2}/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={()=>valid&&onSave(form)} disabled={!valid}>Save ATM</Btn></div>
    </div>
  );
};

const defaultMaint={atmId:"",type:"Quarterly PM",status:"Scheduled",scheduledDate:"",completedDate:"",engineerId:"",notes:"",quarter:qtr(today),year:today.getFullYear()};
const MaintForm = ({initial,atms,engineers,banks,onSave,onClose}) => {
  const [form,setForm]=useState(initial||defaultMaint);
  const set=k=>v=>setForm(f=>({...f,[k]:v}));
  const valid=form.atmId&&form.type&&form.scheduledDate&&form.engineerId;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Input label="ATM" value={form.atmId} onChange={set("atmId")} required options={atms.map(a=>{const b=banks.find(bk=>bk.id==a.bankId);return {value:a.id,label:`${a.terminalId} — ${a.location}${b?` [${b.shortCode}]`:""}`};})}/>
        <Input label="Engineer" value={form.engineerId} onChange={set("engineerId")} required options={engineers.map(e=>({value:e.id,label:e.name}))}/>
        <Input label="Type" value={form.type} onChange={set("type")} options={MAINT_TYPES}/>
        <Input label="Status" value={form.status} onChange={set("status")} options={MAINT_STATUS}/>
        <Input label="Scheduled Date" value={form.scheduledDate} onChange={set("scheduledDate")} type="date" required/>
        <Input label="Completed Date" value={form.completedDate} onChange={set("completedDate")} type="date"/>
        <Input label="Quarter" value={form.quarter} onChange={set("quarter")} options={["1","2","3","4"]}/>
        <Input label="Year" value={form.year} onChange={set("year")} type="number" placeholder="2024"/>
      </div>
      <Input label="Notes / Work Done" value={form.notes} onChange={set("notes")} placeholder="Describe work performed…" rows={3}/>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={()=>valid&&onSave(form)} disabled={!valid}>Save Record</Btn></div>
    </div>
  );
};

const defaultEng={name:"",phone:"",email:"",region:""};
const EngForm = ({initial,onSave,onClose}) => {
  const [form,setForm]=useState(initial||defaultEng);
  const set=k=>v=>setForm(f=>({...f,[k]:v}));
  const valid=form.name&&form.region;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Input label="Full Name" value={form.name} onChange={set("name")} required placeholder="John Doe"/>
        <Input label="Region" value={form.region} onChange={set("region")} required placeholder="Lusaka"/>
        <Input label="Phone" value={form.phone} onChange={set("phone")} placeholder="+260 97 000 0000"/>
        <Input label="Email" value={form.email} onChange={set("email")} type="email" placeholder="j.doe@company.zm"/>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={()=>valid&&onSave(form)} disabled={!valid}>Save Engineer</Btn></div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const PM_DUE_PAGE = 8;
const Dashboard = ({atms,maintenance,engineers,banks,onBulkPM,pmBannerDismissed,onDismissPMBanner}) => {
  const active=atms.filter(a=>a.status==="Active").length;
  const offline=atms.filter(a=>a.status==="Offline").length;
  const um=atms.filter(a=>a.status==="Under Maintenance").length;
  const cQ=qtr(today),cY=today.getFullYear();
  const pmDue=atms.filter(a=>!maintenance.some(m=>m.atmId==a.id&&m.type==="Quarterly PM"&&m.quarter==cQ&&m.year==cY&&m.status==="Completed"));
  const {page:pmPg,setPage:setPmPg,totalPages:pmTP,slice:pmSlice,total:pmTotal}=usePagination(pmDue,PM_DUE_PAGE);
  const recent=[...maintenance].sort((a,b)=>new Date(b.scheduledDate)-new Date(a.scheduledDate)).slice(0,6);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <StatCard label="Total ATMs"     value={atms.length}  sub="in fleet"              color={C.accent}  icon="🏧"/>
        <StatCard label="Banks Served"   value={banks.length} sub="client banks"          color={C.purple}  icon="🏦"/>
        <StatCard label="Active"         value={active}       sub="online & operational"  color={C.green}   icon="✅"/>
        <StatCard label="Offline"        value={offline}      sub="need attention"        color={C.red}     icon="🔴"/>
        <StatCard label="In Maintenance" value={um}           sub="being serviced"        color={C.amber}   icon="🔧"/>
        <StatCard label={`Q${cQ} PM Due`} value={pmDue.length} sub="need quarterly PM"   color={pmDue.length>0?C.amber:C.green} icon="📋"/>
      </div>

      {pmDue.length>0&&!pmBannerDismissed&&(
        <div style={{background:`linear-gradient(135deg,${C.tealLight},#e0f2fe)`,border:`1.5px solid ${C.teal}44`,borderRadius:12,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,position:"relative"}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.teal}}>⚡ {pmDue.length} ATM{pmDue.length!==1?"s":""} need Q{cQ} {cY} Preventive Maintenance</div>
            <div style={{fontSize:13,color:C.teal+"bb",marginTop:2}}>Use Bulk PM Log to log all of them at once in seconds</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Btn variant="teal" onClick={onBulkPM}>⚡ Bulk PM Log Now</Btn>
            <button onClick={onDismissPMBanner} title="Dismiss" style={{background:"rgba(8,145,178,.12)",border:"none",borderRadius:7,cursor:"pointer",fontSize:16,color:C.teal,padding:"6px 8px",lineHeight:1,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}} aria-label="Dismiss banner">×</button>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <Card>
          <div style={{padding:"18px 20px 12px",borderBottom:`1px solid ${C.border}`}}><h3 style={{margin:0,fontSize:15,fontWeight:700,color:C.text}}>ATMs by Bank</h3></div>
          <div style={{padding:"8px 0"}}>
            {banks.map((bank,i)=>{const count=atms.filter(a=>a.bankId==bank.id).length;const pct=atms.length?Math.round((count/atms.length)*100):0;const col=bankColor(i);return(
              <div key={bank.id} className="pm-due-row" style={{padding:"10px 20px",borderBottom:`1px solid ${C.surface}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:2,background:col}}/><span style={{fontSize:13,fontWeight:600,color:C.text}}>{bank.name}</span></div><span style={{fontSize:13,fontWeight:700,color:col}}>{count}</span></div>
                <div style={{height:5,borderRadius:4,background:C.surface}}><div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:4,transition:"width .5s"}}/></div>
              </div>
            );})}
            {banks.length===0&&<EmptyState message="No banks added yet"/>}
          </div>
        </Card>
        <Card>
          <div style={{padding:"18px 20px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
            <h3 style={{margin:0,fontSize:15,fontWeight:700,color:C.text}}>Q{cQ} {cY} — PM Due</h3>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {pmDue.length>0&&<span style={{fontSize:12,color:C.textMuted}}>{pmTotal} ATMs</span>}
              {pmDue.length>0&&<Btn small variant="teal" onClick={onBulkPM}>⚡ Bulk Log</Btn>}
            </div>
          </div>
          {pmDue.length===0?(<div style={{padding:"24px 20px",textAlign:"center",color:C.green,fontSize:14,fontWeight:600}}>✓ All ATMs have Q{cQ} PM completed</div>):(
            <>
            <div style={{padding:"8px 0"}}>
              {pmSlice.map(a=>{const eng=engineers.find(e=>e.id==a.engineerId);const bank=banks.find(b=>b.id==a.bankId);return(
                <div key={a.id} className="pm-due-row" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px",borderBottom:`1px solid ${C.surface}`}}>
                  <div><div style={{fontSize:14,fontWeight:600,color:C.text}}>{a.terminalId}</div><div style={{fontSize:12,color:C.textMuted}}>{a.location} · {bank?.shortCode}</div></div>
                  <div style={{textAlign:"right"}}><Badge label={a.status} color={statusColor(a.status)} bg={statusBg(a.status)}/><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{eng?.name}</div></div>
                </div>
              );})}
            </div>
            <Paginator page={pmPg} totalPages={pmTP} total={pmTotal} pageSize={PM_DUE_PAGE} setPage={setPmPg}/>
            </>
          )}
        </Card>
      </div>

      <Card>
        <div style={{padding:"18px 20px 12px",borderBottom:`1px solid ${C.border}`}}><h3 style={{margin:0,fontSize:15,fontWeight:700,color:C.text}}>Recent Maintenance</h3></div>
        {recent.length===0?<EmptyState message="No records yet"/>:(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`}}>
                {["ATM","Bank","Type","Engineer","Date","Status"].map(h=><th key={h} style={{padding:"10px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.04em"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {recent.map(m=>{const atm=atms.find(a=>a.id==m.atmId);const eng=engineers.find(e=>e.id==m.engineerId);const bank=banks.find(b=>b.id==atm?.bankId);const bi=banks.findIndex(b=>b.id==atm?.bankId);const col=bankColor(bi);return(
                  <tr key={m.id} className="data-row" style={{borderBottom:`1px solid ${C.surface}`}}>
                    <td style={{padding:"11px 16px",fontWeight:700,fontSize:13,color:C.text,fontFamily:"monospace"}}>{atm?.terminalId}</td>
                    <td style={{padding:"11px 16px"}}>{bank&&<span style={{background:col+"18",border:`1px solid ${col}30`,borderRadius:5,padding:"2px 6px",fontSize:11,fontWeight:700,color:col}}>{bank.shortCode}</span>}</td>
                    <td style={{padding:"11px 16px",fontSize:13,fontWeight:600,color:C.text}}>{m.type}</td>
                    <td style={{padding:"11px 16px",fontSize:13,color:C.text}}>{eng?.name}</td>
                    <td style={{padding:"11px 16px",fontSize:13,color:C.textMid}}>{fmt(m.scheduledDate)}</td>
                    <td style={{padding:"11px 16px"}}><Badge label={m.status} color={mColor(m.status)} bg={mBg(m.status)}/></td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

// ─── ATM List ─────────────────────────────────────────────────────────────────
const AtmList = ({atms,engineers,banks,maintenance,onAdd,onEdit,onDelete,onView,onBulkPM,onBulkStatus,onBulkReassign,onBulkDelete}) => {
  const [search,setSearch]=useState("");
  const [fStatus,setFS]=useState("");
  const [fBank,setFB]=useState("");
  const [sel,setSel]=useState(new Set());

  const filtered=atms.filter(a=>{const bank=banks.find(b=>b.id==a.bankId);const txt=`${a.terminalId} ${a.location} ${a.model} ${bank?.name}`.toLowerCase();return(!search||txt.includes(search.toLowerCase()))&&(!fStatus||a.status===fStatus)&&(!fBank||String(a.bankId)===fBank);});
  const {page:atmPg,setPage:setAtmPg,totalPages:atmTP,slice:atmSlice,total:atmTotal}=usePagination(filtered);
  const toggleOne=(id)=>{const n=new Set(sel);n.has(id)?n.delete(id):n.add(id);setSel(n);};
  const toggleAll=(c)=>setSel(c?new Set(filtered.map(a=>a.id)):new Set());
  const selAtms=atms.filter(a=>sel.has(a.id));
  const allChk=atmSlice.length>0&&atmSlice.every(a=>sel.has(a.id));
  const someChk=atmSlice.some(a=>sel.has(a.id));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.text}}>ATM Fleet</h2>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ATMs…" style={{padding:"8px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",width:200,color:C.text}}/>
          <select value={fBank} onChange={e=>setFB(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",color:C.text,background:"#fff"}}>
            <option value="">All Banks</option>{banks.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={fStatus} onChange={e=>setFS(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",color:C.text,background:"#fff"}}>
            <option value="">All Statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
          <Btn variant="teal" onClick={()=>onBulkPM([])}>⚡ Bulk PM</Btn>
          <Btn onClick={onAdd}>+ Add ATM</Btn>
        </div>
      </div>

      {sel.size>0&&(
        <BulkBar count={sel.size} onClear={()=>setSel(new Set())} actions={[
          {label:"Log PM",            icon:"📋", onClick:()=>onBulkPM(selAtms)},
          {label:"Update Status",     icon:"🔄", onClick:()=>onBulkStatus(selAtms)},
          {label:"Reassign Engineer", icon:"👷", onClick:()=>onBulkReassign(selAtms)},
          {label:"Delete",            icon:"🗑", variant:"danger", onClick:()=>onBulkDelete(selAtms)},
        ]}/>
      )}

      <Card>
        {filtered.length===0?<EmptyState message="No ATMs found"/>:(
          <>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`}}>
                  <th style={{padding:"11px 16px",width:44}}><Checkbox checked={allChk} indeterminate={someChk&&!allChk} onChange={toggleAll}/></th>
                  {["Terminal ID","Bank","Model","Location","Engineer","Status","Install Date",""].map(h=>(
                    <th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:C.textMuted,whiteSpace:"nowrap",letterSpacing:"0.04em",textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atmSlice.map(atm=>{
                  const eng=engineers.find(e=>e.id==atm.engineerId);
                  const bank=banks.find(b=>b.id==atm.bankId);
                  const bi=banks.findIndex(b=>b.id==atm.bankId);
                  const col=bankColor(bi);
                  const isSelected=sel.has(atm.id);
                  return (
                    <tr key={atm.id} className="data-row" style={{borderBottom:`1px solid ${C.surface}`,background:isSelected?C.accentLight+"55":"transparent"}}>
                      <td style={{padding:"13px 16px"}} onClick={e=>{e.stopPropagation();toggleOne(atm.id);}}><Checkbox checked={isSelected} onChange={()=>toggleOne(atm.id)}/></td>
                      <td style={{padding:"13px 16px"}}><div style={{fontWeight:700,fontSize:13,color:C.text,fontFamily:"monospace"}}>{atm.terminalId}</div>{atm.serialNumber&&<div style={{fontSize:11,color:C.textMuted}}>{atm.serialNumber}</div>}</td>
                      <td style={{padding:"13px 16px"}}>{bank&&<span style={{background:col+"18",border:`1px solid ${col}30`,borderRadius:6,padding:"3px 8px",fontSize:12,fontWeight:700,color:col}}>{bank.shortCode}</span>}</td>
                      <td style={{padding:"13px 16px",fontSize:13,fontWeight:600,color:C.text}}>{atm.model}</td>
                      <td style={{padding:"13px 16px"}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>{atm.location}</div><div style={{fontSize:11,color:C.textMuted}}>{atm.address}</div></td>
                      <td style={{padding:"13px 16px"}}><div style={{fontSize:13,color:C.text}}>{eng?.name||"—"}</div><div style={{fontSize:11,color:C.textMuted}}>{eng?.region}</div></td>
                      <td style={{padding:"13px 16px"}}><Badge label={atm.status} color={statusColor(atm.status)} bg={statusBg(atm.status)}/></td>
                      <td style={{padding:"13px 16px",fontSize:13,color:C.textMid}}>{fmt(atm.installDate)}</td>
                      <td style={{padding:"13px 16px"}}><div style={{display:"flex",gap:5}}><Btn small variant="ghost" onClick={()=>onView(atm)}>View</Btn><Btn small variant="secondary" onClick={()=>onEdit(atm)}>Edit</Btn><Btn small variant="danger" onClick={()=>onDelete(atm)}>Del</Btn></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginator page={atmPg} totalPages={atmTP} total={atmTotal} pageSize={PAGE_SIZE} setPage={setAtmPg}/>
          </>
        )}
      </Card>
      {sel.size>0&&<div style={{fontSize:12,color:C.textMuted,textAlign:"right"}}>{sel.size} selected across all pages · use bulk actions above</div>}
    </div>
  );
};

// ─── ATM Detail ───────────────────────────────────────────────────────────────
const AtmDetail = ({atm,engineers,banks,maintenance,onClose,onAddMaint}) => {
  const eng=engineers.find(e=>e.id==atm.engineerId);
  const bank=banks.find(b=>b.id==atm.bankId);
  const records=maintenance.filter(m=>m.atmId==atm.id).sort((a,b)=>new Date(b.scheduledDate)-new Date(a.scheduledDate));
  const cQ=qtr(today),cY=today.getFullYear();
  const pmDone=records.some(m=>m.type==="Quarterly PM"&&m.quarter==cQ&&m.year==cY&&m.status==="Completed");
  return (
    <Modal title={`${atm.terminalId} — Details`} onClose={onClose} width={680}>
      <div style={{display:"flex",flexDirection:"column",gap:20}}>
        <div style={{background:C.surface,borderRadius:10,padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[["Terminal ID",atm.terminalId],["Serial Number",atm.serialNumber||"—"],["Model",atm.model],["Status",atm.status],["Bank / Client",bank?`${bank.name} (${bank.shortCode})`:"—"],["Install Date",fmt(atm.installDate)],["Location",atm.location],["Engineer",eng?`${eng.name} (${eng.region})`:"—"],["Address",atm.address||"—","full"]].map(([k,v,span])=>(
            <div key={k} style={span?{gridColumn:"1/-1"}:{}}><div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>{k}</div><div style={{fontSize:14,fontWeight:600,color:C.text,marginTop:2}}>{v}</div></div>
          ))}
        </div>
        {atm.notes&&<div style={{background:C.amberLight,border:"1px solid #fde68a",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#92400e"}}>📝 {atm.notes}</div>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:pmDone?C.greenLight:C.amberLight,borderRadius:8,padding:"12px 16px"}}>
          <div><div style={{fontSize:14,fontWeight:700,color:pmDone?C.green:C.amber}}>{pmDone?`✓ Q${cQ} ${cY} PM Completed`:`⚠ Q${cQ} ${cY} PM Not Done`}</div><div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Quarterly preventive maintenance status</div></div>
          <Btn small onClick={onAddMaint}>+ Log Maintenance</Btn>
        </div>
        <div>
          <h4 style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:C.text}}>Maintenance History ({records.length})</h4>
          {records.length===0?<EmptyState message="No records yet"/>:(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {records.map(m=>{const e=engineers.find(en=>en.id==m.engineerId);return(
                <div key={m.id} style={{background:C.surface,borderRadius:8,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div><div style={{fontWeight:600,fontSize:14,color:C.text}}>{m.type}</div><div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Q{m.quarter} {m.year} · {fmt(m.scheduledDate)}{m.completedDate&&` → ${fmt(m.completedDate)}`} · {e?.name}</div>{m.notes&&<div style={{fontSize:12,color:C.textMid,marginTop:4}}>{m.notes}</div>}</div>
                  <Badge label={m.status} color={mColor(m.status)} bg={mBg(m.status)}/>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ─── Maintenance Module ───────────────────────────────────────────────────────
const MaintenanceModule = ({maintenance,atms,engineers,banks,onAdd,onEdit,onDelete,onBulkPM,onFilteredChange,onExport}) => {
  const [search,setSearch]=useState("");
  const [fStatus,setFS]=useState("");
  const [fQ,setFQ]=useState("");
  const [fYear,setFY]=useState(String(today.getFullYear()));
  const [fBank,setFB]=useState("");
  const filtered=maintenance.filter(m=>{const atm=atms.find(a=>a.id==m.atmId);const eng=engineers.find(e=>e.id==m.engineerId);const bank=banks.find(b=>b.id==atm?.bankId);const txt=`${atm?.terminalId} ${atm?.location} ${eng?.name} ${m.type} ${bank?.name}`.toLowerCase();return(!search||txt.includes(search.toLowerCase()))&&(!fStatus||m.status===fStatus)&&(!fQ||String(m.quarter)===fQ)&&(!fYear||String(m.year)===fYear)&&(!fBank||String(atm?.bankId)===fBank);}).sort((a,b)=>new Date(b.scheduledDate)-new Date(a.scheduledDate));
  const {page:mp,setPage:setMP,totalPages:mTP,slice:mSlice,total:mTotal}=usePagination(filtered);
  // Notify parent whenever filtered set changes so nav-bar export always reflects current view
  const prevFilterKey = useRef("");
  const filterKey = `${search}|${fStatus}|${fQ}|${fYear}|${fBank}|${maintenance.length}`;
  if (filterKey !== prevFilterKey.current) { prevFilterKey.current = filterKey; onFilteredChange?.(filtered, {search,fStatus,fQ,fYear,fBank}); }
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.text}}>Maintenance Tracker</h2>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn variant="secondary" onClick={onExport}>📄 Export PDF</Btn>
          <Btn variant="teal" onClick={onBulkPM}>⚡ Bulk PM Log</Btn>
          <Btn onClick={onAdd}>+ Log Maintenance</Btn>
        </div>
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        {[["Scheduled",C.amber,C.amberLight],["In Progress",C.accent,C.accentLight],["Completed",C.green,C.greenLight],["Cancelled",C.textMuted,C.surface]].map(([s,c,bg])=>(
          <div key={s} style={{background:bg,border:`1px solid ${c}22`,borderRadius:10,padding:"12px 20px",display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:22,fontWeight:800,color:c}}>{maintenance.filter(m=>m.status===s).length}</span>
            <span style={{fontSize:13,fontWeight:600,color:c}}>{s}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{padding:"8px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",width:180,color:C.text}}/>
        <select value={fBank} onChange={e=>setFB(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",color:C.text,background:"#fff"}}><option value="">All Banks</option>{banks.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select value={fStatus} onChange={e=>setFS(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",color:C.text,background:"#fff"}}><option value="">All Statuses</option>{MAINT_STATUS.map(s=><option key={s}>{s}</option>)}</select>
        <select value={fYear} onChange={e=>setFY(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:`1.5px solid ${fYear?C.accent:C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",color:fYear?C.accent:C.text,fontWeight:fYear?700:400,background:"#fff"}}>
          <option value="">All Years</option>
          {Array.from(new Set(maintenance.map(m=>String(m.year)))).sort((a,b)=>Number(b)-Number(a)).map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <select value={fQ} onChange={e=>setFQ(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",color:C.text,background:"#fff"}}><option value="">All Quarters</option>{["1","2","3","4"].map(q=><option key={q} value={q}>Q{q}</option>)}</select>
        {(fYear||fQ||fStatus||fBank||search)&&<button onClick={()=>{setSearch("");setFS("");setFQ("");setFY("");setFB("");}} style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,fontSize:13,fontFamily:"inherit",color:C.textMuted,cursor:"pointer"}}>✕ Clear</button>}
      </div>
      <Card>
        {filtered.length===0?<EmptyState message="No records found"/>:(
          <>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`}}>
                {["ATM","Bank","Type","Quarter","Engineer","Scheduled","Completed","Status",""].map(h=><th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:C.textMuted,whiteSpace:"nowrap",letterSpacing:"0.04em",textTransform:"uppercase"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {mSlice.map(m=>{const atm=atms.find(a=>a.id==m.atmId);const eng=engineers.find(e=>e.id==m.engineerId);const bank=banks.find(b=>b.id==atm?.bankId);const bi=banks.findIndex(b=>b.id==atm?.bankId);const col=bankColor(bi);return(
                  <tr key={m.id} className="maint-row" style={{borderBottom:`1px solid ${C.surface}`}}>
                    <td style={{padding:"12px 16px",fontWeight:700,fontSize:13,color:C.text,fontFamily:"monospace"}}>{atm?.terminalId}<div style={{fontSize:11,color:C.textMuted,fontFamily:"inherit"}}>{atm?.location}</div></td>
                    <td style={{padding:"12px 16px"}}>{bank&&<span style={{background:col+"18",border:`1px solid ${col}30`,borderRadius:5,padding:"2px 6px",fontSize:11,fontWeight:700,color:col}}>{bank.shortCode}</span>}</td>
                    <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:C.text}}>{m.type}</td>
                    <td style={{padding:"12px 16px",fontSize:13,color:C.textMid}}>Q{m.quarter} {m.year}</td>
                    <td style={{padding:"12px 16px",fontSize:13,color:C.text}}>{eng?.name}</td>
                    <td style={{padding:"12px 16px",fontSize:13,color:C.textMid}}>{fmt(m.scheduledDate)}</td>
                    <td style={{padding:"12px 16px",fontSize:13,color:m.completedDate?C.green:C.textMuted}}>{fmt(m.completedDate)}</td>
                    <td style={{padding:"12px 16px"}}><Badge label={m.status} color={mColor(m.status)} bg={mBg(m.status)}/></td>
                    <td style={{padding:"12px 16px"}}><div style={{display:"flex",gap:5}}><Btn small variant="secondary" onClick={()=>onEdit(m)}>Edit</Btn><Btn small variant="danger" onClick={()=>onDelete(m)}>Del</Btn></div></td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
          <Paginator page={mp} totalPages={mTP} total={mTotal} pageSize={PAGE_SIZE} setPage={setMP}/>
          </>
        )}
      </Card>
    </div>
  );
};

// ─── Banks Module ─────────────────────────────────────────────────────────────
const BanksModule = ({banks,atms,onAdd,onEdit,onDelete}) => {
  const [search, setSearch] = useState("");
  const filtered = banks.filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.shortCode.toLowerCase().includes(search.toLowerCase()));
  const { page, setPage, totalPages, slice, total } = usePagination(filtered, 9);
  return (
  <div style={{display:"flex",flexDirection:"column",gap:20}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
      <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.text}}>Banks</h2>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search banks…" style={{padding:"8px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",width:180,color:C.text}}/>
        <Btn onClick={onAdd}>+ Add Bank</Btn>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
      {slice.map((bank)=>{const bi=banks.indexOf(bank);const bankAtms=atms.filter(a=>a.bankId==bank.id);const active=bankAtms.filter(a=>a.status==="Active").length;const offline=bankAtms.filter(a=>a.status==="Offline").length;const inMaint=bankAtms.filter(a=>a.status==="Under Maintenance").length;const col=bankColor(bi);const visibleAtms=bankAtms.slice(0,8);const extra=bankAtms.length-8;return(
        <Card key={bank.id} className="bank-card" style={{padding:0,overflow:"hidden"}}>
          <div className="bank-color-strip" style={{height:5,background:col,transition:"height .2s ease"}}/>
          <div style={{padding:20}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:44,height:44,borderRadius:10,background:col+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:col,border:`1.5px solid ${col}30`}}>{bank.shortCode}</div>
                <div><div style={{fontWeight:700,fontSize:15,color:C.text}}>{bank.name}</div>{bank.headquarters&&<div style={{fontSize:12,color:C.textMuted,marginTop:1}}>📍 {bank.headquarters}</div>}</div>
              </div>
              <div style={{display:"flex",gap:6}}><Btn small variant="ghost" onClick={()=>onEdit(bank)}>Edit</Btn><Btn small variant="danger" onClick={()=>onDelete(bank)}>Del</Btn></div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:13,color:C.textMid,marginBottom:14}}>
              {bank.contactPerson&&<div>👤 {bank.contactPerson}</div>}
              {bank.contactPhone&&<div>📞 {bank.contactPhone}</div>}
              {bank.contactEmail&&<div>✉️ {bank.contactEmail}</div>}
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
              <div style={{fontSize:12,fontWeight:700,color:C.textMuted,marginBottom:8}}>ATM FLEET ({bankAtms.length})</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {[["Active",active,C.green,C.greenLight],["Offline",offline,C.red,C.redLight],["Maint",inMaint,C.amber,C.amberLight]].map(([l,c,cl,bg])=>(
                  <div key={l} style={{flex:1,textAlign:"center",background:bg,borderRadius:8,padding:"7px 4px"}}><div style={{fontSize:18,fontWeight:800,color:cl}}>{c}</div><div style={{fontSize:11,fontWeight:600,color:cl}}>{l}</div></div>
                ))}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,maxHeight:72,overflow:"hidden"}}>
                {visibleAtms.map(a=><span key={a.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:600,color:C.text}}>{a.terminalId}</span>)}
                {extra>0&&<span style={{background:C.accentLight,border:`1px solid ${C.accent}33`,borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:700,color:C.accent}}>+{extra} more</span>}
              </div>
            </div>
            {bank.notes&&<div style={{marginTop:10,background:C.amberLight,borderRadius:7,padding:"8px 12px",fontSize:12,color:"#92400e"}}>📝 {bank.notes}</div>}
          </div>
        </Card>
      );})}
      {filtered.length===0&&<EmptyState message="No banks found"/>}
    </div>
    {totalPages>1&&(
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <span style={{fontSize:13,color:C.textMuted}}>Showing <b style={{color:C.text}}>{(page-1)*9+1}–{Math.min(page*9,total)}</b> of <b style={{color:C.text}}>{total}</b> banks</span>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"#fff",cursor:page===1?"not-allowed":"pointer",color:page===1?C.textMuted:C.text,fontSize:13,fontFamily:"inherit",opacity:page===1?.5:1}}>‹ Prev</button>
          {Array.from({length:totalPages},(_,i)=>i+1).map(p=><button key={p} onClick={()=>setPage(p)} style={{width:32,height:32,borderRadius:7,border:`1.5px solid ${p===page?C.accent:C.border}`,background:p===page?C.accent:"#fff",color:p===page?"#fff":C.text,fontWeight:p===page?700:400,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>{p}</button>)}
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"#fff",cursor:page===totalPages?"not-allowed":"pointer",color:page===totalPages?C.textMuted:C.text,fontSize:13,fontFamily:"inherit",opacity:page===totalPages?.5:1}}>Next ›</button>
        </div>
      </div>
    )}
  </div>
  );
};

// ─── Engineers Module ─────────────────────────────────────────────────────────
const EngineersModule = ({engineers,atms,banks,onAdd,onEdit,onDelete}) => {
  const [search, setSearch] = useState("");
  const filtered = engineers.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.region.toLowerCase().includes(search.toLowerCase()));
  const { page, setPage, totalPages, slice, total } = usePagination(filtered, 9);
  return (
  <div style={{display:"flex",flexDirection:"column",gap:20}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
      <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.text}}>Field Engineers</h2>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search engineers…" style={{padding:"8px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",width:180,color:C.text}}/>
        <Btn onClick={onAdd}>+ Add Engineer</Btn>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
      {slice.map(eng=>{const assigned=atms.filter(a=>a.engineerId==eng.id);const visibleAtms=assigned.slice(0,8);const extra=assigned.length-8;return(
        <Card key={eng.id} className="eng-card" style={{padding:20}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:44,height:44,borderRadius:22,background:C.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:C.accent}}>{eng.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
              <div><div style={{fontWeight:700,fontSize:15,color:C.text}}>{eng.name}</div><div style={{fontSize:12,color:C.textMuted}}>{eng.region} Region</div></div>
            </div>
            <div style={{display:"flex",gap:6}}><Btn small variant="ghost" onClick={()=>onEdit(eng)}>Edit</Btn><Btn small variant="danger" onClick={()=>onDelete(eng)}>Del</Btn></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:13,color:C.textMid}}>
            {eng.phone&&<div>📞 {eng.phone}</div>}
            {eng.email&&<div>✉️ {eng.email}</div>}
          </div>
          <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
            <div style={{fontSize:12,fontWeight:700,color:C.textMuted,marginBottom:8}}>ASSIGNED ATMs ({assigned.length})</div>
            {assigned.length===0?<div style={{fontSize:12,color:C.textMuted}}>No ATMs assigned</div>:(
              <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:80,overflow:"hidden"}}>
                {visibleAtms.map(a=>{const bi=banks.findIndex(b=>b.id==a.bankId);const col=bankColor(bi);return <span key={a.id} style={{background:col+"12",border:`1px solid ${col}25`,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:600,color:col}}>{a.terminalId}</span>;})}
                {extra>0&&<span style={{background:C.accentLight,border:`1px solid ${C.accent}33`,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,color:C.accent}}>+{extra} more</span>}
              </div>
            )}
          </div>
        </Card>
      );})}
      {filtered.length===0&&<EmptyState message="No engineers found"/>}
    </div>
    {totalPages>1&&(
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <span style={{fontSize:13,color:C.textMuted}}>Showing <b style={{color:C.text}}>{(page-1)*9+1}–{Math.min(page*9,total)}</b> of <b style={{color:C.text}}>{total}</b> engineers</span>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"#fff",cursor:page===1?"not-allowed":"pointer",color:page===1?C.textMuted:C.text,fontSize:13,fontFamily:"inherit",opacity:page===1?.5:1}}>‹ Prev</button>
          {Array.from({length:totalPages},(_,i)=>i+1).map(p=><button key={p} onClick={()=>setPage(p)} style={{width:32,height:32,borderRadius:7,border:`1.5px solid ${p===page?C.accent:C.border}`,background:p===page?C.accent:"#fff",color:p===page?"#fff":C.text,fontWeight:p===page?700:400,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>{p}</button>)}
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"#fff",cursor:page===totalPages?"not-allowed":"pointer",color:page===totalPages?C.textMuted:C.text,fontSize:13,fontFamily:"inherit",opacity:page===totalPages?.5:1}}>Next ›</button>
        </div>
      </div>
    )}
  </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App(props: PageProps) {
  const { atms: rawAtms, banks: rawBanks, engineers: rawEngineers, maintenance: rawMaint } = usePage<PageProps>().props;

  const atms        = (rawAtms        || []).map(normAtm);
  const banks       = (rawBanks       || []).map(normBank);
  const engineers   = (rawEngineers   || []);
  const maintenance = (rawMaint       || []).map(normMaint);

  const [page,setPage]           = useState("dashboard");
  const [modal,setModal]         = useState(null);
  const [bulkModal,setBulkModal] = useState(null);
  const [confirm,setConfirm]     = useState(null);
  const [viewAtm,setViewAtm]     = useState(null);
  const { toast, ToastContainer } = useToast();
  const [pmBannerDismissed, setPmBannerDismissed] = useState(false);
  const [processing, setProcessing] = useState(false);
  // Lifted from MaintenanceModule so nav bar export always has current filtered set
  const [exportableMaint, setExportableMaint] = useState<{records:any[];meta:any}>({records:[],meta:{search:"",fStatus:"",fQ:"",fBank:""}});
  const handleExportPDF = useCallback(() => {
    exportMaintenancePDF(exportableMaint.records, atms, engineers, banks, exportableMaint.meta, toast);
  }, [exportableMaint, atms, engineers, banks, toast]);

  const closeModal = () => setModal(null);
  const closeBulk  = () => setBulkModal(null);

  const opts = (onDone) => ({
    preserveScroll: true,
    onStart:   () => setProcessing(true),
    onFinish:  () => setProcessing(false),
    onSuccess: onDone,
    onError:   (e) => { toast(Object.values(e)[0] || "Something went wrong", "error"); setProcessing(false); },
  });

  // Bank CRUD
  const saveBank = useCallback((f) => {
    if (f.id) {
      router.put(`/banks/${f.id}`, { name:f.name, short_code:f.shortCode, contact_person:f.contactPerson, contact_phone:f.contactPhone, contact_email:f.contactEmail, headquarters:f.headquarters, notes:f.notes },
        opts(() => { toast(`Bank "${f.name}" updated`, "success"); closeModal(); }));
    } else {
      router.post("/banks", { name:f.name, short_code:f.shortCode, contact_person:f.contactPerson, contact_phone:f.contactPhone, contact_email:f.contactEmail, headquarters:f.headquarters, notes:f.notes },
        opts(() => { toast(`Bank "${f.name}" added`, "success"); closeModal(); }));
    }
  }, [toast]);

  const deleteBank = useCallback((b) => {
    setConfirm({ message: `Remove ${b.name}? Linked ATMs will become unassigned.`, onConfirm: () => {
      router.delete(`/banks/${b.id}`, opts(() => { toast(`Bank "${b.name}" removed`, "warning"); setConfirm(null); }));
    }});
  }, [toast]);

  // ATM CRUD
  const saveAtm = useCallback((f) => {
    const payload = { terminal_id:f.terminalId, serial_number:f.serialNumber, model:f.model, location:f.location, address:f.address, bank_id:f.bankId, engineer_id:f.engineerId, status:f.status, install_date:f.installDate, notes:f.notes };
    if (f.id) {
      router.put(`/atms/${f.id}`, payload, opts(() => { toast(`ATM ${f.terminalId} updated`, "success"); closeModal(); }));
    } else {
      router.post("/atms", payload, opts(() => { toast(`ATM ${f.terminalId} added to fleet`, "success"); closeModal(); }));
    }
  }, [toast]);

  const deleteAtm = useCallback((a) => {
    setConfirm({ message: `Delete ATM ${a.terminalId}? Cannot be undone.`, onConfirm: () => {
      router.delete(`/atms/${a.id}`, opts(() => { toast(`ATM ${a.terminalId} deleted`, "error"); setConfirm(null); }));
    }});
  }, [toast]);

  // Bulk ATM ops
  const handleBulkStatus = useCallback((sel, ns) => {
    router.post("/atms/bulk-status", { ids: sel.map(a => a.id), status: ns },
      opts(() => { toast(`${sel.length} ATM${sel.length!==1?"s":""} set to "${ns}"`, "success"); closeBulk(); }));
  }, [toast]);

  const handleBulkReassign = useCallback((sel, eid) => {
    router.post("/atms/bulk-reassign", { ids: sel.map(a => a.id), engineer_id: eid },
      opts(() => { toast(`${sel.length} ATM${sel.length!==1?"s":""} reassigned`, "success"); closeBulk(); }));
  }, [toast]);

  const handleBulkDelete = useCallback((sel) => {
    router.post("/atms/bulk-delete", { ids: sel.map(a => a.id) },
      opts(() => { toast(`${sel.length} ATM${sel.length!==1?"s":""} deleted`, "error"); closeBulk(); }));
  }, [toast]);

  // Maintenance CRUD + Bulk PM
  const saveMaint = useCallback((f) => {
    const payload = { atm_id:f.atmId, engineer_id:f.engineerId, type:f.type, status:f.status, scheduled_date:f.scheduledDate, completed_date:f.completedDate||null, quarter:f.quarter, year:f.year, notes:f.notes };
    if (f.id) {
      router.put(`/maintenance/${f.id}`, payload, opts(() => { toast("Maintenance record updated", "success"); closeModal(); }));
    } else {
      router.post("/maintenance", payload, opts(() => { toast("Maintenance record logged", "success"); closeModal(); }));
    }
  }, [toast]);

  const deleteMaint = useCallback((m) => {
    setConfirm({ message: `Delete maintenance record for Q${m.quarter} ${m.year}?`, onConfirm: () => {
      router.delete(`/maintenance/${m.id}`, opts(() => { toast("Maintenance record deleted", "error"); setConfirm(null); }));
    }});
  }, [toast]);

  const handleBulkPM = useCallback((records) => {
    const payload = records.map(r => ({ atm_id:r.atmId, engineer_id:r.engineerId, type:r.type, status:r.status, scheduled_date:r.scheduledDate, completed_date:r.completedDate||null, quarter:r.quarter, year:r.year, notes:r.notes }));
    router.post("/maintenance/bulk", { records: payload },
      opts(() => { toast(`${records.length} PM record${records.length!==1?"s":""} logged successfully`, "success"); }));
  }, [toast]);

  // Engineer CRUD
  const saveEng = useCallback((f) => {
    if (f.id) {
      router.put(`/engineers/${f.id}`, f, opts(() => { toast(`Engineer ${f.name} updated`, "success"); closeModal(); }));
    } else {
      router.post("/engineers", f, opts(() => { toast(`Engineer ${f.name} added`, "success"); closeModal(); }));
    }
  }, [toast]);

  const deleteEng = useCallback((e) => {
    setConfirm({ message: `Remove engineer ${e.name}?`, onConfirm: () => {
      router.delete(`/engineers/${e.id}`, opts(() => { toast(`Engineer ${e.name} removed`, "warning"); setConfirm(null); }));
    }});
  }, [toast]);

  const navItems=[{id:"dashboard",label:"Dashboard",icon:"◈"},{id:"banks",label:"Banks",icon:"🏦"},{id:"atms",label:"ATM Fleet",icon:"🏧"},{id:"maintenance",label:"Maintenance",icon:"🔧"},{id:"engineers",label:"Engineers",icon:"👷"},{id:"jobcards",label:"Job Cards",icon:"📋"}];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = (id) => { setPage(id); setDrawerOpen(false); };

  // Auth user from Inertia shared props
  const { auth } = usePage().props as any;
  const authUser  = auth?.user;
  const initials  = authUser?.name?.split(" ").map(n=>n[0]).join("").slice(0,2) ?? "A";
  const handleLogout = () => router.post("/logout");

  return (
    <div className="atm-app" style={{background:C.bg,color:C.text}}>

      {/* ── DESKTOP NAV ── */}
      <nav className="desktop-nav" style={{background:C.navBg}}>
        <div className="desktop-nav__inner">
          <div className="nav-logo">
            <div className="nav-logo__icon" style={{background:C.accent}}>🏧</div>
            <div><div className="nav-logo__name" style={{color:C.text}}>NCR Fleet</div><div className="nav-logo__sub" style={{color:C.textMuted}}>ATM MANAGER</div></div>
          </div>
          <div className="nav-links">
            {navItems.map(n=>(
              <button key={n.id} onClick={()=>setPage(n.id)} className="nav-link"
                style={{background:page===n.id?"#fff":"transparent",fontWeight:page===n.id?700:500,color:page===n.id?C.accent:C.textMid,boxShadow:page===n.id?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>
                <span className="nav-link__icon">{n.icon}</span>{n.label}
              </button>
            ))}
          </div>
          <Btn small variant="teal" onClick={()=>setBulkModal({type:"bulkPM",atms:[]})}>⚡ Bulk PM</Btn>
          <div className="nav-chips">
            <div className="nav-chip" style={{color:C.purple}}>🏦 {banks.length}</div>
            <div className="nav-chip" style={{color:C.textMid}}>🏧 {atms.length}</div>
          </div>
          {/* ── Profile dropdown ── */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setProfileOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:`1px solid ${C.border}`,borderRadius:20,padding:"5px 12px 5px 6px",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              <div style={{width:28,height:28,borderRadius:14,background:C.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:C.accent}}>{initials}</div>
              <span style={{fontSize:13,fontWeight:600,color:C.textMid,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser?.name ?? "Admin"}</span>
              <span style={{fontSize:10,color:C.textMuted}}>{profileOpen?"▲":"▼"}</span>
            </button>
            {profileOpen&&(
              <div onClick={()=>setProfileOpen(false)} style={{position:"absolute",top:"calc(100% + 8px)",right:0,background:"#fff",border:`1px solid ${C.border}`,borderRadius:14,boxShadow:"0 8px 24px rgba(0,0,0,.10)",minWidth:200,zIndex:500,overflow:"hidden"}}>
                <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,background:C.surface}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{authUser?.name ?? "Admin"}</div>
                  <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>{authUser?.email ?? ""}</div>
                </div>
                <div style={{padding:8}}>
                  <button onClick={handleLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:"none",background:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.danger}}>
                    <span>🚪</span> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-topbar" style={{background:C.navBg}}>
        <button onClick={()=>setDrawerOpen(true)} className="hamburger">
          <span className="hamburger__bar" style={{background:C.text}}/>
          <span className="hamburger__bar" style={{background:C.text}}/>
          <span className="hamburger__bar" style={{background:C.text}}/>
        </button>
        <div className="mobile-topbar__logo">
          <div className="mobile-topbar__icon" style={{background:C.accent}}>🏧</div>
          <div className="mobile-topbar__title" style={{color:C.text}}>NCR Fleet</div>
        </div>
        <button onClick={()=>setBulkModal({type:"bulkPM",atms:[]})} style={{background:C.tealLight,border:`1px solid ${C.teal}44`,borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:700,color:C.teal,cursor:"pointer",fontFamily:"inherit"}}>⚡ PM</button>
      </div>

      {/* ── MOBILE DRAWER ── */}
      {drawerOpen&&<div className="drawer-overlay" onClick={()=>setDrawerOpen(false)}/>}
      <div className="side-drawer" style={{transform:drawerOpen?"translateX(0)":"translateX(-100%)"}}>
        <div className="drawer-header" style={{background:C.navBg}}>
          <div className="drawer-logo">
            <div className="drawer-logo__icon" style={{background:C.accent}}>🏧</div>
            <div><div className="drawer-logo__name" style={{color:C.text}}>NCR Fleet</div><div className="drawer-logo__sub" style={{color:C.textMuted}}>ATM Manager</div></div>
          </div>
          <button onClick={()=>setDrawerOpen(false)} className="drawer-close" style={{color:C.textMuted}}>×</button>
        </div>
        <div className="drawer-stats">
          {[[banks.length,"Banks",C.purple,C.purpleLight],[atms.length,"ATMs",C.accent,C.accentLight],[atms.filter(a=>a.status==="Active").length,"Active",C.green,C.greenLight]].map(([v,l,c,bg])=>(
            <div key={l} style={{flex:1,background:bg,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:11,fontWeight:600,color:c,marginTop:1}}>{l}</div>
            </div>
          ))}
        </div>
        <nav className="drawer-nav">
          <div className="drawer-nav__label" style={{color:C.textMuted}}>Navigation</div>
          {navItems.map(n=>{const active=page===n.id;return(
            <button key={n.id} onClick={()=>navigate(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 12px",borderRadius:10,border:"none",background:active?C.accentLight:"transparent",cursor:"pointer",fontFamily:"inherit",marginBottom:2,transition:"all .15s",textAlign:"left"}}>
              <span style={{fontSize:20,width:28,textAlign:"center",lineHeight:1}}>{n.icon}</span>
              <span style={{fontSize:15,fontWeight:active?700:500,color:active?C.accent:C.text}}>{n.label}</span>
              {active&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:3,background:C.accent}}/>}
            </button>
          );})}
          <div className="drawer-divider"/>
          <button onClick={()=>{setDrawerOpen(false);setBulkModal({type:"bulkPM",atms:[]});}} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 12px",borderRadius:10,border:`1.5px solid ${C.teal}44`,background:C.tealLight,cursor:"pointer",fontFamily:"inherit",marginBottom:6}}>
            <span style={{fontSize:20,width:28,textAlign:"center"}}>⚡</span>
            <div><div style={{fontSize:14,fontWeight:700,color:C.teal}}>Bulk PM Log</div><div style={{fontSize:11,color:C.teal+"99",marginTop:1}}>Log PM for multiple ATMs</div></div>
          </button>
        </nav>
        <div style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`,background:C.surface}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:32,height:32,borderRadius:16,background:C.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:C.accent}}>{initials}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser?.name??"Admin"}</div>
              <div style={{fontSize:11,color:C.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser?.email??""}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.danger}}>
            🚪 Sign Out
          </button>
          <div style={{fontSize:11,color:C.textMuted,textAlign:"center",marginTop:10}}>NCR Fleet · Techmasters Zambia</div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content">
        {page==="dashboard"   &&<Dashboard   atms={atms} maintenance={maintenance} engineers={engineers} banks={banks} onBulkPM={()=>setBulkModal({type:"bulkPM",atms:[]})} pmBannerDismissed={pmBannerDismissed} onDismissPMBanner={()=>{ setPmBannerDismissed(true); toast("PM reminder dismissed","info"); }}/>}
        {page==="banks"       &&<BanksModule banks={banks} atms={atms} onAdd={()=>setModal({type:"bank"})} onEdit={b=>setModal({type:"bank",data:b})} onDelete={deleteBank}/>}
        {page==="atms"        &&<AtmList     atms={atms} engineers={engineers} banks={banks} maintenance={maintenance}
            onAdd={()=>setModal({type:"atm"})} onEdit={a=>setModal({type:"atm",data:a})} onDelete={deleteAtm} onView={setViewAtm}
            onBulkPM={sel=>setBulkModal({type:"bulkPM",atms:sel})}
            onBulkStatus={sel=>setBulkModal({type:"bulkStatus",atms:sel})}
            onBulkReassign={sel=>setBulkModal({type:"bulkReassign",atms:sel})}
            onBulkDelete={sel=>setBulkModal({type:"bulkDelete",atms:sel})}/>}
        {page==="maintenance" &&<MaintenanceModule maintenance={maintenance} atms={atms} engineers={engineers} banks={banks}
            onAdd={()=>setModal({type:"maint"})} onEdit={m=>setModal({type:"maint",data:m})} onDelete={deleteMaint}
            onBulkPM={()=>setBulkModal({type:"bulkPM",atms:[]})}
            onFilteredChange={(records,meta)=>setExportableMaint({records,meta})}
            onExport={handleExportPDF}/>}
        {page==="engineers"   &&<EngineersModule   engineers={engineers} atms={atms} banks={banks} onAdd={()=>setModal({type:"eng"})} onEdit={e=>setModal({type:"eng",data:e})} onDelete={deleteEng}/>}
        {page==="jobcards"    &&<JobCardsModule    atms={atms} engineers={engineers} banks={banks}/>}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <div className="mobile-bottom-nav">
        {navItems.map(n=>{const active=page===n.id;return(
          <button key={n.id} onClick={()=>navigate(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 4px 12px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit",position:"relative"}}>
            {active&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:32,height:3,borderRadius:"0 0 3px 3px",background:C.accent}}/>}
            <span style={{fontSize:18,lineHeight:1}}>{n.icon}</span>
            <span style={{fontSize:10,fontWeight:active?700:500,color:active?C.accent:C.textMuted,lineHeight:1}}>{n.label}</span>
          </button>
        );})}
      </div>

      {/* Modals */}
      {modal?.type==="bank"  &&<Modal title={modal.data?"Edit Bank":"Add Bank"} onClose={closeModal} width={560}><BankForm initial={modal.data} onSave={saveBank} onClose={closeModal}/></Modal>}
      {modal?.type==="atm"   &&<Modal title={modal.data?"Edit ATM":"Add ATM to Fleet"} onClose={closeModal} width={600}><AtmForm initial={modal.data} engineers={engineers} banks={banks} onSave={saveAtm} onClose={closeModal}/></Modal>}
      {modal?.type==="maint" &&<Modal title={modal.data?"Edit Maintenance Record":"Log Maintenance"} onClose={closeModal} width={600}><MaintForm initial={modal.data} atms={atms} engineers={engineers} banks={banks} onSave={saveMaint} onClose={closeModal}/></Modal>}
      {modal?.type==="eng"   &&<Modal title={modal.data?"Edit Engineer":"Add Engineer"} onClose={closeModal} width={480}><EngForm initial={modal.data} onSave={saveEng} onClose={closeModal}/></Modal>}
      {bulkModal?.type==="bulkPM"&&<Modal title="⚡ Bulk Maintenance Log" subtitle="Log preventive maintenance for multiple ATMs at once" onClose={closeBulk} width={740}><BulkPMWizard atms={atms} engineers={engineers} banks={banks} onSave={handleBulkPM} onClose={closeBulk}/></Modal>}
      {bulkModal?.type==="bulkStatus"&&<BulkStatusModal atms={bulkModal.atms} onSave={ns=>handleBulkStatus(bulkModal.atms,ns)} onClose={closeBulk}/>}
      {bulkModal?.type==="bulkReassign"&&<BulkReassignModal atms={bulkModal.atms} engineers={engineers} onSave={eid=>handleBulkReassign(bulkModal.atms,eid)} onClose={closeBulk}/>}
      {bulkModal?.type==="bulkDelete"&&<BulkDeleteModal atms={bulkModal.atms} onConfirm={()=>handleBulkDelete(bulkModal.atms)} onClose={closeBulk}/>}
      {viewAtm&&<AtmDetail atm={viewAtm} engineers={engineers} banks={banks} maintenance={maintenance} onClose={()=>setViewAtm(null)} onAddMaint={()=>{ setViewAtm(null); setModal({type:"maint",data:{...defaultMaint,atmId:viewAtm.id,engineerId:viewAtm.engineerId}}); }}/>}
      {confirm&&<Confirm message={confirm.message} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)}/>}
      <ToastContainer/>
    </div>
  );
}

// Bypass Inertia default layout
App.layout = (page) => page;
