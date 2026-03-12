import { useState, useCallback, useEffect } from "react";
import { router, usePage } from "@inertiajs/react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#ffffff", surface: "#f8f9fb", navBg: "#f4f5f7", navBorder: "#e8eaed",
  border: "#e8eaed", borderHover: "#c8cdd5", text: "#1a1d23", textMid: "#4b5260",
  textMuted: "#8b909a", accent: "#1d6ef5", accentLight: "#eef3fe",
  green: "#10b366", greenLight: "#eafaf2", amber: "#f59e0b", amberLight: "#fffbeb",
  red: "#ef4444", redLight: "#fef2f2", purple: "#7c3aed", purpleLight: "#f5f3ff",
  teal: "#0891b2", tealLight: "#ecfeff",
  shadow: "0 1px 3px rgba(0,0,0,0.08)", shadowMd: "0 4px 12px rgba(0,0,0,0.10)",
};

const NCR_MODELS    = ["NCR 6622","NCR 6626","NCR 6627","NCR 6634","NCR 6638","NCR 6684","NCR SelfServ 80","NCR SelfServ 84","NCR SelfServ 87"];
const STATUSES      = ["Active","Offline","Under Maintenance","Decommissioned"];
const MAINT_TYPES   = ["Quarterly PM","Emergency","Part Replacement","Software Update","Cash Jam","Card Reader Service"];
const MAINT_STATUS  = ["Scheduled","In Progress","Completed","Cancelled"];
const ZAMBIA_BANKS  = ["Zanaco","Stanbic Bank Zambia","Standard Chartered Zambia","FNB Zambia","Absa Bank Zambia","Access Bank Zambia","Atlas Mara Zambia","Citibank Zambia","Bank of China Zambia","Indo Zambia Bank","Madison Finance","United Bank for Africa Zambia"];
const today = new Date();
const qtr = (d) => Math.floor(d.getMonth() / 3) + 1;
// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt    = (d) => d?new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—";
const fmtISO = (d) => { const dt=new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`; };
const statusColor = (s) => ({Active:C.green,Offline:C.red,"Under Maintenance":C.amber,Decommissioned:C.textMuted})[s]||C.textMuted;
const statusBg    = (s) => ({Active:C.greenLight,Offline:C.redLight,"Under Maintenance":C.amberLight,Decommissioned:C.surface})[s]||C.surface;
const mColor = (s) => ({Completed:C.green,"In Progress":C.accent,Scheduled:C.amber,Cancelled:C.textMuted})[s]||C.textMuted;
const mBg    = (s) => ({Completed:C.greenLight,"In Progress":C.accentLight,Scheduled:C.amberLight,Cancelled:C.surface})[s]||C.surface;
const BANK_COLORS = ["#1d6ef5","#10b366","#f59e0b","#ef4444","#7c3aed","#0891b2","#be185d","#065f46"];
const bankColor = (idx) => BANK_COLORS[idx%BANK_COLORS.length];

// ─── UI Primitives ────────────────────────────────────────────────────────────
const Badge = ({label,color,bg}) => (
  <span style={{display:"inline-flex",alignItems:"center",padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600,color,background:bg}}>{label}</span>
);
const Btn = ({children,onClick,variant="primary",small,disabled,type="button"}) => {
  const base={display:"inline-flex",alignItems:"center",gap:6,borderRadius:8,fontFamily:"inherit",fontWeight:600,cursor:disabled?"not-allowed":"pointer",border:"none",outline:"none",transition:"all .15s",fontSize:small?13:14,padding:small?"6px 14px":"9px 20px",opacity:disabled?.5:1};
  const s={primary:{background:C.accent,color:"#fff",boxShadow:"0 1px 3px rgba(29,110,245,.3)"},secondary:{background:C.surface,color:C.text,border:`1px solid ${C.border}`},ghost:{background:"transparent",color:C.textMid},danger:{background:C.redLight,color:C.red,border:"1px solid #fecaca"},teal:{background:C.tealLight,color:C.teal,border:`1px solid ${C.teal}33`}};
  return <button type={type} disabled={disabled} onClick={onClick} style={{...base,...s[variant]}}>{children}</button>;
};
const Input = ({label,value,onChange,placeholder,type="text",required,options,rows}) => {
  const fs={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",color:C.text,background:"#fff",outline:"none",boxSizing:"border-box"};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<label style={{fontSize:13,fontWeight:600,color:C.textMid}}>{label}{required&&<span style={{color:C.red}}> *</span>}</label>}
      {options?(<select value={value} onChange={e=>onChange(e.target.value)} style={{...fs,appearance:"none",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b909a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 12px center",paddingRight:32}}>
        <option value="">— Select —</option>
        {options.map(o=><option key={typeof o==="object"?o.value:o} value={typeof o==="object"?o.value:o}>{typeof o==="object"?o.label:o}</option>)}
      </select>):rows?(<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...fs,resize:"vertical"}}/>):(<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required} style={fs}/>)}
    </div>
  );
};
const Modal = ({title,subtitle,onClose,children,width=560}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
    <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:width,boxShadow:C.shadowMd,maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"20px 24px 0"}}>
        <div><h2 style={{margin:0,fontSize:18,fontWeight:700,color:C.text}}>{title}</h2>{subtitle&&<div style={{fontSize:13,color:C.textMuted,marginTop:3}}>{subtitle}</div>}</div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:C.textMuted,lineHeight:1,padding:4,marginLeft:12}}>×</button>
      </div>
      <div style={{padding:24}}>{children}</div>
    </div>
  </div>
);
const Card = ({children,style,hoverable,className=""}) => (
  <div className={`${hoverable?"card-hover":"card"} ${className}`} style={{background:"#fff",borderRadius:12,border:`1px solid ${C.border}`,boxShadow:C.shadow,transition:"all .22s cubic-bezier(.4,0,.2,1)",...style}}>{children}</div>
);
const StatCard = ({label,value,sub,color=C.accent,icon}) => (
  <div className="stat-card" style={{background:"#fff",borderRadius:12,border:`1px solid ${C.border}`,boxShadow:C.shadow,padding:"20px 24px",flex:1,minWidth:140,transition:"all .22s cubic-bezier(.4,0,.2,1)",cursor:"default",position:"relative",overflow:"hidden"}}>
    <div className="stat-card-shine"/>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",position:"relative",zIndex:1}}>
      <div>
        <div className="stat-card-value" style={{fontSize:28,fontWeight:800,color,lineHeight:1,transition:"transform .22s cubic-bezier(.4,0,.2,1)"}}>{value}</div>
        <div style={{fontSize:13,fontWeight:600,color:C.textMid,marginTop:6}}>{label}</div>
        {sub&&<div style={{fontSize:12,color:C.textMuted,marginTop:2}}>{sub}</div>}
      </div>
      {icon&&<div className="stat-card-icon" style={{fontSize:28,opacity:.18,transition:"all .3s cubic-bezier(.4,0,.2,1)",transform:"scale(1)",position:"absolute",right:20,top:"50%",marginTop:-14}}>{icon}</div>}
    </div>
  </div>
);
const EmptyState = ({message}) => <div style={{textAlign:"center",padding:"48px 24px",color:C.textMuted}}><div style={{fontSize:40,marginBottom:12}}>📭</div><div style={{fontSize:15}}>{message}</div></div>;
const Confirm = ({message,onConfirm,onCancel}) => (
  <Modal title="Confirm Action" onClose={onCancel} width={420}>
    <p style={{color:C.textMid,margin:"0 0 24px",lineHeight:1.6}}>{message}</p>
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={onCancel}>Cancel</Btn><Btn variant="danger" onClick={onConfirm}>Confirm</Btn></div>
  </Modal>
);
const Checkbox = ({checked,indeterminate,onChange}) => (
  <input type="checkbox" checked={checked} ref={el=>{if(el) el.indeterminate=!!indeterminate;}} onChange={e=>onChange(e.target.checked)} style={{width:16,height:16,accentColor:C.accent,cursor:"pointer"}}/>
);

// ─── Toast System ─────────────────────────────────────────────────────────────
// Usage: const {toast, ToastContainer} = useToast()
// toast("Message", "success"|"error"|"info"|"warning")
const TOAST_ICONS = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
const TOAST_COLORS = {
  success: { bg:"#f0fdf4", border:"#bbf7d0", text:C.green },
  error:   { bg:"#fef2f2", border:"#fecaca", text:C.red },
  warning: { bg:"#fffbeb", border:"#fde68a", text:"#b45309" },
  info:    { bg:C.accentLight, border:"#bfdbfe", text:C.accent },
};

function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type="success", duration=3500) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type, leaving:false }]);
    setTimeout(() => {
      setToasts(p => p.map(t => t.id===id ? {...t, leaving:true} : t));
      setTimeout(() => setToasts(p => p.filter(t => t.id!==id)), 350);
    }, duration);
  }, []);
  const dismiss = useCallback((id) => {
    setToasts(p => p.map(t => t.id===id ? {...t, leaving:true} : t));
    setTimeout(() => setToasts(p => p.filter(t => t.id!==id)), 350);
  }, []);

  const ToastContainer = () => (
    <div style={{position:"fixed",bottom:24,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:10,pointerEvents:"none",maxWidth:360}}>
      {toasts.map(t => {
        const col = TOAST_COLORS[t.type]||TOAST_COLORS.info;
        return (
          <div key={t.id} style={{
            background:col.bg, border:`1.5px solid ${col.border}`, borderRadius:12,
            padding:"13px 16px", display:"flex", alignItems:"flex-start", gap:10,
            boxShadow:"0 8px 24px rgba(0,0,0,.12)", pointerEvents:"all",
            transform: t.leaving ? "translateX(120%)" : "translateX(0)",
            opacity: t.leaving ? 0 : 1,
            transition:"transform .32s cubic-bezier(.4,0,.2,1), opacity .32s ease",
          }}>
            <span style={{fontSize:16,lineHeight:1.4,flexShrink:0}}>{TOAST_ICONS[t.type]}</span>
            <span style={{fontSize:13,fontWeight:600,color:col.text,flex:1,lineHeight:1.5}}>{t.message}</span>
            <button onClick={()=>dismiss(t.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:col.text,opacity:.5,padding:0,lineHeight:1,flexShrink:0,marginTop:1}}>×</button>
          </div>
        );
      })}
    </div>
  );
  return { toast, ToastContainer };
}

// ─── Bulk Action Bar ──────────────────────────────────────────────────────────
const BulkBar = ({count,actions,onClear}) => (
  <div style={{display:"flex",alignItems:"center",gap:12,background:C.accentLight,border:`1.5px solid ${C.accent}44`,borderRadius:10,padding:"10px 16px",flexWrap:"wrap"}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:26,height:26,borderRadius:13,background:C.accent,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800}}>{count}</div>
      <span style={{fontSize:14,fontWeight:600,color:C.accent}}>{count===1?"1 item selected":`${count} items selected`}</span>
    </div>
    <div style={{display:"flex",gap:8,flex:1,flexWrap:"wrap"}}>
      {actions.map(a=><Btn key={a.label} small variant={a.variant||"secondary"} onClick={a.onClick}>{a.icon} {a.label}</Btn>)}
    </div>
    <Btn small variant="ghost" onClick={onClear}>✕ Clear</Btn>
  </div>
);

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
          {/* Summary strip */}
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
const Dashboard = ({atms,maintenance,engineers,banks,onBulkPM,pmBannerDismissed,onDismissPMBanner}) => {
  const active=atms.filter(a=>a.status==="Active").length;
  const offline=atms.filter(a=>a.status==="Offline").length;
  const um=atms.filter(a=>a.status==="Under Maintenance").length;
  const cQ=qtr(today),cY=today.getFullYear();
  const pmDue=atms.filter(a=>!maintenance.some(m=>m.atmId==a.id&&m.type==="Quarterly PM"&&m.quarter==cQ&&m.year==cY&&m.status==="Completed"));
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
          <div style={{padding:"18px 20px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <h3 style={{margin:0,fontSize:15,fontWeight:700,color:C.text}}>Q{cQ} {cY} — PM Due</h3>
            {pmDue.length>0&&<Btn small variant="teal" onClick={onBulkPM}>⚡ Bulk Log</Btn>}
          </div>
          {pmDue.length===0?(<div style={{padding:"24px 20px",textAlign:"center",color:C.green,fontSize:14,fontWeight:600}}>✓ All ATMs have Q{cQ} PM completed</div>):(
            <div style={{padding:"8px 0"}}>
              {pmDue.map(a=>{const eng=engineers.find(e=>e.id==a.engineerId);const bank=banks.find(b=>b.id==a.bankId);return(
                <div key={a.id} className="pm-due-row" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px",borderBottom:`1px solid ${C.surface}`}}>
                  <div><div style={{fontSize:14,fontWeight:600,color:C.text}}>{a.terminalId}</div><div style={{fontSize:12,color:C.textMuted}}>{a.location} · {bank?.shortCode}</div></div>
                  <div style={{textAlign:"right"}}><Badge label={a.status} color={statusColor(a.status)} bg={statusBg(a.status)}/><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{eng?.name}</div></div>
                </div>
              );})}
            </div>
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

// ─── ATM List (with bulk selection) ──────────────────────────────────────────
const AtmList = ({atms,engineers,banks,maintenance,onAdd,onEdit,onDelete,onView,onBulkPM,onBulkStatus,onBulkReassign,onBulkDelete}) => {
  const [search,setSearch]=useState("");
  const [fStatus,setFS]=useState("");
  const [fBank,setFB]=useState("");
  const [sel,setSel]=useState(new Set());

  const filtered=atms.filter(a=>{const bank=banks.find(b=>b.id==a.bankId);const txt=`${a.terminalId} ${a.location} ${a.model} ${bank?.name}`.toLowerCase();return(!search||txt.includes(search.toLowerCase()))&&(!fStatus||a.status===fStatus)&&(!fBank||String(a.bankId)===fBank);});
  const toggleOne=(id)=>{const n=new Set(sel);n.has(id)?n.delete(id):n.add(id);setSel(n);};
  const toggleAll=(c)=>setSel(c?new Set(filtered.map(a=>a.id)):new Set());
  const selAtms=atms.filter(a=>sel.has(a.id));
  const allChk=filtered.length>0&&filtered.every(a=>sel.has(a.id));
  const someChk=filtered.some(a=>sel.has(a.id));

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
          {label:"Log PM",           icon:"📋", onClick:()=>onBulkPM(selAtms)},
          {label:"Update Status",    icon:"🔄", onClick:()=>onBulkStatus(selAtms)},
          {label:"Reassign Engineer",icon:"👷", onClick:()=>onBulkReassign(selAtms)},
          {label:"Delete",           icon:"🗑", variant:"danger", onClick:()=>onBulkDelete(selAtms)},
        ]}/>
      )}

      <Card>
        {filtered.length===0?<EmptyState message="No ATMs found"/>:(
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
                {filtered.map(atm=>{
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
        )}
      </Card>
      {filtered.length>0&&<div style={{fontSize:12,color:C.textMuted,textAlign:"right"}}>{sel.size>0?`${sel.size} of ${filtered.length} selected · `:""}Tip: tick checkboxes then use bulk actions</div>}
    </div>
  );
};

// ─── ATM Detail ───────────────────────────────────────────────────────────────
const AtmDetail = ({atm,engineers,banks,maintenance,onClose,onAddMaint}) => {
  const eng=engineers.find(e=>e.id==atm.engineerId);
  const bank=banks.find(b=>b.id==atm.bankId);
  const bi=banks.findIndex(b=>b.id==atm.bankId);
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
const MaintenanceModule = ({maintenance,atms,engineers,banks,onAdd,onEdit,onDelete,onBulkPM}) => {
  const [search,setSearch]=useState("");
  const [fStatus,setFS]=useState("");
  const [fQ,setFQ]=useState("");
  const [fBank,setFB]=useState("");
  const filtered=maintenance.filter(m=>{const atm=atms.find(a=>a.id==m.atmId);const eng=engineers.find(e=>e.id==m.engineerId);const bank=banks.find(b=>b.id==atm?.bankId);const txt=`${atm?.terminalId} ${atm?.location} ${eng?.name} ${m.type} ${bank?.name}`.toLowerCase();return(!search||txt.includes(search.toLowerCase()))&&(!fStatus||m.status===fStatus)&&(!fQ||String(m.quarter)===fQ)&&(!fBank||String(atm?.bankId)===fBank);}).sort((a,b)=>new Date(b.scheduledDate)-new Date(a.scheduledDate));
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.text}}>Maintenance Tracker</h2>
        <div style={{display:"flex",gap:10}}><Btn variant="teal" onClick={onBulkPM}>⚡ Bulk PM Log</Btn><Btn onClick={onAdd}>+ Log Maintenance</Btn></div>
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
        <select value={fQ} onChange={e=>setFQ(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"inherit",outline:"none",color:C.text,background:"#fff"}}><option value="">All Quarters</option>{["1","2","3","4"].map(q=><option key={q} value={q}>Q{q}</option>)}</select>
      </div>
      <Card>
        {filtered.length===0?<EmptyState message="No records found"/>:(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:C.surface,borderBottom:`1px solid ${C.border}`}}>
                {["ATM","Bank","Type","Quarter","Engineer","Scheduled","Completed","Status",""].map(h=><th key={h} style={{padding:"11px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:C.textMuted,whiteSpace:"nowrap",letterSpacing:"0.04em",textTransform:"uppercase"}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map(m=>{const atm=atms.find(a=>a.id==m.atmId);const eng=engineers.find(e=>e.id==m.engineerId);const bank=banks.find(b=>b.id==atm?.bankId);const bi=banks.findIndex(b=>b.id==atm?.bankId);const col=bankColor(bi);return(
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
        )}
      </Card>
    </div>
  );
};

// ─── Banks Module ─────────────────────────────────────────────────────────────
const BanksModule = ({banks,atms,onAdd,onEdit,onDelete}) => (
  <div style={{display:"flex",flexDirection:"column",gap:20}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.text}}>Banks</h2><Btn onClick={onAdd}>+ Add Bank</Btn></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
      {banks.map((bank,i)=>{const bankAtms=atms.filter(a=>a.bankId==bank.id);const active=bankAtms.filter(a=>a.status==="Active").length;const offline=bankAtms.filter(a=>a.status==="Offline").length;const inMaint=bankAtms.filter(a=>a.status==="Under Maintenance").length;const col=bankColor(i);return(
        <Card key={bank.id} style={{padding:0,overflow:"hidden"}}>
          <div style={{height:5,background:col}}/>
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
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {bankAtms.map(a=><span key={a.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"2px 7px",fontSize:11,fontWeight:600,color:C.text}}>{a.terminalId}</span>)}
              </div>
            </div>
            {bank.notes&&<div style={{marginTop:10,background:C.amberLight,borderRadius:7,padding:"8px 12px",fontSize:12,color:"#92400e"}}>📝 {bank.notes}</div>}
          </div>
        </Card>
      );})}
      {banks.length===0&&<EmptyState message="No banks added yet"/>}
    </div>
  </div>
);

// ─── Engineers Module ─────────────────────────────────────────────────────────
const EngineersModule = ({engineers,atms,banks,onAdd,onEdit,onDelete}) => (
  <div style={{display:"flex",flexDirection:"column",gap:20}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.text}}>Field Engineers</h2><Btn onClick={onAdd}>+ Add Engineer</Btn></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
      {engineers.map(eng=>{const assigned=atms.filter(a=>a.engineerId==eng.id);return(
        <Card key={eng.id} style={{padding:20}}>
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
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {assigned.map(a=>{const bi=banks.findIndex(b=>b.id==a.bankId);const col=bankColor(bi);return <span key={a.id} style={{background:col+"12",border:`1px solid ${col}25`,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:600,color:col}}>{a.terminalId}</span>;})}
              </div>
            )}
          </div>
        </Card>
      );})}
      {engineers.length===0&&<EmptyState message="No engineers added yet"/>}
    </div>
  </div>
);

// ─── Normalise DB snake_case → camelCase ──────────────────────────────────────
// Laravel returns snake_case; our components expect camelCase keys.
const normAtm  = (a) => ({ ...a, terminalId: a.terminal_id??a.terminalId, serialNumber: a.serial_number??a.serialNumber, bankId: a.bank_id??a.bankId, engineerId: a.engineer_id??a.engineerId, installDate: a.install_date??a.installDate });
const normBank = (b) => ({ ...b, shortCode: b.short_code??b.shortCode, contactPerson: b.contact_person??b.contactPerson, contactPhone: b.contact_phone??b.contactPhone, contactEmail: b.contact_email??b.contactEmail });
const normMaint= (m) => ({ ...m, atmId: m.atm_id??m.atmId, engineerId: m.engineer_id??m.engineerId, scheduledDate: m.scheduled_date??m.scheduledDate, completedDate: m.completed_date??m.completedDate });
const normEng  = (e) => ({ ...e });

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App(props) {
  // Props injected by Inertia from AtmFleetController@index
  const { atms: rawAtms, banks: rawBanks, engineers: rawEngineers, maintenance: rawMaint } = usePage().props;

  // Normalise once so all child components use camelCase
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

  const closeModal = () => setModal(null);
  const closeBulk  = () => setBulkModal(null);

  // ── shared router options ──────────────────────────────────────────────────
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

  const navItems=[{id:"dashboard",label:"Dashboard",icon:"◈"},{id:"banks",label:"Banks",icon:"🏦"},{id:"atms",label:"ATM Fleet",icon:"🏧"},{id:"maintenance",label:"Maintenance",icon:"🔧"},{id:"engineers",label:"Engineers",icon:"👷"}];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = (id) => { setPage(id); setDrawerOpen(false); };

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans','Outfit',system-ui,sans-serif",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:${C.surface};}
        ::-webkit-scrollbar-thumb{background:${C.borderHover};border-radius:4px;}
        input:focus,select:focus,textarea:focus{border-color:${C.accent}!important;box-shadow:0 0 0 3px ${C.accentLight};}
        button:hover:not(:disabled){filter:brightness(0.94);}

        /* ── Card hover ── */
        .card { transition: all .22s cubic-bezier(.4,0,.2,1); }
        .card-hover {
          transition: all .22s cubic-bezier(.4,0,.2,1);
          cursor: pointer;
        }
        .card-hover:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 28px rgba(0,0,0,.11), 0 2px 8px rgba(0,0,0,.06) !important;
          border-color: ${C.borderHover} !important;
        }
        .card-hover:active { transform: translateY(-1px); }

        /* ── Stat card hover ── */
        .stat-card {
          transition: all .22s cubic-bezier(.4,0,.2,1);
        }
        .stat-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 14px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06) !important;
          border-color: ${C.accent}44 !important;
          z-index: 2;
        }
        .stat-card:hover .stat-card-value {
          transform: scale(1.08);
          transform-origin: left center;
        }
        .stat-card:hover .stat-card-icon {
          opacity: 0.45 !important;
          transform: scale(1.3) rotate(-8deg) !important;
        }
        /* subtle shimmer overlay */
        .stat-card-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 60%);
          background-size: 200% 200%;
          background-position: 200% 0;
          border-radius: 12px;
          pointer-events: none;
          transition: background-position .6s ease;
        }
        .stat-card:hover .stat-card-shine {
          background-position: -100% 0;
        }

        /* ── Bank / Engineer cards ── */
        .bank-card, .eng-card {
          transition: all .22s cubic-bezier(.4,0,.2,1) !important;
        }
        .bank-card:hover, .eng-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(0,0,0,.10), 0 2px 6px rgba(0,0,0,.05) !important;
          border-color: ${C.borderHover} !important;
        }
        .bank-card:hover .bank-color-strip {
          height: 7px !important;
        }

        /* ── Table rows ── */
        .data-row {
          transition: background .12s ease, box-shadow .12s ease;
          position: relative;
        }
        .data-row:hover {
          background: linear-gradient(90deg, ${C.accentLight}55 0%, ${C.surface} 100%) !important;
          box-shadow: inset 3px 0 0 ${C.accent};
        }
        .data-row:hover td:first-child {
          padding-left: 19px !important;
        }

        /* ── Maintenance row variant ── */
        .maint-row {
          transition: background .12s ease, box-shadow .12s ease;
        }
        .maint-row:hover {
          background: ${C.surface} !important;
          box-shadow: inset 3px 0 0 ${C.amber};
        }

        /* ── PM Due row ── */
        .pm-due-row {
          transition: background .15s, transform .15s;
        }
        .pm-due-row:hover {
          background: ${C.accentLight}44 !important;
          transform: translateX(3px);
        }

        /* ── ATM detail history items ── */
        .history-item {
          transition: background .15s, transform .15s, box-shadow .15s;
        }
        .history-item:hover {
          background: #fff !important;
          transform: translateX(4px);
          box-shadow: 0 2px 10px rgba(0,0,0,.07);
        }

        @media(max-width:768px){
          .desktop-nav{display:none!important;}
          .mobile-topbar{display:flex!important;}
          .mobile-bottom-nav{display:flex!important;}
          .main-content{padding:16px 14px 90px!important;}
          .stat-card:hover { transform: none; }
          .card-hover:hover { transform: none; }
          .bank-card:hover, .eng-card:hover { transform: none; }
        }
        @media(min-width:769px){
          .mobile-topbar{display:none!important;}
          .mobile-bottom-nav{display:none!important;}
          .drawer-overlay{display:none!important;}
          .side-drawer{display:none!important;}
        }
      `}</style>

      {/* ── DESKTOP TOP NAV ── */}
      <nav className="desktop-nav" style={{background:C.navBg,borderBottom:`1px solid ${C.navBorder}`,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1340,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",gap:24}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 0",marginRight:8}}>
            <div style={{width:32,height:32,borderRadius:8,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏧</div>
            <div><div style={{fontSize:14,fontWeight:800,color:C.text,lineHeight:1.1}}>NCR Fleet</div><div style={{fontSize:10,color:C.textMuted,fontWeight:500,letterSpacing:"0.05em"}}>ATM MANAGER</div></div>
          </div>
          <div style={{display:"flex",gap:2,flex:1}}>
            {navItems.map(n=>(
              <button key={n.id} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:7,padding:"10px 14px",borderRadius:8,border:"none",background:page===n.id?"#fff":"transparent",cursor:"pointer",fontSize:14,fontWeight:page===n.id?700:500,color:page===n.id?C.accent:C.textMid,fontFamily:"inherit",boxShadow:page===n.id?C.shadow:"none",transition:"all .15s"}}>
                <span style={{fontSize:15}}>{n.icon}</span>{n.label}
              </button>
            ))}
          </div>
          <Btn small variant="teal" onClick={()=>setBulkModal({type:"bulkPM",atms:[]})}>⚡ Bulk PM</Btn>
          <div style={{display:"flex",gap:8}}>
            <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 12px",fontSize:13,fontWeight:600,color:C.purple}}>🏦 {banks.length}</div>
            <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 12px",fontSize:13,fontWeight:600,color:C.textMid}}>🏧 {atms.length}</div>
          </div>
        </div>
      </nav>

      {/* ── MOBILE TOP BAR ── */}
      <div className="mobile-topbar" style={{display:"none",position:"sticky",top:0,zIndex:200,background:C.navBg,borderBottom:`1px solid ${C.navBorder}`,padding:"0 16px",height:56,alignItems:"center",justifyContent:"space-between"}}>
        {/* Hamburger */}
        <button onClick={()=>setDrawerOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:6,borderRadius:8,display:"flex",flexDirection:"column",gap:5,alignItems:"center",justifyContent:"center"}}>
          <span style={{display:"block",width:22,height:2,background:C.text,borderRadius:2,transition:"all .2s"}}/>
          <span style={{display:"block",width:22,height:2,background:C.text,borderRadius:2,transition:"all .2s"}}/>
          <span style={{display:"block",width:22,height:2,background:C.text,borderRadius:2,transition:"all .2s"}}/>
        </button>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:7,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🏧</div>
          <div style={{fontSize:14,fontWeight:800,color:C.text}}>NCR Fleet</div>
        </div>
        {/* Bulk PM quick button */}
        <button onClick={()=>setBulkModal({type:"bulkPM",atms:[]})} style={{background:C.tealLight,border:`1px solid ${C.teal}44`,borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:700,color:C.teal,cursor:"pointer",fontFamily:"inherit"}}>⚡ PM</button>
      </div>

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {drawerOpen&&(
        <div className="drawer-overlay" onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:300,backdropFilter:"blur(2px)"}}/>
      )}

      {/* ── MOBILE SIDE DRAWER ── */}
      <div className="side-drawer" style={{position:"fixed",top:0,left:0,bottom:0,width:280,background:"#fff",zIndex:400,boxShadow:"4px 0 24px rgba(0,0,0,.15)",transform:drawerOpen?"translateX(0)":"translateX(-100%)",transition:"transform .28s cubic-bezier(.4,0,.2,1)",display:"flex",flexDirection:"column",overflowY:"auto"}}>
        {/* Drawer header */}
        <div style={{padding:"20px 20px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:C.navBg}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:9,background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🏧</div>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:C.text,lineHeight:1.1}}>NCR Fleet</div>
              <div style={{fontSize:10,color:C.textMuted,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase"}}>ATM Manager</div>
            </div>
          </div>
          <button onClick={()=>setDrawerOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.textMuted,padding:4,borderRadius:6,lineHeight:1}}>×</button>
        </div>

        {/* Stats chips */}
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:8}}>
          <div style={{flex:1,background:C.purpleLight,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:800,color:C.purple}}>{banks.length}</div>
            <div style={{fontSize:11,fontWeight:600,color:C.purple,marginTop:1}}>Banks</div>
          </div>
          <div style={{flex:1,background:C.accentLight,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:800,color:C.accent}}>{atms.length}</div>
            <div style={{fontSize:11,fontWeight:600,color:C.accent,marginTop:1}}>ATMs</div>
          </div>
          <div style={{flex:1,background:C.greenLight,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:800,color:C.green}}>{atms.filter(a=>a.status==="Active").length}</div>
            <div style={{fontSize:11,fontWeight:600,color:C.green,marginTop:1}}>Active</div>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{padding:"10px 12px",flex:1}}>
          <div style={{fontSize:10,fontWeight:700,color:C.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",padding:"8px 8px 6px"}}>Navigation</div>
          {navItems.map(n=>{
            const active=page===n.id;
            return (
              <button key={n.id} onClick={()=>navigate(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 12px",borderRadius:10,border:"none",background:active?C.accentLight:"transparent",cursor:"pointer",fontFamily:"inherit",marginBottom:2,transition:"all .15s",textAlign:"left"}}>
                <span style={{fontSize:20,width:28,textAlign:"center",lineHeight:1}}>{n.icon}</span>
                <span style={{fontSize:15,fontWeight:active?700:500,color:active?C.accent:C.text}}>{n.label}</span>
                {active&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:3,background:C.accent}}/>}
              </button>
            );
          })}

          {/* Divider */}
          <div style={{height:1,background:C.border,margin:"12px 8px"}}/>
          <div style={{fontSize:10,fontWeight:700,color:C.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 8px 6px"}}>Quick Actions</div>

          {/* Bulk PM in drawer */}
          <button onClick={()=>{setDrawerOpen(false);setBulkModal({type:"bulkPM",atms:[]});}} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 12px",borderRadius:10,border:`1.5px solid ${C.teal}44`,background:C.tealLight,cursor:"pointer",fontFamily:"inherit",marginBottom:6,transition:"all .15s"}}>
            <span style={{fontSize:20,width:28,textAlign:"center"}}>⚡</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:14,fontWeight:700,color:C.teal}}>Bulk PM Log</div>
              <div style={{fontSize:11,color:C.teal+"99",marginTop:1}}>Log PM for multiple ATMs</div>
            </div>
          </button>
        </nav>

        {/* Drawer footer */}
        <div style={{padding:"14px 16px",borderTop:`1px solid ${C.border}`,background:C.surface}}>
          <div style={{fontSize:11,color:C.textMuted,textAlign:"center"}}>NCR Fleet ATM Manager · Zambia</div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content" style={{maxWidth:1340,margin:"0 auto",padding:"28px 24px"}}>
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
            onBulkPM={()=>setBulkModal({type:"bulkPM",atms:[]})}/>}
        {page==="engineers"   &&<EngineersModule   engineers={engineers} atms={atms} banks={banks} onAdd={()=>setModal({type:"eng"})} onEdit={e=>setModal({type:"eng",data:e})} onDelete={deleteEng}/>}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <div className="mobile-bottom-nav" style={{display:"none",position:"fixed",bottom:0,left:0,right:0,zIndex:150,background:"#fff",borderTop:`1px solid ${C.border}`,boxShadow:"0 -4px 16px rgba(0,0,0,.08)"}}>
        {navItems.map(n=>{
          const active=page===n.id;
          return (
            <button key={n.id} onClick={()=>navigate(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 4px 12px",border:"none",background:"transparent",cursor:"pointer",fontFamily:"inherit",position:"relative"}}>
              {active&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:32,height:3,borderRadius:"0 0 3px 3px",background:C.accent}}/>}
              <span style={{fontSize:18,lineHeight:1}}>{n.icon}</span>
              <span style={{fontSize:10,fontWeight:active?700:500,color:active?C.accent:C.textMuted,lineHeight:1}}>{n.label}</span>
            </button>
          );
        })}
      </div>

      {/* Standard modals */}
      {modal?.type==="bank"  &&<Modal title={modal.data?"Edit Bank":"Add Bank"} onClose={closeModal} width={560}><BankForm initial={modal.data} onSave={saveBank} onClose={closeModal}/></Modal>}
      {modal?.type==="atm"   &&<Modal title={modal.data?"Edit ATM":"Add ATM to Fleet"} onClose={closeModal} width={600}><AtmForm initial={modal.data} engineers={engineers} banks={banks} onSave={saveAtm} onClose={closeModal}/></Modal>}
      {modal?.type==="maint" &&<Modal title={modal.data?"Edit Maintenance Record":"Log Maintenance"} onClose={closeModal} width={600}><MaintForm initial={modal.data} atms={atms} engineers={engineers} banks={banks} onSave={saveMaint} onClose={closeModal}/></Modal>}
      {modal?.type==="eng"   &&<Modal title={modal.data?"Edit Engineer":"Add Engineer"} onClose={closeModal} width={480}><EngForm initial={modal.data} onSave={saveEng} onClose={closeModal}/></Modal>}

      {/* Bulk modals */}
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
