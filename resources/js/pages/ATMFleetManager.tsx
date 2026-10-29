// @ts-nocheck
/* eslint-disable */
import { useState, useCallback, useRef, useEffect } from "react";
import { router, usePage } from "@inertiajs/react";

// ── Modules ──────────────────────────────────────────────────────────────────
import { C, NCR_MODELS, STATUSES, MAINT_TYPES, MAINT_STATUS, ZAMBIA_BANKS, bankColor, PAGE_SIZE } from "./constants";
import { fmt, fmtISO, today, qtr, statusColor, statusBg, mColor, mBg, normAtm, normBank, normMaint, addCompanyLogo, getCompanyLogoData } from "./helpers";
import { useToast, usePagination } from "./hooks";
import { Badge, Btn, Input, Modal, Card, StatCard, EmptyState, Confirm, Checkbox, Paginator, BulkBar } from "./components/ui";
import type { PageProps } from "./types";
import "./atm-fleet.css";
import JobCardsModule from "./JobCardsModule";
import CallsModule from "./CallsModule";

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
    const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const now = new Date().toLocaleString("en-GB");
    const logoData = await getCompanyLogoData();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 8;
    const logoWidth = 52;
    const logoProps = doc.getImageProperties(logoData);
    const logoHeight = logoWidth * logoProps.height / logoProps.width;
    const headerTextX = marginX + logoWidth + 5;
    const headerTextWidth = pageWidth - marginX - headerTextX;
    const headerText = `Maintenance Report · Generated: ${now} · Records: ${records.length}`;

    // ── Active filters summary ────────────────────────────────────────────────
    const filters: string[] = [];
    if (meta.search)   filters.push(`Search: "${meta.search}"`);
    if (meta.fBank)    filters.push(`Bank: ${banks.find(b => String(b.id) === meta.fBank)?.name ?? meta.fBank}`);
    if (meta.fStatus)  filters.push(`Status: ${meta.fStatus}`);
    if (meta.fYear)    filters.push(`Year: ${meta.fYear}`);
    if (meta.fQ)       filters.push(`Quarter: Q${meta.fQ}`);
    const filterLine = filters.length ? filters.join("   ·   ") : "All records (no filters applied)";

    // ── Summary chips ─────────────────────────────────────────────────────────
    const statusCounts: Record<string,number> = {};
    records.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
    const chips = [
      ["Completed",   statusCounts["Completed"]   || 0, [16,179,102]],
      ["Scheduled",   statusCounts["Scheduled"]   || 0, [245,158,11]],
      ["In Progress", statusCounts["In Progress"] || 0, [29,110,245]],
      ["Cancelled",   statusCounts["Cancelled"]   || 0, [139,144,154]],
    ] as const;
    const chipGap = 4;
    const chipWidth = (pageWidth - marginX * 2 - chipGap * (chips.length - 1)) / chips.length;
    let cx = marginX;
    chips.forEach(([label, count, [r,g,b]]) => {
      doc.setFillColor(r,g,b);
      doc.roundedRect(cx, 27, chipWidth, 9, 2, 2, "F");
      doc.setTextColor(255,255,255);
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(`${count}`, cx + 4, 33);
      doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
      doc.text(label, cx + 13, 33);
      cx += chipWidth + chipGap;
    });

    doc.setFillColor(238, 243, 254);
    doc.rect(0, 16, pageWidth, 8, "F");
    doc.setTextColor(29, 110, 245);
    doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
    doc.text(`Filters: ${filterLine}`, marginX, 21.5);

    // ── Table ─────────────────────────────────────────────────────────────────
    const rows = records.map(m => {
      const atm  = atms.find(a => a.id == m.atmId);
      const eng  = engineers.find(e => e.id == m.engineerId);
      const bank = banks.find(b => b.id == atm?.bankId);
      return [
        atm?.terminalId ?? "—",
        bank?.shortCode ?? "—",
        atm?.location   ?? "—",
        `Q${m.quarter} ${m.year}`,
        eng?.name       ?? "—",
        fmt(m.scheduledDate),
        m.completedDate ? fmt(m.completedDate) : "—",
        m.status,
      ];
    });

    const statusColor = (s: string) => {
      if (s === "Completed")   return [16,179,102];
      if (s === "Scheduled")   return [245,158,11];
      if (s === "In Progress") return [29,110,245];
      return [139,144,154];
    };

    const drawFirstPageHeader = () => {
      doc.addImage(logoData, "PNG", marginX, 5, logoWidth, logoHeight);
      doc.setTextColor(26, 29, 35);
      doc.setFont("helvetica", "bold");
      let fontSize = 8;
      doc.setFontSize(fontSize);
      while (doc.getTextWidth(headerText) > headerTextWidth && fontSize > 5.5) {
        fontSize -= 0.25;
        doc.setFontSize(fontSize);
      }
      doc.text(headerText, headerTextX, 5 + logoHeight / 2 + fontSize / 3);
    };

    (doc as any).autoTable({
      startY: 41,
      head: [["Terminal ID","Bank","Location","Quarter","Engineer","Scheduled","Date","Status"]],
      body: rows,
      styles: { fontSize: 7.5, cellPadding: 2, font: "helvetica", textColor: [26,29,35], overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: [26,29,35], textColor: 255, fontStyle: "bold", fontSize: 7.5, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248,249,251] },
      rowPageBreak: "avoid",
      showHead: "everyPage",
      columnStyles: {
        0: { cellWidth: 26, fontStyle: "bold", textColor: [29,110,245] },
        1: { cellWidth: 16 },
        2: { cellWidth: 36 },
        3: { cellWidth: 18 },
        4: { cellWidth: 28 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 24 },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 7) {
          const s = data.cell.raw as string;
          const [r,g,b] = statusColor(s);
          data.cell.styles.textColor = [r,g,b];
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: (data: any) => {
        if (data.pageNumber === 1) drawFirstPageHeader();
      },
      margin: { top: 10, left: marginX, right: marginX, bottom: 10 },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      doc.setPage(pageNumber);
      doc.setFontSize(7.5); doc.setTextColor(139,144,154); doc.setFont("helvetica","normal");
      doc.text(`Techmasters Zambia · Confidential`, marginX, pageHeight - 4);
      doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - marginX, pageHeight - 4, { align: "right" });
    }

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

async function exportEngineerPmProgressPDF(
  progress: { engineer: any; completed: number; total: number; remaining: number; percentage: number }[],
  quarter: number,
  year: number,
  toast: (msg: string, type: any) => void,
) {
  if (progress.length === 0) {
    toast(`No engineer PM progress to export for Q${quarter} ${year}`, "warning");
    return;
  }

  try {
    const JsPDF = await loadJsPDF();
    const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const logoData = await getCompanyLogoData();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const logoProps = doc.getImageProperties(logoData);
    const logoWidth = pageWidth - marginX * 2;
    const logoHeight = logoWidth * logoProps.height / logoProps.width;
    const total = progress.reduce((sum, item) => sum + item.total, 0);
    const completed = progress.reduce((sum, item) => sum + item.completed, 0);
    const remaining = total - completed;
    const percentage = total ? Math.round(completed / total * 100) : 0;
    const reportDate = new Date().toLocaleString("en-GB");

    doc.addImage(logoData, "PNG", marginX, 5, logoWidth, logoHeight);
    const titleY = logoHeight + 12;
    doc.setTextColor(26, 29, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`Engineer PM Progress — Q${quarter} ${year}`, marginX, titleY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Generated: ${reportDate}`, marginX, titleY + 6);

    const summaryY = titleY + 12;
    const summaryGap = 4;
    const summaryWidth = (pageWidth - marginX * 2 - summaryGap * 3) / 4;
    const summaryItems = [
      { label: "Scheduled", value: total, color: [29, 110, 245] },
      { label: "Completed", value: completed, color: [16, 179, 102] },
      { label: "Remaining", value: remaining, color: [245, 158, 11] },
      { label: "Overall", value: `${percentage}%`, color: [8, 145, 178] },
    ];
    summaryItems.forEach((item, index) => {
      const x = marginX + index * (summaryWidth + summaryGap);
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.roundedRect(x, summaryY, summaryWidth, 17, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(String(item.value), x + summaryWidth / 2, summaryY + 7, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(item.label, x + summaryWidth / 2, summaryY + 13, { align: "center" });
    });

    (doc as any).autoTable({
      startY: summaryY + 23,
      margin: { left: marginX, right: marginX, top: 14, bottom: 12 },
      head: [["Engineer", "Assigned", "Completed", "Remaining", "Progress"]],
      body: progress.map(item => [item.engineer.name, item.total, item.completed, item.remaining, ""]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 3, textColor: [26, 29, 35], valign: "middle" },
      headStyles: { fillColor: [26, 29, 35], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      rowPageBreak: "avoid",
      showHead: "everyPage",
      columnStyles: {
        0: { cellWidth: 62, fontStyle: "bold" },
        1: { cellWidth: 24, halign: "center" },
        2: { cellWidth: 27, halign: "center" },
        3: { cellWidth: 27, halign: "center" },
        4: { cellWidth: "auto" },
      },
      didDrawCell: (data: any) => {
        if (data.section !== "body" || data.column.index !== 4) return;
        const item = progress[data.row.index];
        const barX = data.cell.x + 3;
        const barY = data.cell.y + data.cell.height / 2 - 1.5;
        const barWidth = data.cell.width - 18;
        doc.setFillColor(232, 234, 237);
        doc.roundedRect(barX, barY, barWidth, 3, 1.5, 1.5, "F");
        if (item.percentage > 0) {
          doc.setFillColor(item.percentage === 100 ? 16 : 8, item.percentage === 100 ? 179 : 145, item.percentage === 100 ? 102 : 178);
          doc.roundedRect(barX, barY, barWidth * item.percentage / 100, 3, 1.5, 1.5, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(26, 29, 35);
        doc.text(`${item.percentage}%`, data.cell.x + data.cell.width - 3, data.cell.y + data.cell.height / 2 + 1, { align: "right" });
      },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      doc.setPage(pageNumber);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(139, 144, 154);
      doc.text(`Techmasters Zambia · Page ${pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    }

    doc.save(`engineer-pm-progress-Q${quarter}-${year}.pdf`);
    toast(`Engineer PM progress exported for Q${quarter} ${year}`, "success");
  } catch (error) {
    console.error(error);
    toast("Could not export engineer PM progress PDF.", "error");
  }
}

// ─── Change Password Modal ──────────────────────────────────────────────────────
const ChangePasswordModal = ({ onClose }: any) => {
  const [form, setForm] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const submit = () => {
    setSaving(true);
    router.put("/user/password", form, {
      onSuccess: () => {
        alert("Password updated successfully!");
        onClose();
      },
      onError: (err) => {
        setErrors(err);
        setSaving(false);
      },
      onFinish: () => setSaving(false)
    });
  };

  return (
    <Modal title="Change Password" onClose={onClose} width={400}>
      <div style={{ display:"flex", flexDirection:"column", gap: 16 }}>
        <div>
          <Input label="Current Password" type="password" value={form.current_password} onChange={(v:string)=>setForm({...form, current_password: v})} required />
          {errors.current_password && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{errors.current_password}</div>}
        </div>
        <div>
          <Input label="New Password" type="password" value={form.password} onChange={(v:string)=>setForm({...form, password: v})} required />
          {errors.password && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{errors.password}</div>}
        </div>
        <div>
          <Input label="Confirm New Password" type="password" value={form.password_confirmation} onChange={(v:string)=>setForm({...form, password_confirmation: v})} required />
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop: 8 }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={submit} disabled={saving}>{saving ? "Saving..." : "Change Password"}</Btn>
        </div>
      </div>
    </Modal>
  );
};

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
    onSave(
      selList.map(atm=>({atmId:atm.id,engineerId:getEng(atm),type:cfg.type,status:cfg.status,scheduledDate:cfg.scheduledDate,completedDate:cfg.status==="Completed"?cfg.completedDate:null,quarter:Number(cfg.quarter),year:Number(cfg.year),notes:cfg.notes})),
      ()=>setStep(3),
    );
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
            Successfully saved <b style={{color:C.green}}>{selList.length}</b> maintenance records as {cfg.status.toLowerCase()} for {cfg.type} · Q{cfg.quarter} {cfg.year}.
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

const defaultAtm={terminalId:"",model:"",location:"",address:"",bankId:"",engineerId:"",status:"Active",installDate:"",serialNumber:"",hasGbna:false,notes:""};
const AtmForm = ({initial,engineers,banks,onSave,onClose}) => {
  const [form,setForm]=useState(initial?{...initial,hasGbna:initial.has_gbna??initial.hasGbna??false}:defaultAtm);
  const set=k=>v=>setForm(f=>({...f,[k]:v}));
  const valid=form.terminalId&&form.model&&form.location&&form.bankId;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Input label="Terminal ID" value={form.terminalId} onChange={set("terminalId")} placeholder="ATM-ZNC-001" required/>
        <Input label="Serial Number" value={form.serialNumber} onChange={set("serialNumber")} placeholder="NCR684001ZM"/>
        <Input label="NCR Model" value={form.model} onChange={set("model")} required options={NCR_MODELS}/>
        <Input label="Status" value={form.status} onChange={set("status")} options={STATUSES}/>
        <Input label="Bank / Client" value={form.bankId} onChange={set("bankId")} required options={banks.map(b=>({value:b.id,label:`${b.name} (${b.shortCode})`}))}/>
        <Input label="Assigned Engineer (optional)" value={form.engineerId} onChange={set("engineerId")} options={[{value:"",label:"Unassigned"},...engineers.map(e=>({value:e.id,label:`${e.name} (${e.region})`}))]}/>
        <Input label="Location Name" value={form.location} onChange={set("location")} placeholder="Cairo Road Branch" required/>
        <Input label="Install Date" value={form.installDate} onChange={set("installDate")} type="date"/>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:9,fontSize:13,fontWeight:600,color:C.text}}>
        <input type="checkbox" checked={!!form.hasGbna} onChange={event=>set("hasGbna")(event.target.checked)}/>
        GBNA deposit module fitted (adds GBNA checks to PM job cards)
      </label>
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

const EngineerSignaturePad = ({value,onChange,label}:any) => {
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawing=useRef(false);
  useEffect(()=>{
    const canvas=canvasRef.current;
    const context=canvas?.getContext("2d");
    if(!canvas||!context)return;
    context.clearRect(0,0,600,150);
    if(value){
      const image=new Image();
      image.onload=()=>context.drawImage(image,0,0,600,150);
      image.src=value;
    }
  },[value]);
  const point=(event:any)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*600/rect.width,y:(event.clientY-rect.top)*150/rect.height};
  };
  const start=(event:any)=>{
    event.preventDefault();
    const context=event.currentTarget.getContext("2d");
    if(!context)return;
    const p=point(event);
    drawing.current=true;
    context.beginPath();
    context.moveTo(p.x,p.y);
    context.lineWidth=2.4;
    context.lineCap="round";
    context.strokeStyle="#132433";
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move=(event:any)=>{
    if(!drawing.current)return;
    const context=event.currentTarget.getContext("2d");
    if(!context)return;
    const p=point(event);
    context.lineTo(p.x,p.y);
    context.stroke();
  };
  const end=(event:any)=>{
    if(!drawing.current)return;
    drawing.current=false;
    onChange(event.currentTarget.toDataURL("image/png"));
  };
  const clear=()=>{
    const canvas=canvasRef.current;
    const context=canvas?.getContext("2d");
    if(!canvas||!context)return;
    context.clearRect(0,0,600,150);
    onChange("");
  };
  return <div>
    <label className="field-label">{label}</label>
    <canvas ref={canvasRef} width={600} height={150} onPointerDown={start} onPointerMove={move}
      onPointerUp={end} onPointerCancel={end}
      style={{width:"100%",height:90,display:"block",touchAction:"none",background:"#fff",border:`1px solid ${C.border}`,borderRadius:8}}/>
    <button type="button" onClick={clear} style={{marginTop:6,padding:0,border:0,background:"none",color:C.accent,fontWeight:700,cursor:"pointer"}}>Clear signature</button>
  </div>;
};

const defaultEng={name:"",phone:"",email:"",region:"",signature:"",create_login:false,password:"",password_confirmation:""};
const EngForm = ({initial,onSave,onClose}) => {
  const isEdit = !!initial?.id;
  const hasLogin = !!initial?.user_id;
  const [form,setForm] = useState(isEdit
    ? {...initial, signature:initial.signature||"", create_login:false, password:"", password_confirmation:"", revoke_login:false}
    : defaultEng);
  const set = k=>v=>setForm(f=>({...f,[k]:v}));

  const pwMismatch  = form.create_login && form.password && form.password_confirmation && form.password !== form.password_confirmation;
  const pwTooShort  = form.create_login && form.password && form.password.length < 8;
  const loginValid  = !form.create_login || (form.email && form.password.length >= 8 && form.password === form.password_confirmation);
  const valid       = form.name && form.region && loginValid;

  const inputStyle:any = {padding:"10px 14px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box",color:C.text,background:C.surface};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Basic info */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Input label="Full Name" value={form.name} onChange={set("name")} required placeholder="John Doe"/>
        <Input label="Region"    value={form.region} onChange={set("region")} required placeholder="Lusaka"/>
        <Input label="Phone"     value={form.phone}  onChange={set("phone")}  placeholder="+260 97 000 0000"/>
        <Input label="Email"     value={form.email}  onChange={set("email")}  type="email" placeholder="j.doe@techmasters.zm"/>
      </div>
      <EngineerSignaturePad label="Saved Engineer Signature" value={form.signature} onChange={set("signature")}/>

      {/* ── Portal login section ── */}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
        <div style={{fontSize:12,fontWeight:700,color:C.textMuted,letterSpacing:"0.06em",marginBottom:12}}>ENGINEER PORTAL ACCESS</div>

        {isEdit && hasLogin ? (
          /* ── Existing login — show status + revoke option ── */
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.successLight,border:`1px solid ${C.success}33`,borderRadius:10,padding:"12px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>🔐</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.success}}>Portal login active</div>
                  <div style={{fontSize:12,color:C.textMuted,marginTop:1}}>Engineer can sign in at /login</div>
                </div>
              </div>
              {/* Revoke toggle */}
              <button onClick={()=>set("revoke_login")(!form.revoke_login)} style={{
                display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,cursor:"pointer",
                fontFamily:"inherit",fontSize:12,fontWeight:600,border:`1px solid ${form.revoke_login?C.red:C.border}`,
                background:form.revoke_login?C.dangerLight:"#fff",color:form.revoke_login?C.red:C.textMid,
              }}>
                {form.revoke_login ? "↩ Undo revoke" : "🚫 Revoke login"}
              </button>
            </div>
            {form.revoke_login && (
              <div style={{background:C.dangerLight,border:`1px solid ${C.red}33`,borderRadius:8,padding:"10px 14px",fontSize:13,color:C.red,fontWeight:500}}>
                ⚠ Saving will delete this engineer's user account and remove portal access.
              </div>
            )}
          </div>
        ) : isEdit && !hasLogin ? (
          /* ── Edit, no login yet — offer to create one ── */
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.text}}>No portal login yet</div>
                <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Create a login so this engineer can access their portal</div>
              </div>
              <button onClick={()=>set("create_login")(!form.create_login)} style={{
                width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",
                background:form.create_login?C.accent:C.border,position:"relative",transition:"background .2s",flexShrink:0,
              }}>
                <span style={{position:"absolute",top:3,left:form.create_login?22:3,width:18,height:18,borderRadius:9,background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
              </button>
            </div>
            {form.create_login && (
              <div style={{display:"flex",flexDirection:"column",gap:12,background:C.accentLight,borderRadius:10,padding:14,border:`1px solid ${C.accent}22`}}>
                <div style={{fontSize:12,color:C.accent,fontWeight:600}}>🔐 Uses the email above as login. Set a password to complete.</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div className="field-wrap">
                    <label className="field-label">Password <span className="field-required">*</span></label>
                    <input type="password" value={form.password} onChange={e=>set("password")(e.target.value)}
                      placeholder="Min. 8 characters" style={{...inputStyle,borderColor:pwTooShort?C.red:C.border}}/>
                    {pwTooShort&&<div style={{fontSize:11,color:C.red,marginTop:4}}>At least 8 characters required</div>}
                  </div>
                  <div className="field-wrap">
                    <label className="field-label">Confirm Password <span className="field-required">*</span></label>
                    <input type="password" value={form.password_confirmation} onChange={e=>set("password_confirmation")(e.target.value)}
                      placeholder="Repeat password" style={{...inputStyle,borderColor:pwMismatch?C.red:C.border}}/>
                    {pwMismatch&&<div style={{fontSize:11,color:C.red,marginTop:4}}>Passwords do not match</div>}
                  </div>
                </div>
                {form.password&&form.password===form.password_confirmation&&form.password.length>=8&&(
                  <div style={{fontSize:12,color:C.success,fontWeight:600}}>✓ Password looks good</div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── Create mode — same toggle as before ── */
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>Create Engineer Portal Login</div>
                <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Engineer can log in at /login to access their portal</div>
              </div>
              <button onClick={()=>set("create_login")(!form.create_login)} style={{
                width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",
                background:form.create_login?C.accent:C.border,position:"relative",transition:"background .2s",flexShrink:0,
              }}>
                <span style={{position:"absolute",top:3,left:form.create_login?22:3,width:18,height:18,borderRadius:9,background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
              </button>
            </div>
            {form.create_login && (
              <div style={{display:"flex",flexDirection:"column",gap:12,background:C.accentLight,borderRadius:10,padding:14,border:`1px solid ${C.accent}22`}}>
                <div style={{fontSize:12,color:C.accent,fontWeight:600}}>🔐 Login email defaults to the email above. Set a password to complete.</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div className="field-wrap">
                    <label className="field-label">Password <span className="field-required">*</span></label>
                    <input type="password" value={form.password} onChange={e=>set("password")(e.target.value)}
                      placeholder="Min. 8 characters" style={{...inputStyle,borderColor:pwTooShort?C.red:C.border}}/>
                    {pwTooShort&&<div style={{fontSize:11,color:C.red,marginTop:4}}>At least 8 characters required</div>}
                  </div>
                  <div className="field-wrap">
                    <label className="field-label">Confirm Password <span className="field-required">*</span></label>
                    <input type="password" value={form.password_confirmation} onChange={e=>set("password_confirmation")(e.target.value)}
                      placeholder="Repeat password" style={{...inputStyle,borderColor:pwMismatch?C.red:C.border}}/>
                    {pwMismatch&&<div style={{fontSize:11,color:C.red,marginTop:4}}>Passwords do not match</div>}
                  </div>
                </div>
                {form.password&&form.password===form.password_confirmation&&form.password.length>=8&&(
                  <div style={{fontSize:12,color:C.success,fontWeight:600}}>✓ Password looks good</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={()=>valid&&onSave(form)} disabled={!valid} variant={form.revoke_login?"danger":undefined}>
          {form.revoke_login ? "Save + Revoke Login" : isEdit ? "Save Changes" : form.create_login ? "Add Engineer + Create Login" : "Add Engineer"}
        </Btn>
      </div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = ({atms,maintenance,approvedPmCards,engineers,banks,pendingCalls,slaBreachedCalls,onNavigate,onBulkPM,toast}) => {
  const currentQuarter=qtr(today),currentYear=today.getFullYear();
  const [selectedQuarter,setSelectedQuarter]=useState(currentQuarter);
  const [selectedYear,setSelectedYear]=useState(currentYear);
  const active=atms.filter(a=>a.status==="Active").length;
  const offline=atms.filter(a=>a.status==="Offline").length;
  const quarterPm=maintenance.filter(m=>m.type==="Quarterly PM"&&Number(m.quarter)===selectedQuarter&&Number(m.year)===selectedYear&&m.status!=="Cancelled"&&m.engineerId);
  const quarterApprovedPmCards=approvedPmCards.filter(card=>(card.job_type==="maintenance"||card.type==="Quarterly PM")
    &&Number(card.quarter)===selectedQuarter&&Number(card.year)===selectedYear&&card.engineer_id);
  const engineerProgress=engineers.map(engineer=>{
    const assignedAtms=new Set(quarterPm.filter(m=>String(m.engineerId)===String(engineer.id)).map(m=>String(m.atmId)));
    const completedAtms=new Set(quarterPm.filter(m=>String(m.engineerId)===String(engineer.id)&&m.status==="Completed").map(m=>String(m.atmId)));
    quarterApprovedPmCards.filter(card=>String(card.engineer_id)===String(engineer.id)).forEach(card=>{
      assignedAtms.add(String(card.atm_id));
      completedAtms.add(String(card.atm_id));
    });
    const total=assignedAtms.size;
    const completed=completedAtms.size;
    return {engineer,completed,total,remaining:total-completed,percentage:total?Math.round(completed/total*100):0};
  }).filter(progress=>progress.total>0).sort((a,b)=>b.percentage-a.percentage||b.completed-a.completed||a.engineer.name.localeCompare(b.engineer.name));
  const pmTotal=engineerProgress.reduce((total,progress)=>total+progress.total,0);
  const pmCompleted=engineerProgress.reduce((total,progress)=>total+progress.completed,0);
  const pmPercentage=pmTotal?Math.round(pmCompleted/pmTotal*100):0;
  const atmsByBank=atms.reduce((counts,atm)=>{
    const bankId=String(atm.bankId);
    counts.set(bankId,(counts.get(bankId)??0)+1);
    return counts;
  },new Map());
  const years=Array.from(new Set([currentYear,...maintenance.map(m=>Number(m.year)).filter(Number.isFinite)])).sort((a,b)=>b-a);
  const handleExportProgress=()=>exportEngineerPmProgressPDF(engineerProgress,selectedQuarter,selectedYear,(message,type)=>toast(message,type));
  const recent=[...maintenance].sort((a,b)=>new Date(b.scheduledDate)-new Date(a.scheduledDate)).slice(0,6);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <button type="button" className="dashboard-stat-link" onClick={()=>onNavigate("calls","pending")} aria-label="View pending calls">
          <StatCard label="Pending Calls" value={pendingCalls} sub="awaiting assignment" color={C.amber} icon="📞"/>
        </button>
        <button type="button" className="dashboard-stat-link" onClick={()=>onNavigate("calls","sla_breached")} aria-label="View SLA-breached calls">
          <StatCard label="SLA Breached" value={slaBreachedCalls} sub="missed response target" color={slaBreachedCalls?C.red:C.green} icon="⏱️"/>
        </button>
        <StatCard label="Active"         value={active}       sub="online & operational"  color={C.green}   icon="✅"/>
        <StatCard label="Offline"        value={offline}      sub="need attention"        color={C.red}     icon="🔴"/>
        <StatCard label="PM Progress" value={`${pmPercentage}%`} sub={`${pmCompleted}/${pmTotal} completed`} color={pmPercentage===100?C.green:C.teal} icon="📊"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <Card>
          <div style={{padding:"18px 20px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <h3 style={{margin:0,fontSize:15,fontWeight:700,color:C.text}}>ATMs by Bank</h3>
            <span style={{fontSize:12,color:C.textMuted}}><strong style={{color:C.text}}>{atms.length}</strong> ATMs · <strong style={{color:C.text}}>{banks.length}</strong> banks</span>
          </div>
          <div style={{padding:"8px 0"}}>
            {banks.map((bank,i)=>{const count=atmsByBank.get(String(bank.id))??0;const pct=atms.length?Math.round((count/atms.length)*100):0;const col=bankColor(i);return(
              <div key={bank.id} className="pm-due-row" style={{padding:"10px 20px",borderBottom:`1px solid ${C.surface}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:2,background:col}}/><span style={{fontSize:13,fontWeight:600,color:C.text}}>{bank.name}</span></div><span style={{fontSize:13,fontWeight:700,color:col}}>{count}</span></div>
                <div style={{height:5,borderRadius:4,background:C.surface}}><div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:4,transition:"width .5s"}}/></div>
              </div>
            );})}
            {atms.filter(atm=>!banks.some(bank=>String(bank.id)===String(atm.bankId))).length>0&&<div style={{padding:"10px 20px",color:C.textMuted,fontSize:12}}>Unassigned bank: <strong style={{color:C.text}}>{atms.filter(atm=>!banks.some(bank=>String(bank.id)===String(atm.bankId))).length} ATMs</strong></div>}
            {banks.length===0&&<EmptyState message="No banks added yet"/>}
          </div>
        </Card>
        <Card>
          <div style={{padding:"18px 20px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
            <div>
              <h3 style={{margin:0,fontSize:15,fontWeight:700,color:C.text}}>Q{selectedQuarter} {selectedYear} — PM Progress by Engineer</h3>
              <div style={{fontSize:12,color:C.textMuted,marginTop:3}}>{pmCompleted} of {pmTotal} scheduled PMs completed · {pmPercentage}% overall</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <select aria-label="PM progress quarter" value={selectedQuarter} onChange={event=>setSelectedQuarter(Number(event.target.value))} style={{padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,background:"#fff",color:C.text,fontFamily:"inherit",fontSize:12}}>
                {[1,2,3,4].map(quarter=><option key={quarter} value={quarter}>Q{quarter}</option>)}
              </select>
              <select aria-label="PM progress year" value={selectedYear} onChange={event=>setSelectedYear(Number(event.target.value))} style={{padding:"7px 9px",borderRadius:7,border:`1px solid ${C.border}`,background:"#fff",color:C.text,fontFamily:"inherit",fontSize:12}}>
                {years.map(year=><option key={year} value={year}>{year}</option>)}
              </select>
              <Btn small variant="secondary" onClick={handleExportProgress}>📄 Export Progress PDF</Btn>
              <Btn small variant="teal" onClick={onBulkPM}>⚡ Bulk PM Log</Btn>
            </div>
          </div>
          {engineerProgress.length===0
            ? <div style={{padding:"24px 20px",textAlign:"center",color:C.textMuted,fontSize:13}}>No quarterly PMs are assigned to engineers for Q{selectedQuarter} {selectedYear}.</div>
            : <div style={{padding:"8px 20px"}}>
                {engineerProgress.map(({engineer,completed,total,percentage})=>{
                  const color=percentage===100?C.green:percentage>0?C.teal:C.amber;
                  return <div key={engineer.id} style={{padding:"12px 0",borderBottom:`1px solid ${C.surface}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:7}}>
                      <span style={{fontSize:13,fontWeight:600,color:C.text}}>{engineer.name}</span>
                      <span style={{fontSize:12,fontWeight:700,color}}>{percentage}% <span style={{fontWeight:500,color:C.textMuted}}>({completed}/{total})</span></span>
                    </div>
                    <div role="progressbar" aria-label={`${engineer.name} quarterly PM progress`} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} style={{height:8,borderRadius:6,background:C.surface,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${percentage}%`,background:color,borderRadius:6,transition:"width .3s ease"}}/>
                    </div>
                  </div>;
                })}
              </div>}
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

const AdminNotifications = ({items,onNavigate}) => {
  const [open,setOpen]=useState(false);
  const [dismissed,setDismissed]=useState(new Set());
  const visibleItems=items.filter(item=>item.count>0&&!dismissed.has(`${item.key}:${item.count}`));
  const total=visibleItems.reduce((sum,item)=>sum+item.count,0);
  return (
    <div style={{position:"relative",flexShrink:0}}>
      <button type="button" onClick={()=>setOpen(value=>!value)} aria-label={`Notifications${total?`, ${total} active items`:""}`} aria-expanded={open} style={{
        position:"relative",width:36,height:36,borderRadius:18,background:"#fff",border:`1px solid ${C.border}`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:C.textMid,cursor:"pointer",
      }}>
        🔔
        {total>0&&<span style={{position:"absolute",top:-4,right:-5,minWidth:17,height:17,padding:"0 4px",borderRadius:10,background:C.red,color:"#fff",fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{total>99?"99+":total}</span>}
      </button>
      {open&&<div role="dialog" aria-label="Notifications" style={{
        position:"absolute",top:"calc(100% + 10px)",right:0,width:320,maxWidth:"calc(100vw - 28px)",
        background:"#fff",border:`1px solid ${C.border}`,borderRadius:12,boxShadow:"0 12px 32px rgba(0,0,0,.14)",zIndex:600,overflow:"hidden",
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderBottom:`1px solid ${C.border}`}}>
          <strong style={{fontSize:13,color:C.text}}>Notifications</strong>
          {visibleItems.length>0&&<span style={{fontSize:11,color:C.textMuted}}>{visibleItems.length} active</span>}
        </div>
        {visibleItems.length===0
          ? <div style={{padding:"20px 14px",fontSize:13,color:C.textMuted,textAlign:"center"}}>You’re all caught up.</div>
          : <div style={{maxHeight:360,overflowY:"auto"}}>
              {visibleItems.map(item=>(
                <div key={item.key} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderBottom:`1px solid ${C.surface}`}}>
                  <button type="button" onClick={()=>{onNavigate(item.page,item.filter);setOpen(false);}} style={{
                    display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flex:1,minWidth:0,
                    padding:0,textAlign:"left",border:0,background:"transparent",cursor:"pointer",fontFamily:"inherit",
                  }}>
                    <span style={{minWidth:0}}>
                      <span style={{display:"block",fontSize:12,fontWeight:700,color:C.text}}>{item.label}</span>
                      <span style={{display:"block",fontSize:11,color:C.textMuted,marginTop:2}}>{item.detail}</span>
                    </span>
                    <span style={{fontSize:15,fontWeight:800,color:C.amber,flexShrink:0}}>{item.count}</span>
                  </button>
                  <button type="button" onClick={()=>setDismissed(current=>new Set([...current,`${item.key}:${item.count}`]))} aria-label={`Dismiss ${item.label}`} title="Dismiss" style={{
                    width:24,height:24,border:0,borderRadius:6,background:"transparent",color:C.textMuted,fontSize:17,cursor:"pointer",flexShrink:0,
                  }}>×</button>
                </div>
              ))}
            </div>}
      </div>}
    </div>
  );
};

// ─── ATM List ─────────────────────────────────────────────────────────────────
const AtmList = ({atms,engineers,banks,maintenance,onAdd,onEdit,onDelete,onView,onBulkPM,onBulkStatus,onBulkGbna,onBulkReassign,onBulkDelete,initialFilter=""}) => {
  const [search,setSearch]=useState("");
  const [fStatus,setFS]=useState(initialFilter==="Offline"?"Offline":"");
  const [fBank,setFB]=useState("");
  const [fEngineer,setFEngineer]=useState(initialFilter==="unassigned"?"unassigned":"");
  const [sel,setSel]=useState(new Set());

  const activeEngineerIds=new Set(engineers.map(engineer=>String(engineer.id)));
  const isUnassigned=(atm)=>!atm.engineerId||!activeEngineerIds.has(String(atm.engineerId));
  const filtered=atms.filter(a=>{const bank=banks.find(b=>b.id==a.bankId);const txt=`${a.terminalId} ${a.location} ${a.model} ${bank?.name}`.toLowerCase();return(!search||txt.includes(search.toLowerCase()))&&(!fStatus||a.status===fStatus)&&(!fBank||String(a.bankId)===fBank)&&(!fEngineer||(fEngineer==="unassigned"?isUnassigned(a):String(a.engineerId)===fEngineer));});
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
          <select aria-label="Filter by engineer" value={fEngineer} onChange={e=>setFEngineer(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",color:C.text,background:"#fff"}}>
            <option value="">All Engineers</option>
            <option value="unassigned">Unassigned</option>
            {engineers.map(engineer=><option key={engineer.id} value={engineer.id}>{engineer.name}</option>)}
          </select>
          <Btn variant="teal" onClick={()=>onBulkPM([])}>⚡ Bulk PM</Btn>
          <Btn onClick={onAdd}>+ Add ATM</Btn>
        </div>
      </div>

      {sel.size>0&&(
        <BulkBar count={sel.size} onClear={()=>setSel(new Set())} actions={[
          {label:"Log PM",            icon:"📋", onClick:()=>onBulkPM(selAtms)},
          {label:"Update Status",     icon:"🔄", onClick:()=>onBulkStatus(selAtms)},
          {label:"Add GBNA",          icon:"➕", onClick:()=>onBulkGbna(selAtms)},
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
                      <td style={{padding:"13px 16px"}}><div style={{fontSize:13,color:C.text}}>{eng?.name||"Unassigned"}</div><div style={{fontSize:11,color:C.textMuted}}>{eng?.region}</div></td>
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
const MaintenanceModule = ({maintenance,atms,engineers,banks,onAdd,onEdit,onDelete,onBulkPM,onFilteredChange,onExport,initialFilter=""}) => {
  const [search,setSearch]=useState("");
  const [fStatus,setFS]=useState("");
  const [overdueOnly,setOverdueOnly]=useState(initialFilter==="overdue");
  const [fQ,setFQ]=useState("");
  const [fYear,setFY]=useState(initialFilter==="overdue"?"":String(today.getFullYear()));
  const [fBank,setFB]=useState("");
  const filtered=maintenance.filter(m=>{const atm=atms.find(a=>a.id==m.atmId);const eng=engineers.find(e=>e.id==m.engineerId);const bank=banks.find(b=>b.id==atm?.bankId);const txt=`${atm?.terminalId} ${atm?.location} ${eng?.name} ${m.type} ${bank?.name}`.toLowerCase();return(!search||txt.includes(search.toLowerCase()))&&(!fStatus||m.status===fStatus)&&(!overdueOnly||(["Scheduled","In Progress"].includes(m.status)&&Boolean(m.scheduledDate)&&m.scheduledDate<fmtISO(today)))&&(!fQ||String(m.quarter)===fQ)&&(!fYear||String(m.year)===fYear)&&(!fBank||String(atm?.bankId)===fBank);}).sort((a,b)=>new Date(b.scheduledDate)-new Date(a.scheduledDate));
  const {page:mp,setPage:setMP,totalPages:mTP,slice:mSlice,total:mTotal}=usePagination(filtered);
  // Notify parent whenever filtered set changes so nav-bar export always reflects current view
  const prevFilterKey = useRef("");
  const filterKey = `${search}|${fStatus}|${overdueOnly}|${fQ}|${fYear}|${fBank}|${maintenance.length}`;
  if (filterKey !== prevFilterKey.current) { prevFilterKey.current = filterKey; onFilteredChange?.(filtered, {search,fStatus,overdueOnly,fQ,fYear,fBank}); }
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
        {(fYear||fQ||fStatus||overdueOnly||fBank||search)&&<button onClick={()=>{setSearch("");setFS("");setOverdueOnly(false);setFQ("");setFY("");setFB("");}} style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surface,fontSize:13,fontFamily:"inherit",color:C.textMuted,cursor:"pointer"}}>✕ Clear</button>}
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
  const { atms: rawAtms, banks: rawBanks, engineers: rawEngineers, maintenance: rawMaint, approvedPmCards: rawApprovedPmCards, pendingJobCardsCount } = usePage<PageProps>().props;

  const atms        = (rawAtms        || []).map(normAtm);
  const banks       = (rawBanks       || []).map(normBank);
  const engineers   = (rawEngineers   || []);
  const maintenance = (rawMaint       || []).map(normMaint);

  const [page,setPage]           = useState("dashboard");
  const [sectionFocus,setSectionFocus] = useState<{page:string;filter:string}|null>(null);
  const [modal,setModal]         = useState(null);
  const [bulkModal,setBulkModal] = useState(null);
  const [pendingCalls,setPendingCalls] = useState(0);
  const [slaBreachedCalls,setSlaBreachedCalls] = useState(0);

  // Refresh dashboard call KPIs every 60 seconds.
  useEffect(() => {
    const fetchCallSummary = async () => {
      try {
        const res = await fetch("/calls?summary=1", {
          headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest"},
          credentials:"same-origin",
        });
        if (!res.ok) throw new Error(`Failed to load call summary (${res.status})`);
        const summary = await res.json();
        setPendingCalls(Number(summary.pending)||0);
        setSlaBreachedCalls(Number(summary.sla_breached)||0);
      } catch (error) {
        console.error("Unable to refresh admin call summary", error);
      }
    };
    fetchCallSummary();
    const t = setInterval(fetchCallSummary, 60000);
    return () => clearInterval(t);
  }, []);
  const [confirm,setConfirm]     = useState(null);
  const [viewAtm,setViewAtm]     = useState(null);
  const { toast, ToastContainer } = useToast();
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
    const payload = { terminal_id:f.terminalId, serial_number:f.serialNumber, model:f.model, location:f.location, address:f.address, bank_id:f.bankId, engineer_id:f.engineerId, status:f.status, has_gbna:f.hasGbna, install_date:f.installDate, notes:f.notes };
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

  const handleBulkGbna = useCallback((sel) => {
    setConfirm({
      message: `Enable GBNA for ${sel.length} selected ATM${sel.length!==1?"s":""}?`,
      onConfirm: () => router.post("/atms/bulk-gbna", { ids: sel.map(a => a.id) },
        opts(() => { toast(`GBNA enabled for ${sel.length} ATM${sel.length!==1?"s":""}`, "success"); setConfirm(null); })),
    });
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

  const handleBulkPM = useCallback((records, onSuccess) => {
    const payload = records.map(r => ({ atm_id:r.atmId, engineer_id:r.engineerId, type:r.type, status:r.status, scheduled_date:r.scheduledDate, completed_date:r.completedDate||null, quarter:r.quarter, year:r.year, notes:r.notes }));
    router.post("/maintenance/bulk", { records: payload },
      opts(() => { toast(`${records.length} PM record${records.length!==1?"s":""} updated successfully`, "success"); onSuccess?.(); }));
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

  const navItemsMain=[{id:"dashboard",label:"Dashboard",icon:"◈"},{id:"atms",label:"ATM Fleet",icon:"🏧"},{id:"maintenance",label:"Maintenance",icon:"🔧"},{id:"jobcards",label:"Job Cards",icon:"📋"},{id:"calls",label:"Calls",icon:"📞"}];
  const navItems=[...navItemsMain,{id:"banks",label:"Banks",icon:"🏦"},{id:"engineers",label:"Engineers",icon:"👷"}];
  // Badge helper — shows pending count on calls nav item
  const navBadge = (id:string) => id==="calls"&&pendingCalls>0 ? pendingCalls : null;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passModalOpen, setPassModalOpen] = useState(false);
  const navigate = (id,filter="") => {
    setPage(id);
    setSectionFocus(filter?{page:id,filter}:null);
    setDrawerOpen(false);
  };
  const activeEngineerIds=new Set(engineers.map(engineer=>String(engineer.id)));
  const attentionItems=[
    {key:"jobcards",label:"Job cards need review",count:pendingJobCardsCount||0,detail:"Submitted by engineers",page:"jobcards"},
    {key:"calls",label:"Calls pending",count:pendingCalls,detail:"Awaiting assignment",page:"calls",filter:"pending"},
    {key:"overdue",label:"Overdue PMs",count:maintenance.filter(record=>record.type==="Quarterly PM"&&["Scheduled","In Progress"].includes(record.status)&&Boolean(record.scheduledDate)&&record.scheduledDate<fmtISO(today)).length,detail:"Scheduled date has passed",page:"maintenance",filter:"overdue"},
    {key:"unassigned",label:"Unassigned ATMs",count:atms.filter(atm=>!atm.engineerId||!activeEngineerIds.has(String(atm.engineerId))).length,detail:"No active engineer assigned",page:"atms",filter:"unassigned"},
    {key:"offline",label:"Offline ATMs",count:atms.filter(atm=>atm.status==="Offline").length,detail:"Currently not operational",page:"atms",filter:"Offline"},
  ];

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
            {navItemsMain.map(n=>(
              <button key={n.id} onClick={()=>navigate(n.id)} className="nav-link"
                style={{position:"relative",background:page===n.id?"#fff":"transparent",fontWeight:page===n.id?700:500,color:page===n.id?C.accent:C.textMid,boxShadow:page===n.id?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>
                <span className="nav-link__icon">{n.icon}</span>{n.label}
                {navBadge(n.id)&&<span style={{position:"absolute",top:4,right:4,background:C.red,color:"#fff",borderRadius:10,fontSize:9,fontWeight:800,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",lineHeight:1}}>{navBadge(n.id)}</span>}
              </button>
            ))}
          </div>
          <div className="admin-nav-actions">
            {[
              {id:"banks",label:"Banks",count:banks.length,icon:"🏦",color:C.purple,bg:"#f3e8ff"},
              {id:"engineers",label:"Engineers",count:engineers.length,icon:"👷",color:C.teal,bg:C.tealLight},
            ].map(chip=>(
              <button key={chip.id} onClick={()=>navigate(chip.id)} style={{
                display:"flex",alignItems:"center",gap:6,padding:"5px 10px 5px 8px",borderRadius:20,cursor:"pointer",
                fontFamily:"inherit",background:page===chip.id?chip.color:chip.bg,border:`1px solid ${chip.color}33`,transition:"all .15s",
              }}>
                <span style={{fontSize:14,lineHeight:1}}>{chip.icon}</span>
                <span style={{fontSize:12,fontWeight:700,color:page===chip.id?"#fff":chip.color}}>{chip.count}</span>
                <span style={{fontSize:11,fontWeight:500,color:page===chip.id?"rgba(255,255,255,.85)":chip.color}}>{chip.label}</span>
              </button>
            ))}
            <AdminNotifications items={attentionItems} onNavigate={navigate}/>
          </div>
          {/* ── Profile circle ── */}
          <div style={{position:"relative"}}>
            <button
              onClick={()=>setProfileOpen(o=>!o)}
              title={authUser?.name ?? "Admin"}
              style={{width:36,height:36,borderRadius:18,background:C.accentLight,
                border:`2px solid ${profileOpen?C.accent:C.border}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:13,fontWeight:800,color:C.accent,
                cursor:"pointer",transition:"all .15s",flexShrink:0}}>
              {initials}
            </button>
            {profileOpen&&(
              <div onClick={()=>setProfileOpen(false)} style={{position:"absolute",top:"calc(100% + 8px)",right:0,background:"#fff",border:`1px solid ${C.border}`,borderRadius:14,boxShadow:"0 8px 24px rgba(0,0,0,.10)",minWidth:210,zIndex:500,overflow:"hidden"}}>
                <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,background:C.surface,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:18,background:C.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:C.accent,flexShrink:0}}>{initials}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser?.name ?? "Admin"}</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser?.email ?? ""}</div>
                  </div>
                </div>
                <div style={{padding:8}}>
                  <button onClick={() => { setProfileOpen(false); setPassModalOpen(true); }} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,border:"none",background:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.textMid}}>
                    <span>🔑</span> Change Password
                  </button>
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
        <AdminNotifications items={attentionItems} onNavigate={navigate}/>
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
        <nav className="drawer-nav">
          <div className="drawer-nav__label" style={{color:C.textMuted}}>Navigation</div>
          {navItems.map(n=>{const active=page===n.id;return(
            <button key={n.id} onClick={()=>navigate(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 12px",borderRadius:10,border:"none",background:active?C.accentLight:"transparent",cursor:"pointer",fontFamily:"inherit",marginBottom:2,transition:"all .15s",textAlign:"left"}}>
              <span style={{fontSize:20,width:28,textAlign:"center",lineHeight:1}}>{n.icon}</span>
              <span style={{fontSize:15,fontWeight:active?700:500,color:active?C.accent:C.text}}>{n.label}</span>
              {navBadge(n.id)&&<span style={{marginLeft:"auto",background:"#ef4444",color:"#fff",borderRadius:10,fontSize:10,fontWeight:800,minWidth:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{navBadge(n.id)}</span>}
              {active&&!navBadge(n.id)&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:3,background:C.accent}}/>}
            </button>
          );})}

        </nav>
        <div style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`,background:C.surface}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:32,height:32,borderRadius:16,background:C.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:C.accent}}>{initials}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser?.name??"Admin"}</div>
              <div style={{fontSize:11,color:C.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{authUser?.email??""}</div>
            </div>
          </div>
          <button onClick={() => { setDrawerOpen(false); setPassModalOpen(true); }} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.textMid,marginBottom:8}}>
            🔑 Change Password
          </button>
          <button onClick={handleLogout} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"9px 14px",borderRadius:10,border:`1px solid ${C.border}`,background:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.danger}}>
            🚪 Sign Out
          </button>
          <div style={{fontSize:11,color:C.textMuted,textAlign:"center",marginTop:10}}>NCR Fleet · Techmasters Zambia</div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content">
        {page==="dashboard"   &&<Dashboard   atms={atms} maintenance={maintenance} approvedPmCards={rawApprovedPmCards||[]} engineers={engineers} banks={banks} pendingCalls={pendingCalls} slaBreachedCalls={slaBreachedCalls} onNavigate={navigate} onBulkPM={()=>setBulkModal({type:"bulkPM",atms:[]})} toast={toast}/>}
        {page==="banks"       &&<BanksModule banks={banks} atms={atms} onAdd={()=>setModal({type:"bank"})} onEdit={b=>setModal({type:"bank",data:b})} onDelete={deleteBank}/>}
        {page==="atms"        &&<AtmList     atms={atms} engineers={engineers} banks={banks} maintenance={maintenance} initialFilter={sectionFocus?.page==="atms"?sectionFocus.filter:""}
            onAdd={()=>setModal({type:"atm"})} onEdit={a=>setModal({type:"atm",data:a})} onDelete={deleteAtm} onView={setViewAtm}
            onBulkPM={sel=>setBulkModal({type:"bulkPM",atms:sel})}
            onBulkStatus={sel=>setBulkModal({type:"bulkStatus",atms:sel})}
            onBulkGbna={handleBulkGbna}
            onBulkReassign={sel=>setBulkModal({type:"bulkReassign",atms:sel})}
            onBulkDelete={sel=>setBulkModal({type:"bulkDelete",atms:sel})}/>}
        {page==="maintenance" &&<MaintenanceModule maintenance={maintenance} atms={atms} engineers={engineers} banks={banks} initialFilter={sectionFocus?.page==="maintenance"?sectionFocus.filter:""}
            onAdd={()=>setModal({type:"maint"})} onEdit={m=>setModal({type:"maint",data:m})} onDelete={deleteMaint}
            onBulkPM={()=>setBulkModal({type:"bulkPM",atms:[]})}
            onFilteredChange={(records,meta)=>setExportableMaint({records,meta})}
            onExport={handleExportPDF}/>}
        {page==="engineers"   &&<EngineersModule   engineers={engineers} atms={atms} banks={banks} onAdd={()=>setModal({type:"eng"})} onEdit={e=>setModal({type:"eng",data:e})} onDelete={deleteEng}/>}
        {page==="jobcards"    &&<JobCardsModule    atms={atms} engineers={engineers} banks={banks} onApproved={()=>router.reload({only:["maintenance","approvedPmCards"]})}/>}
        {page==="calls"       &&<CallsModule       atms={rawAtms||[]} engineers={engineers} banks={banks} initialFilter={sectionFocus?.page==="calls"?sectionFocus.filter:"all"}/>}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <div className="mobile-bottom-nav">
        {navItems.map(n=>{const active=page===n.id;return(
          <button key={n.id} onClick={()=>navigate(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 4px 12px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit",position:"relative"}}>
            {active&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:32,height:3,borderRadius:"0 0 3px 3px",background:C.accent}}/>}
            {navBadge(n.id)&&<span style={{position:"absolute",top:6,right:"calc(50% - 16px)",background:"#ef4444",color:"#fff",borderRadius:10,fontSize:8,fontWeight:800,minWidth:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 2px",lineHeight:1}}>{navBadge(n.id)}</span>}
            <span style={{fontSize:18,lineHeight:1}}>{n.icon}</span>
            <span style={{fontSize:10,fontWeight:active?700:500,color:active?C.accent:C.textMuted,lineHeight:1}}>{n.label}</span>
          </button>
        );})}
      </div>

      {/* Modals */}
      {modal?.type==="bank"  &&<Modal title={modal.data?"Edit Bank":"Add Bank"} onClose={closeModal} width={560}><BankForm initial={modal.data} onSave={saveBank} onClose={closeModal}/></Modal>}
      {modal?.type==="atm"   &&<Modal title={modal.data?"Edit ATM":"Add ATM to Fleet"} onClose={closeModal} width={600}><AtmForm initial={modal.data} engineers={engineers} banks={banks} onSave={saveAtm} onClose={closeModal}/></Modal>}
      {modal?.type==="maint" &&<Modal title={modal.data?"Edit Maintenance Record":"Log Maintenance"} onClose={closeModal} width={600}><MaintForm initial={modal.data} atms={atms} engineers={engineers} banks={banks} onSave={saveMaint} onClose={closeModal}/></Modal>}
      {modal?.type==="eng"   &&<Modal title={modal.data?"Edit Engineer":"Add Engineer"} onClose={closeModal} width={540}><EngForm initial={modal.data} onSave={saveEng} onClose={closeModal}/></Modal>}
      {bulkModal?.type==="bulkPM"&&<Modal title="⚡ Bulk Maintenance Log" subtitle="Log preventive maintenance for multiple ATMs at once" onClose={closeBulk} width={740}><BulkPMWizard atms={atms} engineers={engineers} banks={banks} onSave={handleBulkPM} onClose={closeBulk}/></Modal>}
      {bulkModal?.type==="bulkStatus"&&<BulkStatusModal atms={bulkModal.atms} onSave={ns=>handleBulkStatus(bulkModal.atms,ns)} onClose={closeBulk}/>}
      {bulkModal?.type==="bulkReassign"&&<BulkReassignModal atms={bulkModal.atms} engineers={engineers} onSave={eid=>handleBulkReassign(bulkModal.atms,eid)} onClose={closeBulk}/>}
      {bulkModal?.type==="bulkDelete"&&<BulkDeleteModal atms={bulkModal.atms} onConfirm={()=>handleBulkDelete(bulkModal.atms)} onClose={closeBulk}/>}
      {viewAtm&&<AtmDetail atm={viewAtm} engineers={engineers} banks={banks} maintenance={maintenance} onClose={()=>setViewAtm(null)} onAddMaint={()=>{ setViewAtm(null); setModal({type:"maint",data:{...defaultMaint,atmId:viewAtm.id,engineerId:viewAtm.engineerId}}); }}/>}
      {confirm&&<Confirm message={confirm.message} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)}/>}
      {passModalOpen&&<ChangePasswordModal onClose={()=>setPassModalOpen(false)}/>}
      <ToastContainer/>
    </div>
  );
}

// Bypass Inertia default layout
App.layout = (page) => page;
