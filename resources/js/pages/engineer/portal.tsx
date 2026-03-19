// @ts-nocheck
/* eslint-disable */
import { useState, useEffect, useCallback, useRef } from "react";
import { router } from "@inertiajs/react";


// ─── Types ────────────────────────────────────────────────────────────────────
interface Engineer  { id:number; name:string; email:string; phone?:string; region:string; }
interface Bank      { id:number; name:string; short_code:string; }
interface Atm       { id:number; terminal_id:string; model:string; location:string; address?:string; status:string; bank:Bank; }
interface Attachment{ name:string; path:string; type:string; size:number; url:string; is_image:boolean; is_pdf:boolean; }
interface JobCard   {
  id:number; status:"draft"|"submitted"|"approved"|"rejected";
  type:string; work_description:string; parts_used?:string;
  hours_spent:number; scheduled_date:string; completed_date?:string;
  quarter:number; year:number; notes?:string; rejection_reason?:string;
  attachments:Attachment[]; submitted_at?:string; reviewed_at?:string; created_at:string;
  atm:Atm; reviewer?:{name:string};
}
interface PMRecord  {
  id:number; atm_id:number; type:string; status:string;
  scheduled_date:string; completed_date?:string; quarter:number; year:number;
  atm:Atm; job_card_id?:number;
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  primary:"#1d6ef5", primaryLight:"#eef3fe",
  success:"#10b366", successLight:"#eafaf2",
  warning:"#f59e0b", warningLight:"#fffbeb",
  danger:"#ef4444",  dangerLight:"#fef2f2",
  surface:"#f8f9fb", border:"#e8eaed",
  text:"#1a1d23",    textMid:"#4b5260", textMuted:"#8b909a",
  white:"#ffffff",
};

const TYPES    = ["Quarterly PM","Emergency","Part Replacement","Software Update","Cash Jam","Card Reader Service","Other"];
const QUARTERS = ["1","2","3","4"];
const now      = new Date();
const currentQ = Math.ceil((now.getMonth()+1)/3);

// ─── Responsive hook ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  useEffect(()=>{
    const fn = () => setMobile(window.innerWidth <= 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  },[]);
  return mobile;
}

const STATUS_COLOR:any = {draft:C.textMuted,submitted:C.warning,approved:C.success,rejected:C.danger};
const STATUS_BG:any    = {draft:"#f3f4f6",submitted:C.warningLight,approved:C.successLight,rejected:C.dangerLight};
const STATUS_LABEL:any = {draft:"Draft",submitted:"Pending",approved:"Approved",rejected:"Rejected"};
const PM_COLOR:any     = {Completed:C.success,Scheduled:C.warning,"In Progress":C.primary,Cancelled:C.textMuted};
const PM_BG:any        = {Completed:C.successLight,Scheduled:C.warningLight,"In Progress":C.primaryLight,Cancelled:C.surface};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d?:string|null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
}
function fileSize(b:number) {
  if (b<1024) return `${b}B`;
  if (b<1048576) return `${(b/1024).toFixed(1)}KB`;
  return `${(b/1048576).toFixed(1)}MB`;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const card = {background:C.white,borderRadius:16,border:`1px solid ${C.border}`,padding:16,marginBottom:12};
const inputStyle:any = {
  width:"100%",padding:"12px 14px",borderRadius:12,border:`1.5px solid ${C.border}`,
  fontSize:16,fontFamily:"inherit",color:C.text,background:C.surface,
  outline:"none",boxSizing:"border-box",WebkitAppearance:"none",
};
const labelStyle:any = {fontSize:13,fontWeight:600,color:C.textMid,display:"block",marginBottom:6};

// ─── Pill ─────────────────────────────────────────────────────────────────────
const Pill = ({status}:{status:string}) => (
  <span style={{background:STATUS_BG[status]??"#f3f4f6",color:STATUS_COLOR[status]??C.textMuted,
    borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,display:"inline-block",
    whiteSpace:"nowrap"}}>
    {STATUS_LABEL[status]??status}
  </span>
);

// ─── Button ───────────────────────────────────────────────────────────────────
const Btn = ({children,onClick,variant="primary",disabled=false,type="button",full=false}:any) => {
  const s:any={
    primary:  {background:C.primary,    color:"#fff", border:"none",boxShadow:"0 2px 8px rgba(29,110,245,.25)"},
    secondary:{background:C.surface,    color:C.text, border:`1px solid ${C.border}`},
    danger:   {background:C.dangerLight,color:C.danger,border:"1px solid #fecaca"},
    ghost:    {background:"transparent",color:C.textMid,border:`1px solid ${C.border}`},
    success:  {background:C.successLight,color:C.success,border:"1px solid #bbf7d0"},
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{
      ...s[variant],borderRadius:12,fontFamily:"inherit",fontWeight:700,
      cursor:disabled?"not-allowed":"pointer",fontSize:15,
      padding:"12px 20px",opacity:disabled?0.5:1,transition:"all .15s",
      width:full?"100%":"auto",textAlign:"center",
    }}>{children}</button>
  );
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({message,type,onClose}:any) => {
  const bg:any={success:C.successLight,error:C.dangerLight,warning:C.warningLight,info:C.primaryLight};
  const co:any={success:C.success,error:C.danger,warning:C.warning,info:C.primary};
  useEffect(()=>{const t=setTimeout(onClose,4000);return()=>clearTimeout(t);},[]);
  return (
    <div style={{background:bg[type],border:`1.5px solid ${co[type]}33`,borderRadius:14,
      padding:"14px 16px",display:"flex",alignItems:"center",gap:10,
      boxShadow:"0 4px 20px rgba(0,0,0,.12)"}}>
      <span style={{color:co[type],fontSize:16,flexShrink:0}}>
        {type==="success"?"✓":type==="error"?"✕":type==="warning"?"⚠":"ℹ"}
      </span>
      <span style={{fontSize:14,fontWeight:600,color:co[type],flex:1}}>{message}</span>
      <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",
        fontSize:18,color:co[type],opacity:.6,padding:0,flexShrink:0}}>×</button>
    </div>
  );
};

// ─── Modal (mobile sheet) ─────────────────────────────────────────────────────
const Modal = ({title,subtitle,onClose,children}:any) => (
  <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",
    zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center",
    padding:"0",WebkitOverflowScrolling:"touch"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:"20px 20px 0 0",
      width:"100%",maxWidth:640,maxHeight:"92vh",overflowY:"auto",
      boxShadow:"0 -8px 40px rgba(0,0,0,.15)"}}>
      {/* Pull handle */}
      <div style={{display:"flex",justifyContent:"center",padding:"12px 0 0"}}>
        <div style={{width:40,height:4,borderRadius:2,background:C.border}}/>
      </div>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",
        padding:"12px 20px 0"}}>
        <div>
          <h2 style={{margin:0,fontSize:17,fontWeight:800,color:C.text}}>{title}</h2>
          {subtitle&&<div style={{fontSize:12,color:C.textMuted,marginTop:2}}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",
          fontSize:24,color:C.textMuted,lineHeight:1,padding:4,marginLeft:12}}>×</button>
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>
);

// ─── File Upload ──────────────────────────────────────────────────────────────
const FileUpload = ({files,onChange}:{files:File[];onChange:(f:File[])=>void}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list:FileList|null) => {
    if (!list) return;
    const ok = Array.from(list).filter(f=>
      ['image/jpeg','image/png','image/gif','application/pdf',
       'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
       .includes(f.type) && f.size<=20*1024*1024
    );
    onChange([...files,...ok].slice(0,10));
  };

  const icon = (f:File) => f.type.startsWith('image/')?"🖼️":f.type==="application/pdf"?"📄":"📎";

  return (
    <div>
      <div onClick={()=>inputRef.current?.click()} style={{
        border:`2px dashed ${C.border}`,borderRadius:14,padding:"24px 16px",
        textAlign:"center",cursor:"pointer",background:C.surface}}>
        <div style={{fontSize:28,marginBottom:6}}>📎</div>
        <div style={{fontSize:14,fontWeight:600,color:C.primary}}>Tap to add files</div>
        <div style={{fontSize:12,color:C.textMuted,marginTop:4}}>
          Photos, PDFs, Word docs · max 20MB · up to 10 files
        </div>
        <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx"
          style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>
      </div>
      {files.length>0&&(
        <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
          {files.map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,
              background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px"}}>
              {f.type.startsWith('image/')
                ? <img src={URL.createObjectURL(f)} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
                : <span style={{fontSize:24,flexShrink:0}}>{icon(f)}</span>
              }
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:C.text,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                <div style={{fontSize:11,color:C.textMuted,marginTop:1}}>{fileSize(f.size)}</div>
              </div>
              <button onClick={()=>onChange(files.filter((_,j)=>j!==i))}
                style={{background:"none",border:"none",cursor:"pointer",
                  color:C.danger,fontSize:20,padding:0,flexShrink:0}}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Attachment List ──────────────────────────────────────────────────────────
const AttachmentList = ({attachments}:{attachments:Attachment[]}) => {
  if (!attachments?.length) return (
    <div style={{fontSize:13,color:C.textMuted,fontStyle:"italic",padding:"8px 0"}}>No attachments</div>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {attachments.map((a,i)=>(
        <a key={i} href={a.url} target="_blank" rel="noreferrer" download={a.name}
          style={{display:"flex",alignItems:"center",gap:10,background:C.surface,
            border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",
            textDecoration:"none"}}>
          {a.is_image
            ? <img src={a.url} alt="" style={{width:44,height:44,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
            : <span style={{fontSize:28,flexShrink:0}}>{a.is_pdf?"📄":"📎"}</span>
          }
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
            <div style={{fontSize:11,color:C.textMuted,marginTop:1}}>{fileSize(a.size)}</div>
          </div>
          <span style={{fontSize:13,color:C.primary,fontWeight:700,flexShrink:0}}>↓ Download</span>
        </a>
      ))}
    </div>
  );
};

// ─── Job Card Form ─────────────────────────────────────────────────────────────
const JobCardForm = ({atms,onSave,onClose,initialAtmId=null,initialType="Quarterly PM"}:any) => {
  const [form,setForm] = useState({
    atm_id:initialAtmId??"", type:initialType,
    work_description:"", parts_used:"", hours_spent:"",
    scheduled_date:now.toISOString().slice(0,10),
    completed_date:now.toISOString().slice(0,10),
    quarter:String(currentQ), year:String(now.getFullYear()), notes:"",
  });
  const [files,setFiles]   = useState<File[]>([]);
  const [saving,setSaving] = useState(false);
  const set = (k:any)=>(v:any)=>setForm(f=>({...f,[k]:v}));
  const selectedAtm = atms.find((a:Atm)=>String(a.id)===String(form.atm_id));

  const submit = (submitNow:boolean) => {
    if (!form.atm_id)                  { alert("Please select an ATM."); return; }
    if (!form.work_description.trim()) { alert("Please describe the work performed."); return; }
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k,v])=>fd.append(k,String(v)));
    fd.append('submit_now', submitNow?'1':'0');
    files.forEach(f=>fd.append('files[]',f));
    router.post('/engineer/job-cards', fd, {
      forceFormData:true,
      onSuccess:()=>onSave(submitNow),
      onError:(e)=>{ alert(Object.values(e)[0]||"Failed to save."); setSaving(false); },
      onFinish:()=>setSaving(false),
    });
  };

  return (
    <div style={{paddingBottom:20}}>
      {/* ATM select */}
      <div style={{marginBottom:16}}>
        <label style={labelStyle}>ATM <span style={{color:C.danger}}>*</span></label>
        <select value={form.atm_id} onChange={e=>set("atm_id")(e.target.value)} style={{
          ...inputStyle,appearance:"none",
          backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b909a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat:"no-repeat",backgroundPosition:"right 14px center",paddingRight:40}}>
          <option value="">— Select ATM —</option>
          {atms.map((a:Atm)=>(
            <option key={a.id} value={a.id}>{a.terminal_id} · {a.location} ({a.bank.short_code})</option>
          ))}
        </select>
        {selectedAtm&&(
          <div style={{marginTop:6,background:C.primaryLight,borderRadius:8,padding:"8px 12px",
            fontSize:12,color:C.primary,fontWeight:600}}>
            {selectedAtm.model} · {selectedAtm.status} · {selectedAtm.bank.name}
          </div>
        )}
      </div>

      {/* Type */}
      <div style={{marginBottom:16}}>
        <label style={labelStyle}>Maintenance Type <span style={{color:C.danger}}>*</span></label>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {TYPES.map(t=>(
            <button key={t} type="button" onClick={()=>set("type")(t)} style={{
              padding:"8px 14px",borderRadius:20,cursor:"pointer",fontFamily:"inherit",
              border:`1.5px solid ${form.type===t?C.primary:C.border}`,
              background:form.type===t?C.primary:C.surface,
              color:form.type===t?"#fff":C.textMid,fontSize:13,fontWeight:600,
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Work description */}
      <div style={{marginBottom:16}}>
        <label style={labelStyle}>Work Performed <span style={{color:C.danger}}>*</span></label>
        <textarea value={form.work_description} onChange={e=>set("work_description")(e.target.value)}
          placeholder="Describe all work performed in detail…" rows={4}
          style={{...inputStyle,resize:"vertical"}}/>
      </div>

      {/* Parts */}
      <div style={{marginBottom:16}}>
        <label style={labelStyle}>Parts Used</label>
        <textarea value={form.parts_used} onChange={e=>set("parts_used")(e.target.value)}
          placeholder="List any parts replaced or used…" rows={2}
          style={{...inputStyle,resize:"vertical"}}/>
      </div>

      {/* Hours + Quarter */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <div>
          <label style={labelStyle}>Hours Spent</label>
          <input type="number" value={form.hours_spent} onChange={e=>set("hours_spent")(e.target.value)}
            placeholder="e.g. 2.5" min="0" max="24" step="0.5" style={inputStyle}/>
        </div>
        <div>
          <label style={labelStyle}>Quarter</label>
          <div style={{display:"flex",gap:6}}>
            {QUARTERS.map(q=>(
              <button key={q} type="button" onClick={()=>set("quarter")(q)} style={{
                flex:1,padding:"12px 4px",borderRadius:10,cursor:"pointer",fontFamily:"inherit",
                border:`1.5px solid ${form.quarter===q?C.primary:C.border}`,
                background:form.quarter===q?C.primary:C.surface,
                color:form.quarter===q?"#fff":C.textMid,fontSize:13,fontWeight:700,
              }}>Q{q}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Dates */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <div>
          <label style={labelStyle}>Scheduled Date</label>
          <input type="date" value={form.scheduled_date} onChange={e=>set("scheduled_date")(e.target.value)} style={inputStyle}/>
        </div>
        <div>
          <label style={labelStyle}>Completed Date</label>
          <input type="date" value={form.completed_date} onChange={e=>set("completed_date")(e.target.value)} style={inputStyle}/>
        </div>
      </div>

      {/* Notes */}
      <div style={{marginBottom:16}}>
        <label style={labelStyle}>Notes</label>
        <textarea value={form.notes} onChange={e=>set("notes")(e.target.value)}
          placeholder="Any additional remarks…" rows={3}
          style={{...inputStyle,resize:"vertical"}}/>
      </div>

      {/* Files */}
      <div style={{marginBottom:24}}>
        <label style={labelStyle}>Attachments ({files.length}/10)</label>
        <FileUpload files={files} onChange={setFiles}/>
      </div>

      {/* Actions */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <Btn variant="primary" onClick={()=>submit(true)} disabled={saving} full>
          {saving?"Saving…":"✓ Submit for Review"}
        </Btn>
        <Btn variant="ghost" onClick={()=>submit(false)} disabled={saving} full>
          💾 Save as Draft
        </Btn>
        <Btn variant="secondary" onClick={onClose} disabled={saving} full>Cancel</Btn>
      </div>
    </div>
  );
};

// ─── Job Card Detail ──────────────────────────────────────────────────────────
const JobCardDetail = ({card,onClose,onSubmit,onDiscard,onNewSubmission}:any) => (
  <div style={{paddingBottom:8}}>
    {/* Status banner */}
    <div style={{background:STATUS_BG[card.status],borderRadius:12,padding:"14px 16px",marginBottom:16}}>
      <div style={{fontSize:15,fontWeight:700,color:STATUS_COLOR[card.status]}}>
        {STATUS_LABEL[card.status]}
      </div>
      {card.status==="rejected"&&card.rejection_reason&&(
        <div style={{fontSize:13,color:C.danger,marginTop:4}}>{card.rejection_reason}</div>
      )}
      {card.reviewer&&(
        <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>
          by {card.reviewer.name} · {fmt(card.reviewed_at)}
        </div>
      )}
    </div>

    {/* Info grid */}
    <div style={{background:C.surface,borderRadius:12,padding:14,
      display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
      {[
        ["ATM",card.atm.terminal_id],["Bank",card.atm.bank.name],
        ["Location",card.atm.location],["Type",card.type],
        ["Quarter",`Q${card.quarter} ${card.year}`],["Hours",`${card.hours_spent}h`],
        ["Scheduled",fmt(card.scheduled_date)],["Completed",fmt(card.completed_date)],
      ].map(([k,v])=>(
        <div key={k}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>{k}</div>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginTop:2}}>{v||"—"}</div>
        </div>
      ))}
    </div>

    {/* Work */}
    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",
        letterSpacing:"0.04em",marginBottom:8}}>Work Performed</div>
      <div style={{background:C.surface,borderRadius:10,padding:"12px 14px",
        fontSize:14,color:C.text,lineHeight:1.7}}>{card.work_description}</div>
    </div>

    {card.parts_used&&(
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",
          letterSpacing:"0.04em",marginBottom:8}}>Parts Used</div>
        <div style={{background:C.surface,borderRadius:10,padding:"12px 14px",
          fontSize:14,color:C.text}}>{card.parts_used}</div>
      </div>
    )}

    {card.notes&&(
      <div style={{background:C.warningLight,border:"1px solid #fde68a",borderRadius:10,
        padding:"10px 14px",fontSize:13,color:"#92400e",marginBottom:12}}>
        📝 {card.notes}
      </div>
    )}

    {/* Attachments */}
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",
        letterSpacing:"0.04em",marginBottom:10}}>
        Attachments ({card.attachments?.length??0})
      </div>
      <AttachmentList attachments={card.attachments}/>
    </div>

    {/* Actions */}
    <div style={{display:"flex",flexDirection:"column",gap:10,paddingTop:12,
      borderTop:`1px solid ${C.border}`}}>
      {card.status==="draft"&&(
        <>
          <Btn variant="primary"    onClick={onSubmit}  full>✓ Submit for Review</Btn>
          <Btn variant="danger"     onClick={onDiscard} full>🗑 Discard Draft</Btn>
        </>
      )}
      {card.status==="rejected"&&(
        <Btn variant="primary" onClick={onNewSubmission} full>+ Create New Submission</Btn>
      )}
      <Btn variant="secondary" onClick={onClose} full>Close</Btn>
    </div>
  </div>
);

// ─── Tab: Home (Dashboard) ────────────────────────────────────────────────────
const HomeTab = ({engineer,atms,jobCards,pmRecords,currentQuarter,currentYear}:any) => {
  const pmDone   = pmRecords.filter((p:PMRecord)=>p.status==="Completed").length;
  const pmTotal  = pmRecords.length;
  const pct      = pmTotal>0?Math.round((pmDone/pmTotal)*100):0;
  const pending  = jobCards.filter((c:JobCard)=>c.status==="submitted").length;
  const rejected = jobCards.filter((c:JobCard)=>c.status==="rejected").length;
  const approved = jobCards.filter((c:JobCard)=>c.status==="approved").length;
  const overdue  = pmRecords.filter((p:PMRecord)=>p.status!=="Completed"&&new Date(p.scheduled_date)<now);

  return (
    <div style={{padding:"16px 16px 24px"}}>
      {/* Greeting */}
      <div style={{marginBottom:20}}>
        <h1 style={{margin:0,fontSize:20,fontWeight:800,color:C.text}}>
          {now.getHours()<12?"Good morning":now.getHours()<17?"Good afternoon":"Good evening"}, {engineer.name.split(" ")[0]} 👋
        </h1>
        <p style={{margin:"4px 0 0",fontSize:13,color:C.textMuted}}>
          {engineer.region} Region · {atms.length} ATM{atms.length!==1?"s":""} assigned
        </p>
      </div>

      {/* PM Progress */}
      <div style={{...card,padding:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>Q{currentQuarter} {currentYear} — PM Progress</div>
            <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>{pmDone} of {pmTotal} ATMs serviced</div>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:pct===100?C.success:pct>50?C.primary:C.warning}}>{pct}%</div>
        </div>
        <div style={{height:8,background:C.surface,borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:4,transition:"width .5s",
            background:pct===100?C.success:pct>50?C.primary:C.warning,width:`${pct}%`}}/>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        {[
          {label:"Pending Review", value:pending,  color:C.warning, bg:C.warningLight},
          {label:"Approved",       value:approved, color:C.success, bg:C.successLight},
          {label:"PM Done",        value:pmDone,   color:C.primary, bg:C.primaryLight},
          {label:"Overdue PMs",    value:overdue.length, color:C.danger, bg:C.dangerLight},
        ].map((s:any)=>(
          <div key={s.label} style={{background:s.bg,borderRadius:14,padding:"14px 16px",
            border:`1px solid ${s.color}22`}}>
            <div style={{fontSize:26,fontWeight:800,color:s.color}}>{s.value}</div>
            <div style={{fontSize:12,fontWeight:600,color:s.color,marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Rejected alert */}
      {rejected>0&&(
        <div style={{background:C.dangerLight,border:"1px solid #fecaca",borderRadius:14,
          padding:"14px 16px",marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:700,color:C.danger}}>
            ⚠️ {rejected} job card{rejected>1?"s":""} rejected
          </div>
          <div style={{fontSize:12,color:C.danger,opacity:.8,marginTop:3}}>
            Go to Job Cards tab to review and resubmit.
          </div>
        </div>
      )}

      {/* Overdue alert */}
      {overdue.length>0&&(
        <div style={{background:C.warningLight,border:"1px solid #fde68a",borderRadius:14,
          padding:"14px 16px"}}>
          <div style={{fontSize:14,fontWeight:700,color:C.warning}}>
            ⏰ {overdue.length} overdue PM{overdue.length>1?"s":""}
          </div>
          <div style={{fontSize:12,color:C.warning,opacity:.9,marginTop:3}}>
            {overdue.map((p:PMRecord)=>p.atm.terminal_id).join(", ")}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Tab: PM Schedule ─────────────────────────────────────────────────────────
const PMTab = ({pmRecords,currentQuarter,currentYear,onLogJobCard}:any) => {
  const [filter,setFilter] = useState("all");
  const filtered = filter==="all" ? pmRecords
    : filter==="done"    ? pmRecords.filter((p:PMRecord)=>p.status==="Completed")
    : filter==="pending" ? pmRecords.filter((p:PMRecord)=>p.status!=="Completed"&&!p.job_card_id)
    : pmRecords.filter((p:PMRecord)=>p.status!=="Completed"&&new Date(p.scheduled_date)<now);

  return (
    <div style={{padding:"16px 16px 24px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <h2 style={{margin:0,fontSize:18,fontWeight:800,color:C.text}}>PM Schedule</h2>
          <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>Q{currentQuarter} {currentYear}</div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {[
          {id:"all",label:`All (${pmRecords.length})`},
          {id:"pending",label:"Pending"},
          {id:"overdue",label:"Overdue"},
          {id:"done",label:"Done"},
        ].map((f:any)=>(
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{
            padding:"7px 16px",borderRadius:20,border:"none",cursor:"pointer",
            fontFamily:"inherit",fontSize:13,fontWeight:filter===f.id?700:500,
            background:filter===f.id?C.primary:C.surface,
            color:filter===f.id?"#fff":C.textMid,
            border:filter===f.id?"none":`1px solid ${C.border}`,
            flexShrink:0,
          }}>{f.label}</button>
        ))}
      </div>

      {/* PM list */}
      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"48px 16px",color:C.textMuted}}>
          <div style={{fontSize:36,marginBottom:10}}>✅</div>
          <div style={{fontSize:15,fontWeight:600}}>All clear!</div>
          <div style={{fontSize:13,marginTop:4}}>No {filter==="done"?"":"incomplete "}PMs here</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map((pm:PMRecord)=>{
            const isOverdue = pm.status!=="Completed"&&new Date(pm.scheduled_date)<now;
            return (
              <div key={pm.id} style={{...card,padding:14,
                borderLeft:`4px solid ${PM_COLOR[pm.status]??C.textMuted}`}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontWeight:800,fontSize:15,color:C.text,fontFamily:"monospace"}}>
                        {pm.atm.terminal_id}
                      </span>
                      <span style={{background:C.primaryLight,color:C.primary,borderRadius:5,
                        padding:"2px 7px",fontSize:11,fontWeight:700}}>
                        {pm.atm.bank.short_code}
                      </span>
                    </div>
                    <div style={{fontSize:13,color:C.textMid,marginTop:3}}>{pm.atm.location}</div>
                    <div style={{fontSize:12,color:isOverdue?C.danger:C.textMuted,marginTop:3,
                      fontWeight:isOverdue?700:400}}>
                      📅 {fmt(pm.scheduled_date)}
                      {isOverdue&&<span style={{marginLeft:6,background:C.dangerLight,color:C.danger,
                        borderRadius:4,padding:"1px 6px",fontSize:11}}>OVERDUE</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                    <span style={{background:PM_BG[pm.status]??C.surface,color:PM_COLOR[pm.status]??C.textMuted,
                      borderRadius:20,padding:"4px 10px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
                      {pm.status}
                    </span>
                    {pm.job_card_id
                      ? <span style={{fontSize:11,color:C.success,fontWeight:700}}>✓ Card logged</span>
                      : pm.status!=="Completed"&&(
                          <button onClick={()=>onLogJobCard(pm.atm_id,"Quarterly PM")} style={{
                            background:C.primary,color:"#fff",border:"none",borderRadius:8,
                            padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",
                            fontFamily:"inherit",whiteSpace:"nowrap"}}>
                            + Log Card
                          </button>
                        )
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Tab: Log Job Card ────────────────────────────────────────────────────────
const LogTab = ({atms,onSave}:any) => (
  <div style={{padding:"16px 16px 24px"}}>
    <h2 style={{margin:"0 0 16px",fontSize:18,fontWeight:800,color:C.text}}>Log Job Card</h2>
    <JobCardForm atms={atms} onSave={onSave} onClose={()=>{}}/>
  </div>
);

// ─── Tab: My Job Cards ────────────────────────────────────────────────────────
const CardsTab = ({jobCards,onView}:any) => {
  const [filter,setFilter] = useState("all");
  const filtered = filter==="all"?jobCards:jobCards.filter((c:JobCard)=>c.status===filter);

  return (
    <div style={{padding:"16px 16px 24px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:800,color:C.text}}>My Job Cards</h2>
        <span style={{fontSize:13,color:C.textMuted}}>{jobCards.length} total</span>
      </div>

      {/* Filter chips */}
      <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {(["all","draft","submitted","approved","rejected"] as const).map(f=>{
          const count = f==="all"?jobCards.length:jobCards.filter((c:JobCard)=>c.status===f).length;
          const active= filter===f;
          return (
            <button key={f} onClick={()=>setFilter(f)} style={{
              padding:"7px 16px",borderRadius:20,border:active?"none":`1px solid ${C.border}`,
              cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:active?700:500,
              background:active?C.primary:C.surface,color:active?"#fff":C.textMid,flexShrink:0,
            }}>
              {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"48px 16px",color:C.textMuted}}>
          <div style={{fontSize:36,marginBottom:10}}>📭</div>
          <div style={{fontSize:14}}>No {filter==="all"?"":filter+" "}job cards</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map((card:JobCard)=>(
            <div key={card.id} onClick={()=>onView(card)}
              style={{...card,padding:14,cursor:"pointer",
                borderLeft:`4px solid ${STATUS_COLOR[card.status]??C.border}`}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:15,color:C.text,fontFamily:"monospace"}}>
                    {card.atm.terminal_id}
                  </div>
                  <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>
                    {card.atm.location} · {card.atm.bank.short_code}
                  </div>
                  <div style={{fontSize:13,fontWeight:600,color:C.text,marginTop:4}}>{card.type}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                  <Pill status={card.status}/>
                  {card.attachments?.length>0&&(
                    <span style={{fontSize:11,color:C.primary,fontWeight:700}}>
                      📎 {card.attachments.length}
                    </span>
                  )}
                </div>
              </div>
              {card.status==="rejected"&&card.rejection_reason&&(
                <div style={{marginTop:8,background:C.dangerLight,borderRadius:8,
                  padding:"8px 10px",fontSize:12,color:C.danger}}>
                  ✕ {card.rejection_reason}
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",marginTop:10,
                paddingTop:8,borderTop:`1px solid ${C.surface}`}}>
                <span style={{fontSize:12,color:C.textMuted}}>Q{card.quarter} {card.year}</span>
                <span style={{fontSize:12,color:C.textMuted}}>{fmt(card.scheduled_date)}</span>
                <span style={{fontSize:12,color:C.textMuted}}>{card.hours_spent}h</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Tab: Profile ─────────────────────────────────────────────────────────────
const ProfileTab = ({engineer}:any) => {
  const handleLogout = () => {
    if (confirm("Sign out?")) router.post("/logout");
  };
  return (
    <div style={{padding:"16px 16px 24px"}}>
      <h2 style={{margin:"0 0 16px",fontSize:18,fontWeight:800,color:C.text}}>Profile</h2>

      {/* Avatar */}
      <div style={{...card,padding:20,textAlign:"center",marginBottom:16}}>
        <div style={{width:72,height:72,borderRadius:36,background:C.primaryLight,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:24,fontWeight:800,color:C.primary,margin:"0 auto 12px"}}>
          {engineer.name.split(" ").map((n:string)=>n[0]).join("").slice(0,2)}
        </div>
        <div style={{fontSize:18,fontWeight:800,color:C.text}}>{engineer.name}</div>
        <div style={{fontSize:13,color:C.textMuted,marginTop:4}}>{engineer.region} Region</div>
        <div style={{marginTop:10,display:"inline-block",background:C.primaryLight,
          borderRadius:999,padding:"5px 16px"}}>
          <span style={{fontSize:12,fontWeight:700,color:C.primary}}>Field Engineer</span>
        </div>
      </div>

      {/* Details */}
      <div style={{...card,padding:0,overflow:"hidden",marginBottom:16}}>
        {[
          {label:"Email",  value:engineer.email},
          {label:"Phone",  value:engineer.phone||"—"},
          {label:"Region", value:engineer.region},
        ].map((r:any,i:number)=>(
          <div key={r.label} style={{display:"flex",padding:"14px 16px",
            borderBottom:i<2?`1px solid ${C.surface}`:"none"}}>
            <span style={{fontSize:13,color:C.textMuted,width:80,flexShrink:0}}>{r.label}</span>
            <span style={{fontSize:14,fontWeight:600,color:C.text,flex:1}}>{r.value}</span>
          </div>
        ))}
      </div>

      <button onClick={handleLogout} style={{
        width:"100%",padding:"14px",borderRadius:14,border:"1px solid #fecaca",
        background:C.dangerLight,color:C.danger,fontWeight:700,fontSize:15,
        fontFamily:"inherit",cursor:"pointer"}}>
        🚪 Sign Out
      </button>
    </div>
  );
};

// ─── Nav Tabs ─────────────────────────────────────────────────────────────────
const TABS = [
  {id:"home",    icon:"◈",  label:"Home"    },
  {id:"pm",      icon:"📋", label:"PM"      },
  {id:"log",     icon:"✏️", label:"Log Card"},
  {id:"cards",   icon:"🗂", label:"Job Cards"},
  {id:"profile", icon:"👤", label:"Profile" },
];

// ─── Login Screen ─────────────────────────────────────────────────────────────
const LoginScreen = ({errors}:any) => {
  const [email,setEmail]       = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading]   = useState(false);

  const submit = (e:any) => {
    e.preventDefault(); setLoading(true);
    router.post("/engineer/login",{email,password},{onFinish:()=>setLoading(false)});
  };

  return (
    <div style={{minHeight:"100vh",minHeight:"100dvh",
      background:`linear-gradient(160deg,${C.primaryLight} 0%,${C.surface} 50%,${C.primaryLight} 100%)`,
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:20,fontFamily:"system-ui,sans-serif",boxSizing:"border-box"}}>
      <div style={{background:C.white,borderRadius:24,border:`1px solid ${C.border}`,
        boxShadow:"0 8px 40px rgba(0,0,0,.10)",padding:"36px 28px",
        width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:64,height:64,borderRadius:18,background:C.primary,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:28,margin:"0 auto 14px"}}>🏧</div>
          <div style={{fontSize:22,fontWeight:800,color:C.text}}>NCR Engineer</div>
          <div style={{fontSize:13,color:C.textMuted,marginTop:4}}>Field Service Portal</div>
        </div>

        <form onSubmit={submit}>
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="you@techmasters.zm" required autoFocus
              style={{...inputStyle,borderColor:errors?.email?C.danger:C.border}}/>
            {errors?.email&&<div style={{fontSize:12,color:C.danger,marginTop:4}}>{errors.email}</div>}
          </div>
          <div style={{marginBottom:24}}>
            <label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{...inputStyle,borderColor:errors?.password?C.danger:C.border}}/>
            {errors?.password&&<div style={{fontSize:12,color:C.danger,marginTop:4}}>{errors.password}</div>}
          </div>
          <button type="submit" disabled={loading} style={{
            width:"100%",padding:"14px",borderRadius:14,border:"none",
            background:loading?`${C.primary}80`:C.primary,color:"#fff",
            fontWeight:700,fontSize:16,fontFamily:"inherit",
            cursor:loading?"not-allowed":"pointer",
            boxShadow:"0 2px 12px rgba(29,110,245,.3)"}}>
            {loading?"Signing in…":"Sign In"}
          </button>
        </form>
        <p style={{textAlign:"center",fontSize:12,color:C.textMuted,marginTop:20,marginBottom:0}}>
          NCR Fleet · Techmasters Zambia
        </p>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = ({engineer,atms,jobCards,pmRecords,currentQuarter,currentYear,flash}:any) => {
  const [tab,setTab]           = useState("home");
  const [modal,setModal]       = useState<null|"detail"|"drawer">(null);
  const [detailCard,setDetail] = useState<JobCard|null>(null);
  const [toasts,setToasts]     = useState<any[]>([]);
  const [logAtmId,setLogAtmId] = useState<number|null>(null);
  const [logType,setLogType]   = useState("Quarterly PM");

  const addToast = useCallback((message:string,type:string="success")=>{
    setToasts(t=>[...t,{id:Date.now(),message,type}]);
  },[]);

  useEffect(()=>{
    if (flash?.success) addToast(flash.success,"success");
    if (flash?.error)   addToast(flash.error,"error");
  },[flash]);

  const openLog = (atmId:number|null=null,type:string="Quarterly PM")=>{
    setLogAtmId(atmId); setLogType(type); setTab("log");
  };

  const handleSubmitDraft = (c:JobCard) => {
    if (!confirm("Submit this job card for review? You won't be able to edit it after.")) return;
    router.post(`/engineer/job-cards/${c.id}/submit`,{},{
      onSuccess:()=>{ setModal(null); addToast("Submitted for review!","success"); router.reload(); },
      onError:()=>addToast("Failed to submit.","error"),
    });
  };

  const handleDiscard = (c:JobCard) => {
    if (!confirm("Discard this draft? This cannot be undone.")) return;
    router.delete(`/engineer/job-cards/${c.id}`,{
      onSuccess:()=>{ setModal(null); addToast("Draft discarded.","warning"); router.reload(); },
      onError:()=>addToast("Failed to discard.","error"),
    });
  };

  const isMobile = useIsMobile();
  const initials = engineer.name.split(" ").map((n:string)=>n[0]).join("").slice(0,2);



  const NavLinks = ({onClick=()=>{},vertical=false}:any) => (
    <>
      {TABS.map((t:any)=>{
        const active=tab===t.id;
        return (
          <button key={t.id} onClick={()=>{setTab(t.id);onClick();}} style={{
            display:"flex",alignItems:"center",
            gap:vertical?12:6,
            padding:vertical?"12px 16px":"10px 14px",
            width:vertical?"100%":"auto",
            border:"none",
            background:vertical&&active?C.primaryLight:active&&!vertical?"none":"transparent",
            cursor:"pointer",fontFamily:"inherit",
            fontSize:13,fontWeight:active?700:500,
            color:active?C.primary:C.textMid,
            borderBottom:!vertical?`2.5px solid ${active?C.primary:"transparent"}`:"none",
            borderLeft:vertical?`3px solid ${active?C.primary:"transparent"}`:"none",
            whiteSpace:"nowrap",transition:"all .15s",flexShrink:0,
            borderRadius:vertical?8:0,
            textAlign:vertical?"left":"center",
          }}>
            <span style={{fontSize:vertical?18:14}}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </>
  );

  return (
    <>

      <div style={{minHeight:"100vh",background:C.surface,
        fontFamily:"system-ui,sans-serif",color:C.text}}>

        {/* Toasts — top */}
        <div style={{position:"fixed",top:16,left:0,right:0,zIndex:600,
          display:"flex",flexDirection:"column",gap:8,padding:"0 16px",pointerEvents:"none"}}>
          {toasts.map(t=>(
            <div key={t.id} style={{pointerEvents:"all"}}>
              <Toast message={t.message} type={t.type}
                onClose={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))}/>
            </div>
          ))}
        </div>

        {/* ── DESKTOP NAV (hidden on mobile) ── */}
        <nav style={{background:C.white,display:isMobile?"none":"flex",
          borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100,
          boxShadow:"0 1px 3px rgba(0,0,0,.06)",flexDirection:"column"}}>
          {/* Brand + user row */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"10px 24px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:8,background:C.primary,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏧</div>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:C.text,lineHeight:1.1}}>NCR Engineer Portal</div>
                <div style={{fontSize:10,color:C.textMuted,letterSpacing:"0.05em"}}>FIELD SERVICE</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              {engineer.is_admin&&(
                <a href="/" style={{fontSize:12,color:C.primary,fontWeight:700,
                  background:C.primaryLight,borderRadius:8,padding:"6px 14px",
                  textDecoration:"none",border:`1px solid ${C.primary}33`}}>
                  ⚡ Switch to Admin
                </a>
              )}
              <div style={{display:"flex",alignItems:"center",gap:8,
                border:`1px solid ${C.border}`,borderRadius:20,padding:"5px 12px 5px 6px"}}>
                <div style={{width:28,height:28,borderRadius:14,background:C.primaryLight,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:12,fontWeight:800,color:C.primary}}>{initials}</div>
                <span style={{fontSize:13,fontWeight:600,color:C.text}}>{engineer.name}</span>
              </div>
            </div>
          </div>
          {/* Tab links */}
          <div style={{display:"flex",padding:"0 16px",gap:2}}>
            <NavLinks/>
          </div>
        </nav>

        {/* ── MOBILE TOP BAR (hamburger + brand) ── */}
        <div style={{background:C.white,display:isMobile?"flex":"none",
          borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100,
          padding:"0 16px",height:56,alignItems:"center",justifyContent:"space-between"}}>
          {/* Hamburger */}
          <button onClick={()=>setModal("drawer")} style={{background:"none",border:"none",
            cursor:"pointer",padding:6,display:"flex",flexDirection:"column",gap:5}}>
            <span style={{display:"block",width:22,height:2,background:C.text,borderRadius:2}}/>
            <span style={{display:"block",width:22,height:2,background:C.text,borderRadius:2}}/>
            <span style={{display:"block",width:22,height:2,background:C.text,borderRadius:2}}/>
          </button>
          {/* Brand */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:7,background:C.primary,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🏧</div>
            <span style={{fontSize:14,fontWeight:800,color:C.text}}>NCR Engineer</span>
          </div>
          {/* Avatar */}
          <div style={{width:32,height:32,borderRadius:16,background:C.primaryLight,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:800,color:C.primary}}>{initials}</div>
        </div>

        {/* ── MOBILE DRAWER OVERLAY ── */}
        {modal==="drawer"&&(
          <>
            <div onClick={()=>setModal(null)} style={{position:"fixed",inset:0,
              background:"rgba(0,0,0,.45)",zIndex:300,backdropFilter:"blur(2px)"}}/>
            <div style={{position:"fixed",top:0,left:0,bottom:0,width:260,
              background:C.white,zIndex:400,
              boxShadow:"4px 0 24px rgba(0,0,0,.15)",
              display:"flex",flexDirection:"column",overflowY:"auto"}}>
              {/* Drawer header */}
              <div style={{padding:"20px 16px 14px",borderBottom:`1px solid ${C.border}`,
                display:"flex",alignItems:"center",justifyContent:"space-between",background:C.navBg??C.surface}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:9,background:C.primary,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🏧</div>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:C.text}}>NCR Engineer</div>
                    <div style={{fontSize:10,color:C.textMuted,letterSpacing:"0.06em",textTransform:"uppercase"}}>Field Service</div>
                  </div>
                </div>
                <button onClick={()=>setModal(null)} style={{background:"none",border:"none",
                  cursor:"pointer",fontSize:22,color:C.textMuted,padding:4}}>×</button>
              </div>
              {/* Engineer info */}
              <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,
                display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:40,height:40,borderRadius:20,background:C.primaryLight,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,fontWeight:800,color:C.primary}}>{initials}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:C.text}}>{engineer.name}</div>
                  <div style={{fontSize:12,color:C.textMuted}}>{engineer.region} Region</div>
                </div>
              </div>
              {/* Nav links */}
              <nav style={{padding:"8px 8px",flex:1}}>
                <NavLinks onClick={()=>setModal(null)} vertical/>
              </nav>
              {/* Drawer footer */}
              {engineer.is_admin&&(
                <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`}}>
                  <a href="/" style={{display:"flex",alignItems:"center",gap:10,
                    padding:"10px 12px",borderRadius:10,background:C.primaryLight,
                    textDecoration:"none",fontSize:13,fontWeight:700,color:C.primary}}>
                    <span>⚡</span> Switch to Admin
                  </a>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── TAB CONTENT ── */}
        <div style={{paddingBottom:isMobile?72:0}}>
          {tab==="home"    && <HomeTab    engineer={engineer} atms={atms} jobCards={jobCards} pmRecords={pmRecords} currentQuarter={currentQuarter} currentYear={currentYear}/>}
          {tab==="pm"      && <PMTab      pmRecords={pmRecords} currentQuarter={currentQuarter} currentYear={currentYear} onLogJobCard={openLog}/>}
          {tab==="log"     && <LogTab     atms={atms} onSave={(submitted:boolean)=>{ addToast(submitted?"Submitted for review!":"Saved as draft.","success"); router.reload(); setTab("cards"); }}/>}
          {tab==="cards"   && <CardsTab   jobCards={jobCards} onView={(c:JobCard)=>{setDetail(c);setModal("detail");}}/>}
          {tab==="profile" && <ProfileTab engineer={engineer}/>}
        </div>

        {/* ── MOBILE BOTTOM NAV ── */}
        <div style={{position:"fixed",bottom:0,left:0,right:0,display:isMobile?"flex":"none",
          zIndex:100,background:C.white,borderTop:`1px solid ${C.border}`,
          boxShadow:"0 -4px 16px rgba(0,0,0,.06)",height:64,flexDirection:"row"}}>
          {TABS.map((t:any)=>{
            const active=tab===t.id;
            return (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                flex:1,display:"flex",flexDirection:"column",alignItems:"center",
                justifyContent:"center",gap:3,border:"none",background:"none",
                cursor:"pointer",fontFamily:"inherit",padding:"8px 4px",
                position:"relative",
              }}>
                {active&&<div style={{position:"absolute",top:0,left:"50%",
                  transform:"translateX(-50%)",width:32,height:3,
                  borderRadius:"0 0 3px 3px",background:C.primary}}/>}
                <span style={{fontSize:18,lineHeight:1,opacity:active?1:.45}}>{t.icon}</span>
                <span style={{fontSize:10,fontWeight:active?700:500,
                  color:active?C.primary:C.textMuted,lineHeight:1}}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── DETAIL MODAL ── */}
        {modal==="detail"&&detailCard&&(
          <Modal title={`Job Card #${detailCard.id}`}
            subtitle={`${detailCard.atm.terminal_id} · ${detailCard.atm.location}`}
            onClose={()=>setModal(null)}>
            <JobCardDetail
              card={detailCard}
              onClose={()=>setModal(null)}
              onSubmit={()=>handleSubmitDraft(detailCard)}
              onDiscard={()=>handleDiscard(detailCard)}
              onNewSubmission={()=>{setModal(null);openLog(detailCard.atm.id,"Quarterly PM");}}
            />
          </Modal>
        )}
      </div>
    </>
  );
};

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function EngineerPortal({engineer,atms,jobCards,pmRecords,currentQuarter,currentYear,errors,flash}:any) {
  if (!engineer) return <LoginScreen errors={errors}/>;
  return (
    <Dashboard
      engineer={engineer} atms={atms??[]} jobCards={jobCards??[]}
      pmRecords={pmRecords??[]} currentQuarter={currentQuarter??1}
      currentYear={currentYear??new Date().getFullYear()} flash={flash}
    />
  );
}

EngineerPortal.layout = (page:any) => page;
