// @ts-nocheck
/* eslint-disable */
import { useState, useEffect, useCallback, useRef } from "react";
import { router } from "@inertiajs/react";
import "./engineer-job-cards.css";


// ─── Types ────────────────────────────────────────────────────────────────────
interface Engineer  { id:number; name:string; email:string; phone?:string; region:string; signature?:string|null; }
interface Bank      { id:number; name:string; short_code:string; }
interface Atm       { id:number; terminal_id:string; serial_number?:string; model:string; location:string; address?:string; status:string; has_gbna?:boolean; bank:Bank; }
interface Attachment{ name:string; path:string; type:string; size:number; url:string; is_image:boolean; is_pdf:boolean; }
interface JobCard   {
  id:number; status:"draft"|"submitted"|"approved"|"rejected";
  type:string; job_type?:string; work_description:string; parts_used?:string;
  fault_category?:string; checklist?:Record<string,string[]>; atm_status?:string;
  phone_support?:boolean;
  start_time?:string; end_time?:string; technician_signature?:string;
  custodian1_name?:string; custodian1_signature?:string;
  custodian2_name?:string; custodian2_signature?:string;
  hours_spent:number; scheduled_date:string; completed_date?:string;
  quarter:number; year:number; notes?:string; rejection_reason?:string;
  attachments:Attachment[]; submitted_at?:string; reviewed_at?:string; created_at:string;
  atm:Atm; reviewer?:{name:string};
}
interface EngCall   {
  id:number; call_type:"new"|"old"|"repeat";
  status:"pending"|"assigned"|"on_hold"|"escalated"|"resolved";
  priority:"low"|"medium"|"high"; fault_description:string;
  resolution_notes?:string; assigned_at?:string; created_at:string;
  sla_breach_at?:string; sla_status:"active"|"breached"|"met"|"none";
  sla_minutes?:number; sla_hours_allowed?:number;
  job_cards_count:number; is_mine:boolean; atm:Atm; engineer?:{id:number;name:string};
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
function localDateTimeValue(date=new Date()) {
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function localDateValue(date=new Date()) {
  return localDateTimeValue(date).slice(0,10);
}
function localTimeValue(date=new Date()) {
  return localDateTimeValue(date).slice(11,16);
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

// ─── Change Password Modal ──────────────────────────────────────────────────────
const ChangePasswordModal = ({ onClose }: any) => {
  const [form, setForm] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const submit = (e: any) => {
    e.preventDefault();
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
      <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap: 16 }}>
        <div>
          <label style={labelStyle}>Current Password <span style={{color:C.danger}}>*</span></label>
          <input type="password" value={form.current_password} onChange={e=>setForm({...form, current_password: e.target.value})} style={{...inputStyle, borderColor: errors.current_password ? C.danger : C.border}} required />
          {errors.current_password && <div style={{ fontSize: 11, color: C.danger, marginTop: 4 }}>{errors.current_password}</div>}
        </div>
        <div>
          <label style={labelStyle}>New Password <span style={{color:C.danger}}>*</span></label>
          <input type="password" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} style={{...inputStyle, borderColor: errors.password ? C.danger : C.border}} required />
          {errors.password && <div style={{ fontSize: 11, color: C.danger, marginTop: 4 }}>{errors.password}</div>}
        </div>
        <div>
          <label style={labelStyle}>Confirm New Password <span style={{color:C.danger}}>*</span></label>
          <input type="password" value={form.password_confirmation} onChange={e=>setForm({...form, password_confirmation: e.target.value})} style={{...inputStyle}} required />
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop: 8 }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={saving}>{saving ? "Saving..." : "Change Password"}</Btn>
        </div>
      </form>
    </Modal>
  );
};

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

// ─── PM / repair job-card forms ───────────────────────────────────────────────
const PM_CHECKLIST = [
  { key:"canopyHood", title:"TOP BOX / CANOPY", items:[
    "Encrypting PIN pad and FDKs working",
    "Card reader: cleaned, transport clear, test transaction done",
    "Journal printer cleaned, print legible",
    "Receipt printer cleaned and working",
    "PC Core: opened and cleaned",
  ]},
  { key:"cashDispenser", title:"Cash Dispenser Modules", items:[
    "All cassettes working (self-test run, notes learned)",
    "All pick modules / slots working",
    "D-wheel timing and status of all pick lines checked",
    "Carriage, Bill Aligner Module and SNT checked & cleaned",
    "Worn suction cups replaced",
    "Filter replaced",
    "Exit shutter cleaned",
  ]},
  { key:"gbna", title:"GBNA Module", items:[
    "Pre-acceptor cleaned, status checked",
    "Cassettes accepting notes for configured denominations",
    "Escrow / reservoir and bill validator cleaned and checked",
    "Transport test: upper, lower and exit shutter",
  ]},
  { key:"atmRoom", title:"ATM Room", items:[
    "Inverter / UPS installed and working",
    "Air conditioner installed and working",
  ]},
];
const atmOptionLabel=(atm:Atm)=>`${atm.terminal_id} · ${atm.location} (${atm.bank.short_code})`;
const ChecklistItemText=({item}:{item:string})=>item.startsWith("PC Core:")
  ? <><strong>PC Core</strong>{item.slice("PC Core".length)}</>
  : <>{item}</>;
const PM_ANSWERS = [
  ["ok","Done"],["na","N/A"],["nr","No action needed"],["fail","Not OK"],
];
const VISIT_STATUS = ["In Service","Out of Service","Pending Parts"];

const SignaturePad = ({value,onChange,label}:any) => {
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawing=useRef(false);
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const context=canvas.getContext("2d");
    if(!context)return;
    context.clearRect(0,0,600,150);
    if(value){
      const image=new Image();
      image.onload=()=>context.drawImage(image,0,0,600,150);
      image.src=value;
    }
  },[value]);
  const point=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*600/rect.width,y:(event.clientY-rect.top)*150/rect.height};
  };
  const start=(event:React.PointerEvent<HTMLCanvasElement>)=>{
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
  const move=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    if(!drawing.current)return;
    const context=event.currentTarget.getContext("2d");
    if(!context)return;
    const p=point(event);
    context.lineTo(p.x,p.y);
    context.stroke();
  };
  const end=(event:React.PointerEvent<HTMLCanvasElement>)=>{
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
    <label style={labelStyle}>{label}</label>
    <canvas ref={canvasRef} width={600} height={150} onPointerDown={start} onPointerMove={move}
      onPointerUp={end} onPointerCancel={end}
      style={{width:"100%",height:110,display:"block",touchAction:"none",background:"#fff",border:`1px solid ${C.border}`,borderRadius:8}}/>
    <button type="button" onClick={clear} style={{marginTop:6,padding:0,border:0,background:"none",color:C.primary,fontWeight:700,cursor:"pointer"}}>Clear signature</button>
  </div>;
};

const JobCardForm = ({atms,onSave,onClose,initialAtmId=null}:any) => {
  const [atmSearch,setAtmSearch]=useState(()=>{
    const initialAtm=atms.find((atm:Atm)=>String(atm.id)===String(initialAtmId));
    return initialAtm?atmOptionLabel(initialAtm):"";
  });
  const [form,setForm]=useState<any>({
    atm_id:initialAtmId??"",service_date:localDateValue(),start_time:"",end_time:"",
    atm_status:"In Service",notes:"",
    checklist:Object.fromEntries(PM_CHECKLIST.map(section=>[section.key,section.items.map(()=>null)])),
    custodian1_name:"",custodian1_signature:"",custodian2_name:"",custodian2_signature:"",
  });
  const [files,setFiles]=useState<File[]>([]);
  const [saving,setSaving]=useState(false);
  const [attempted,setAttempted]=useState(false);
  const set=(key:string)=>(value:any)=>setForm((current:any)=>({...current,[key]:value}));
  const selectedAtm=atms.find((atm:Atm)=>String(atm.id)===String(form.atm_id));
  const searchAtm=(value:string)=>{
    setAtmSearch(value);
    const match=atms.find((atm:Atm)=>atmOptionLabel(atm).toLocaleLowerCase()===value.trim().toLocaleLowerCase());
    set("atm_id")(match?.id??"");
  };
  const sections=PM_CHECKLIST.filter(section=>section.key!=="gbna"||selectedAtm?.has_gbna);
  const setChecklist=(section:string,index:number,value:string)=>setForm((current:any)=>({
    ...current,checklist:{...current.checklist,[section]:current.checklist[section].map((answer:string|null,i:number)=>i===index?value:answer)},
  }));
  const markSectionDone=(section:string)=>setForm((current:any)=>({
    ...current,
    checklist:{
      ...current.checklist,
      [section]:current.checklist[section].map((answer:string|null)=>answer||"ok"),
    },
  }));
  const checklistComplete=sections.every(section=>form.checklist[section.key]?.every(Boolean));
  const valid=!!form.atm_id&&!!form.service_date&&!!form.start_time&&!!form.end_time
    &&!!form.custodian1_name.trim()&&!!form.custodian1_signature
    &&checklistComplete
    &&(!form.custodian2_name.trim()||!!form.custodian2_signature)
    &&(!form.custodian2_signature||!!form.custodian2_name.trim());

  const submit=(submitNow:boolean)=>{
    setAttempted(true);
    if(!valid)return;
    setSaving(true);
    const serviceDate=new Date(`${form.service_date}T00:00:00`);
    const [startHour,startMinute]=form.start_time.split(":").map(Number);
    const [endHour,endMinute]=form.end_time.split(":").map(Number);
    let minutes=(endHour*60+endMinute)-(startHour*60+startMinute);
    if(minutes<0)minutes+=24*60;
    const hours=Math.round(minutes/6)/10;
    const fd=new FormData();
    fd.append("atm_id",String(form.atm_id));
    fd.append("type","Quarterly PM");
    fd.append("job_type","maintenance");
    fd.append("work_description","Preventive maintenance checklist completed");
    fd.append("atm_status",form.atm_status);
    fd.append("start_time",form.start_time);
    fd.append("end_time",form.end_time);
    fd.append("scheduled_date",form.service_date);
    fd.append("completed_date",form.service_date);
    fd.append("hours_spent",String(hours));
    fd.append("quarter",String(Math.ceil((serviceDate.getMonth()+1)/3)));
    fd.append("year",String(serviceDate.getFullYear()));
    fd.append("notes",form.notes);
    fd.append("custodian1_name",form.custodian1_name);
    fd.append("custodian1_signature",form.custodian1_signature);
    fd.append("custodian2_name",form.custodian2_name);
    fd.append("custodian2_signature",form.custodian2_signature);
    sections.forEach(section=>form.checklist[section.key].forEach((answer:string,index:number)=>{
      fd.append(`checklist[${section.key}][${index}]`,answer);
    }));
    fd.append("submit_now",submitNow?"1":"0");
    files.forEach(file=>fd.append("files[]",file));
    router.post("/engineer/job-cards",fd,{
      forceFormData:true,
      onSuccess:()=>onSave(submitNow),
      onError:(errors)=>{alert(Object.values(errors)[0]||"Failed to save.");setSaving(false);},
      onFinish:()=>setSaving(false),
    });
  };
  const required=attempted?" *":"";
  const fieldLabel=(text:string,missing:boolean)=> <label style={labelStyle}>{text}{required&&missing&&<span style={{color:C.danger}}>{required}</span>}</label>;

  return <div className="engineer-jobcard-form" style={{paddingBottom:20,display:"grid",gap:16}}>
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:16,display:"grid",gap:14}}>
      <div>
        {fieldLabel("ATM",!form.atm_id)}
        <input
          type="search"
          list="engineer-pm-atms"
          value={atmSearch}
          onChange={event=>searchAtm(event.target.value)}
          placeholder="Search by ATM ID, location, or bank…"
          autoComplete="off"
          style={inputStyle}
        />
        <datalist id="engineer-pm-atms">
          {atms.map((atm:Atm)=><option key={atm.id} value={atmOptionLabel(atm)}/>)}
        </datalist>
      </div>
      {selectedAtm&&<div style={{background:C.primaryLight,borderRadius:8,padding:12,fontSize:13,color:C.primary,fontWeight:600}}>
        {selectedAtm.bank.name} · {selectedAtm.location} · {selectedAtm.model} · {selectedAtm.serial_number||"Serial number not recorded"}
      </div>}
      <div className="engineer-jobcard-date-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
        <div>{fieldLabel("Service date",!form.service_date)}<div className="engineer-jobcard-now-field"><input type="date" value={form.service_date} onChange={event=>set("service_date")(event.target.value)} style={inputStyle}/><button type="button" className="engineer-jobcard-now" onClick={()=>set("service_date")(localDateValue())}>Now</button></div></div>
        <div>{fieldLabel("CE start time",!form.start_time)}<input type="time" value={form.start_time} onChange={event=>set("start_time")(event.target.value)} style={inputStyle}/></div>
        <div>{fieldLabel("CE end time",!form.end_time)}<div className="engineer-jobcard-now-field"><input type="time" value={form.end_time} onChange={event=>set("end_time")(event.target.value)} style={inputStyle}/><button type="button" className="engineer-jobcard-now" onClick={()=>set("end_time")(localTimeValue())}>Now</button></div></div>
        <div>{fieldLabel("ATM status after visit",!form.atm_status)}<select value={form.atm_status} onChange={event=>set("atm_status")(event.target.value)} style={inputStyle}>{VISIT_STATUS.map(status=><option key={status}>{status}</option>)}</select></div>
      </div>
      {sections.map(section=><section key={section.key} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,margin:"4px 0 8px"}}>
            <h3 style={{fontSize:14,fontWeight:800,color:C.text,margin:0}}>{section.title}</h3>
            <button type="button" onClick={()=>markSectionDone(section.key)} style={{flexShrink:0,padding:"5px 9px",border:`1px solid ${C.success}55`,borderRadius:7,background:C.successLight,color:C.success,fontSize:11,fontWeight:700,cursor:"pointer"}}>
              ✓ All done
            </button>
          </div>
          {section.items.map((item,index)=><div key={item} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(130px,auto)",alignItems:"center",gap:10,padding:"9px 0",borderTop:`1px solid ${C.border}`}}>
            <span style={{fontSize:13,color:C.textMid}}><ChecklistItemText item={item}/></span>
            <select aria-label={`${item} status`} value={form.checklist[section.key][index]||""} onChange={event=>setChecklist(section.key,index,event.target.value)} style={{...inputStyle,padding:"9px 10px",borderColor:attempted&&!form.checklist[section.key][index]?C.danger:C.border}}>
              <option value="">Select status…</option>{PM_ANSWERS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </div>)}
        </section>)}
      <div>{fieldLabel("Notes / remarks",false)}<textarea value={form.notes} onChange={event=>set("notes")(event.target.value)} placeholder="Describe any Not OK items or other observations…" rows={3} style={{...inputStyle,resize:"vertical"}}/></div>
    </div>
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:16,display:"grid",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
        <div>{fieldLabel("Custodian 1 name",!form.custodian1_name.trim())}<input value={form.custodian1_name} onChange={event=>set("custodian1_name")(event.target.value)} style={inputStyle}/></div>
        <div>{fieldLabel("Custodian 2 name (optional)",!!form.custodian2_name.trim()&&!form.custodian2_signature)}<input value={form.custodian2_name} onChange={event=>set("custodian2_name")(event.target.value)} style={inputStyle}/></div>
      </div>
      <SignaturePad label="Custodian 1 signature" value={form.custodian1_signature} onChange={set("custodian1_signature")}/>
      <SignaturePad label="Custodian 2 signature (optional)" value={form.custodian2_signature} onChange={set("custodian2_signature")}/>
    </div>
    <div>
      {fieldLabel("Attachments",false)}<FileUpload files={files} onChange={setFiles}/>
    </div>
    {attempted&&!valid&&<div role="alert" style={{background:C.dangerLight,color:C.danger,padding:12,borderRadius:8,fontSize:13}}>Complete the required fields, PM checklist items, and custodian signatures before saving.</div>}
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <Btn variant="primary" onClick={()=>submit(true)} disabled={saving} full>{saving?"Saving…":"✓ Submit for Review"}</Btn>
      <Btn variant="ghost" onClick={()=>submit(false)} disabled={saving} full>💾 Save as Draft</Btn>
      <Btn variant="secondary" onClick={onClose} disabled={saving} full>Cancel</Btn>
    </div>
  </div>;
};

// ─── Job Card Detail ──────────────────────────────────────────────────────────
const JobCardDetail = ({card,onClose,onSubmit,onDiscard,onNewSubmission}:any) => (
  <div className="engineer-jobcard-detail" style={{paddingBottom:8}}>
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
    <div className="engineer-jobcard-detail-info" style={{background:C.surface,borderRadius:12,padding:14,
      display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:16}}>
      {[
        ["ATM",card.atm.terminal_id],["Bank",card.atm.bank.name],
        ["Location",card.atm.location],["Type",card.type],
        ["Quarter",`Q${card.quarter} ${card.year}`],["Hours",`${card.hours_spent}h`],
        ["Scheduled",fmt(card.scheduled_date)],["Completed",fmt(card.completed_date)],
        ["Visit time",card.start_time&&card.end_time?`${card.start_time}–${card.end_time}`:"—"],
        ["ATM status",card.atm_status||"—"],
      ].map(([k,v])=>(
        <div key={k}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>{k}</div>
          <div style={{fontSize:14,fontWeight:600,color:C.text,marginTop:2}}>{v||"—"}</div>
        </div>
      ))}
    </div>

    {card.job_type==="repair"&&card.fault_category&&(
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>Fault category</div>
        <div style={{background:C.surface,borderRadius:10,padding:"12px 14px",fontSize:14,color:C.text}}>{card.fault_category}</div>
      </div>
    )}

    {card.job_type==="maintenance"&&card.checklist&&(
      <div style={{display:"grid",gap:10,marginBottom:12}}>
        {PM_CHECKLIST.filter(section=>card.checklist?.[section.key]).map(section=>(
          <div key={section.key} className="engineer-jobcard-checklist" style={{background:C.surface,borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:12,fontWeight:800,color:C.text,marginBottom:8}}>{section.title}</div>
            {section.items.map((item,index)=>{
              const answer=card.checklist?.[section.key]?.[index];
              return <div key={item} className="engineer-jobcard-check-row" style={{display:"flex",justifyContent:"space-between",gap:10,padding:"5px 0",fontSize:12,color:C.textMid,borderTop:`1px solid ${C.border}`}}>
              <span style={{minWidth:0,overflowWrap:"anywhere"}}><ChecklistItemText item={item}/></span><strong style={{flexShrink:0,whiteSpace:"nowrap",color:answer==="fail"?C.danger:C.primary}}>{PM_ANSWERS.find(([value])=>value===answer)?.[1]||"—"}</strong>
              </div>;
            })}
          </div>
        ))}
      </div>
    )}

    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",
        letterSpacing:"0.04em",marginBottom:8}}>
        {card.job_type==="maintenance"?"Notes / Remarks":"Work Performed"}
      </div>
      <div style={{background:C.surface,borderRadius:10,padding:"12px 14px",
        fontSize:14,color:C.text,lineHeight:1.7}}>
        {card.job_type==="maintenance"?(card.notes||"No notes recorded"):card.work_description}
      </div>
    </div>

    {card.parts_used&&(
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",
          letterSpacing:"0.04em",marginBottom:8}}>Parts Used</div>
        <div style={{background:C.surface,borderRadius:10,padding:"12px 14px",
          fontSize:14,color:C.text}}>{card.parts_used}</div>
      </div>
    )}

    {(card.status!=="draft"&&card.technician_signature||card.custodian1_name||card.custodian2_name)&&(
      <div style={{background:C.surface,borderRadius:10,padding:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:12}}>
        {[
          ["Engineer",card.status!=="draft"?card.technician_signature:null,"Engineer signature"],
          [card.custodian1_name||"Custodian 1",card.custodian1_signature,"Custodian 1 signature"],
          [card.custodian2_name||"Custodian 2",card.custodian2_signature,"Custodian 2 signature"],
        ].filter(([,signature])=>signature).map(([name,signature,label])=>(
          <div key={label} style={{fontSize:11,color:C.textMid}}>
            <div style={{fontWeight:700,marginBottom:5}}>{name}</div>
            <img src={signature} alt={label} style={{width:"100%",height:48,objectFit:"contain",background:C.white,borderRadius:6}}/>
          </div>
        ))}
      </div>
    )}

    {card.job_type!=="maintenance"&&card.notes&&(
      <div style={{background:C.warningLight,border:"1px solid #fde68a",borderRadius:10,
        padding:"10px 14px",fontSize:13,color:"#92400e",marginBottom:12}}>
        📝 {card.notes}
      </div>
    )}

    {/* Attachments */}
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:800,color:C.textMuted,textTransform:"uppercase",
        letterSpacing:"0.04em",marginBottom:10}}>
        Attachments ({card.attachments?.length??0})
      </div>
      <AttachmentList attachments={card.attachments}/>
    </div>

    {/* Actions */}
    <div style={{display:"flex",flexDirection:"column",gap:10,paddingTop:12,
      borderTop:`1px solid ${C.border}`}}>
      <a href={`/job-cards/${card.id}/print`} target="_blank" rel="noreferrer"
        style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,width:"100%",boxSizing:"border-box",background:C.surface,color:C.text,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 20px",fontFamily:"inherit",fontWeight:700,fontSize:15,textAlign:"center",textDecoration:"none"}}>
        ↓ Print / Save PDF for Custodian
      </a>
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
  const approvedPmCards=jobCards.filter((jobCard:JobCard)=>(jobCard.job_type==="maintenance"||jobCard.type==="Quarterly PM")
      &&jobCard.status==="approved"
      &&jobCard.quarter===currentQuarter
      &&jobCard.year===currentYear);
  const scheduledPmAtms=new Set<number>(pmRecords.map((record:PMRecord)=>record.atm_id));
  const completedPmAtms=new Set<number>(
    pmRecords.filter((record:PMRecord)=>record.status==="Completed").map((record:PMRecord)=>record.atm_id)
  );
  approvedPmCards.forEach((jobCard:JobCard)=>{
    completedPmAtms.add(jobCard.atm.id);
    scheduledPmAtms.add(jobCard.atm.id);
  });
  const pmDone=completedPmAtms.size;
  const pmTotal=scheduledPmAtms.size;
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
                            + Log PM
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
const LogTab = ({atms,onSave,initialAtmId}:any) => (
  <div style={{padding:"16px 16px 24px"}}>
    <h2 style={{margin:"0 0 16px",fontSize:18,fontWeight:800,color:C.text}}>Preventive Maintenance Job Card</h2>
    <JobCardForm atms={atms} onSave={onSave} onClose={()=>{}} initialAtmId={initialAtmId}/>
  </div>
);

// ─── Tab: My Job Cards ────────────────────────────────────────────────────────
const CardsTab = ({jobCards,onView}:any) => {
  const [filter,setFilter] = useState("all");
  const filtered = filter==="all"?jobCards:jobCards.filter((c:JobCard)=>c.status===filter);

  return (
    <div style={{padding:"16px 16px 24px"}}>
      <div className="engineer-jobcards-heading" style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:800,color:C.text}}>My Job Cards</h2>
        <span style={{fontSize:13,color:C.textMuted}}>{jobCards.length} total</span>
      </div>

      {/* Filter chips */}
      <div className="engineer-jobcards-filters" style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
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
        <div className="engineer-jobcards-list" style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map((jobCard:JobCard)=>(
            <div key={jobCard.id} onClick={()=>onView(jobCard)}
              className="engineer-jobcard-list-card"
              style={{...card,padding:14,cursor:"pointer",
                borderLeft:`4px solid ${STATUS_COLOR[jobCard.status]??C.border}`}}>
              <div className="engineer-jobcard-list-header" style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div className="engineer-jobcard-terminal" style={{fontWeight:800,fontSize:15,color:C.text,fontFamily:"monospace"}}>
                    {jobCard.atm.terminal_id}
                  </div>
                  <div className="engineer-jobcard-site" style={{fontSize:12,color:C.textMuted,marginTop:2}}>
                    {jobCard.atm.location} · {jobCard.atm.bank.short_code}
                  </div>
                  <div className="engineer-jobcard-type" style={{fontSize:13,fontWeight:600,color:C.text,marginTop:4}}>{jobCard.type}</div>
                </div>
                <div className="engineer-jobcard-list-status" style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                  <Pill status={jobCard.status}/>
                  {jobCard.attachments?.length>0&&(
                    <span style={{fontSize:11,color:C.primary,fontWeight:700}}>
                      📎 {jobCard.attachments.length}
                    </span>
                  )}
                </div>
              </div>
              {jobCard.status==="rejected"&&jobCard.rejection_reason&&(
                <div style={{marginTop:8,background:C.dangerLight,borderRadius:8,
                  padding:"8px 10px",fontSize:12,color:C.danger}}>
                  ✕ {jobCard.rejection_reason}
                </div>
              )}
              <div className="engineer-jobcard-list-meta" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginTop:10,paddingTop:8,borderTop:`1px solid ${C.surface}`}}>
                <span><small>Quarter</small>Q{jobCard.quarter} {jobCard.year}</span>
                <span><small>Service date</small>{fmt(jobCard.scheduled_date)}</span>
                <span><small>Time on site</small>{jobCard.hours_spent}h</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Tab: Profile ─────────────────────────────────────────────────────────────
const ProfileTab = ({engineer, onPassClick, addToast}:any) => {
  const [signature,setSignature]=useState(engineer.signature||"");
  const [savingSignature,setSavingSignature]=useState(false);
  const handleLogout = () => {
    if (confirm("Sign out?")) router.post("/logout");
  };
  const saveSignature=()=>{
    setSavingSignature(true);
    router.put("/engineer/signature",{signature},{
      onSuccess:()=>addToast("Engineer signature saved.","success"),
      onError:errors=>addToast(errors.signature||"Could not save engineer signature.","error"),
      onFinish:()=>setSavingSignature(false),
    });
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

      <div style={{...card,padding:16,marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>Engineer Signature</div>
        <p style={{fontSize:12,color:C.textMuted,margin:"0 0 12px"}}>
          Save your signature once. It will be added to submitted job cards and shown in their printed PDFs.
        </p>
        <SignaturePad label="Draw your saved signature" value={signature} onChange={setSignature}/>
        <Btn variant="primary" onClick={saveSignature} disabled={savingSignature} full>
          {savingSignature?"Saving…":"Save Signature"}
        </Btn>
      </div>

      <button onClick={onPassClick} style={{
        width:"100%",padding:"14px",borderRadius:14,border:`1px solid ${C.border}`,
        background:C.white,color:C.textMid,fontWeight:700,fontSize:15,
        fontFamily:"inherit",cursor:"pointer",marginBottom:12}}>
        🔑 Change Password
      </button>
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
  {id:"log",     icon:"✏️", label:"Log PM"},
  {id:"cards",   icon:"🗂", label:"Job Cards"},
  {id:"calls",   icon:"📞", label:"Calls"   },
];

const CALL_PRIORITY:any = {
  high:   { color:"#ef4444", bg:"#fef2f2", label:"High"   },
  medium: { color:"#f59e0b", bg:"#fffbeb", label:"Medium" },
  low:    { color:"#10b366", bg:"#eafaf2", label:"Low"    },
};
const CALL_STATUS:any = {
  pending:   { color:"#6b7280", bg:"#f3f4f6",      label:"Pending"        },
  assigned:  { color:"#1d6ef5", bg:"#eef3fe",      label:"Assigned"       },
  on_hold:   { color:"#f59e0b", bg:"#fffbeb",      label:"On Hold"        },
  escalated: { color:"#10b366", bg:"#eafaf2",      label:"Escalated→Bank" },
  resolved:  { color:"#10b366", bg:"#eafaf2",      label:"Resolved"       },
};
const CALL_TYPE:any = {
  new:    { color:"#1d6ef5", bg:"#eef3fe", label:"New"    },
  old:    { color:"#f59e0b", bg:"#fffbeb", label:"Old"    },
  repeat: { color:"#ef4444", bg:"#fef2f2", label:"Repeat" },
};

function slaInfo(call:any) {
  if (!call.sla_breach_at || call.sla_status==="none") return null;
  const m = call.sla_minutes ?? 0;
  if (call.sla_status==="breached"||m<=0) return {text:"SLA Breached", color:"#ef4444", bg:"#fef2f2"};
  const h = Math.floor(m/60), mins = m%60;
  const text = h>0?`${h}h ${mins}m left`:`${mins}m left`;
  const color = m<30?"#ef4444":m<60?"#f59e0b":"#1d6ef5";
  const bg    = m<30?"#fef2f2":m<60?"#fffbeb":"#eef3fe";
  return {text,color,bg};
}

function getCSRFCookie() {
  const m = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  return (document.querySelector('meta[name="csrf-token"]') as any)?.content ?? "";
}

// ─── Close Call Form ──────────────────────────────────────────────────────────
const CloseCallForm = ({call, onClose, onSaved}:any) => {
  // Default closed_at to current local datetime
  const nowLocal = new Date();
  const localIso = localDateTimeValue(nowLocal);
  const startedAt = new Date(call.assigned_at || call.created_at || nowLocal);

  const [form,setForm] = useState({
    fault_category:"", work_description:"", parts_used:"",
    atm_status:"In Service", start_time:startedAt.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),
    custodian1_name:"", custodian1_signature:"",
    custodian2_name:"", custodian2_signature:"", phone_support:false,
    closed_at: localIso, notes:"",
  });
  const [files,setFiles2]  = useState<File[]>([]);
  const [saving,setSaving] = useState(false);
  const set = (k:string)=>(v:any)=>setForm(f=>({...f,[k]:v}));

  const submit = async (submitNow:boolean) => {
    if (!form.fault_category) { alert("Please select the fault category."); return; }
    if (form.work_description.trim().length<10) { alert("Please describe the work performed and resolution (at least 10 characters)."); return; }
    if (!form.start_time) { alert("Please enter the engineer arrival time."); return; }
    if (!form.phone_support && !form.custodian1_name.trim()) { alert("Please enter the custodian's name."); return; }
    if (!form.phone_support && !form.custodian1_signature) { alert("Please capture the custodian's signature."); return; }
    if (!!form.custodian2_name.trim() !== !!form.custodian2_signature) { alert("Enter both the second custodian's name and signature, or leave both blank."); return; }
    const closedAt = new Date(form.closed_at);
    if (Number.isNaN(closedAt.getTime())) { alert("Please enter a valid call closing date and time."); return; }
    setSaving(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k,v])=>{
      if(k==="closed_at") return;
      if(k!=="phone_support") fd.append(k,String(v));
    });
    fd.append("closed_at",closedAt.toISOString());
    fd.append("phone_support",form.phone_support?"1":"0");
    fd.append("submit_now", submitNow?"1":"0");
    files.forEach(f=>fd.append("files[]",f));
    try {
      const res = await fetch(`/engineer/calls/${call.id}/close`, {
        method:"POST",
        headers:{ "X-Requested-With":"XMLHttpRequest","X-XSRF-TOKEN":getCSRFCookie() },
        credentials:"same-origin",
        body:fd,
      });
      if (!res.ok) {
        const e=await res.json();
        const message=e.message||Object.values(e.errors||{})[0]?.[0]||"Failed to close call.";
        alert(message);
        setSaving(false);
        return;
      }
      onSaved();
    } catch { alert("Network error."); setSaving(false); }
  };

  return (
    <div style={{paddingBottom:8}}>
      {/* Call summary */}
      <div style={{background:CALL_PRIORITY[call.priority].bg,borderRadius:12,padding:"12px 14px",
        marginBottom:16,borderLeft:`4px solid ${CALL_PRIORITY[call.priority].color}`}}>
        <div style={{fontSize:14,fontWeight:700,color:CALL_PRIORITY[call.priority].color}}>
          {call.atm.terminal_id} · {call.atm.bank.short_code}
        </div>
        <div style={{fontSize:13,color:C.textMid,marginTop:3}}>{call.fault_description}</div>
        <div style={{fontSize:12,color:C.textMuted,marginTop:4}}>{call.atm.location} · {call.atm.model}</div>
      </div>

      <div style={{fontSize:13,fontWeight:700,color:C.text,margin:"16px 0 12px",
        paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        ATM Repair Job Card
      </div>

      <div style={{marginBottom:14}}>
        <label style={labelStyle}>Fault Category <span style={{color:C.danger}}>*</span></label>
        <select value={form.fault_category} onChange={e=>set("fault_category")(e.target.value)} style={inputStyle}>
          <option value="">Select fault category…</option>
          {["Card Reader","Cash Dispenser","GBNA","Receipt Printer","Network / Communication","Power / UPS","Software / Configuration","PIN Pad","Other"].map(category=><option key={category}>{category}</option>)}
        </select>
      </div>

      {/* Work description */}
      <div style={{marginBottom:14}}>
        <label style={{...labelStyle}}>Work Performed / Resolution <span style={{color:C.danger}}>*</span></label>
        <textarea value={form.work_description} onChange={e=>set("work_description")(e.target.value)}
          placeholder="Describe the work carried out and how the fault was resolved…" rows={4}
          style={{...inputStyle,resize:"vertical"}}/>
      </div>

      {/* Parts */}
      <div style={{marginBottom:14}}>
        <label style={{...labelStyle}}>Parts Used</label>
        <textarea value={form.parts_used} onChange={e=>set("parts_used")(e.target.value)}
          placeholder="List parts replaced…" rows={2}
          style={{...inputStyle,resize:"vertical"}}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div>
          <label style={labelStyle}>Status After Repair <span style={{color:C.danger}}>*</span></label>
          <select value={form.atm_status} onChange={e=>set("atm_status")(e.target.value)} style={inputStyle}>
            {VISIT_STATUS.map(status=><option key={status}>{status}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>CE Start Time <span style={{color:C.danger}}>*</span></label>
          <input type="time" value={form.start_time} onChange={e=>set("start_time")(e.target.value)} style={inputStyle}/>
        </div>
      </div>

      {/* Closed at — custom datetime */}
      <div style={{marginBottom:14}}>
        <label style={{...labelStyle}}>CE End Date & Time <span style={{color:C.danger}}>*</span></label>
        <div className="engineer-jobcard-now-field">
          <input type="datetime-local" value={form.closed_at}
            onChange={e=>set("closed_at")(e.target.value)} style={inputStyle}/>
          <button type="button" className="engineer-jobcard-now" onClick={()=>set("closed_at")(localDateTimeValue())}>Now</button>
        </div>
        {call.sla_breach_at&&(()=>{
          const sla = slaInfo(call);
          return sla?(
            <div style={{marginTop:6,background:sla.bg,borderRadius:8,padding:"6px 10px",
              fontSize:12,fontWeight:600,color:sla.color}}>
              ⏱ SLA: {sla.text} · Deadline: {new Date(call.sla_breach_at).toLocaleString("en-GB")}
            </div>
          ):null;
        })()}
      </div>

      <div style={{margin:"4px 0 14px",padding:12,border:`1px solid ${C.border}`,borderRadius:10}}>
        <label style={{display:"flex",alignItems:"flex-start",gap:10,fontSize:13,fontWeight:700,color:C.text}}>
          <input type="checkbox" checked={form.phone_support} onChange={e=>set("phone_support")(e.target.checked)} style={{marginTop:2}}/>
          Resolved via phone support (no custodian signature required)
        </label>
      </div>

      <div style={{display:"grid",gap:14,marginBottom:14}}>
        {!form.phone_support&&<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={labelStyle}>Custodian 1 name <span style={{color:C.danger}}>*</span></label>
              <input value={form.custodian1_name} onChange={e=>set("custodian1_name")(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Custodian 2 name (optional)</label>
              <input value={form.custodian2_name} onChange={e=>set("custodian2_name")(e.target.value)} style={inputStyle}/>
            </div>
          </div>
          <SignaturePad label="Custodian 1 signature *" value={form.custodian1_signature} onChange={set("custodian1_signature")}/>
          <SignaturePad label="Custodian 2 signature (optional)" value={form.custodian2_signature} onChange={set("custodian2_signature")}/>
        </>}
      </div>

      {/* Notes */}
      <div style={{marginBottom:14}}>
        <label style={{...labelStyle}}>Additional Notes</label>
        <textarea value={form.notes} onChange={e=>set("notes")(e.target.value)}
          placeholder="Any additional remarks…" rows={2}
          style={{...inputStyle,resize:"vertical"}}/>
      </div>

      {/* Files */}
      <div style={{marginBottom:20}}>
        <label style={{...labelStyle}}>Attachments ({files.length}/10)</label>
        <FileUpload files={files} onChange={setFiles2}/>
      </div>

      {/* Actions */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <Btn variant="primary" onClick={()=>submit(true)} disabled={saving} full>
          {saving?"Saving…":"✓ Close Call & Submit Job Card"}
        </Btn>
        <Btn variant="ghost" onClick={()=>submit(false)} disabled={saving} full>
          💾 Close Call & Save as Draft
        </Btn>
        <Btn variant="secondary" onClick={onClose} disabled={saving} full>Cancel</Btn>
      </div>
    </div>
  );
};

// ─── Calls Tab ────────────────────────────────────────────────────────────────
// ─── Inline Note Editor ──────────────────────────────────────────────────────
const NoteEditor = ({call, onSave}:{call:any; onSave:(id:number,note:string)=>void}) => {
  const [open,setOpen]   = useState(false);
  const [note,setNote]   = useState(call.notes ?? "");
  const [saving,setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(call.id, note);
    setSaving(false);
    setOpen(false);
  };

  if (!open) return (
    <button onClick={e=>{e.stopPropagation();setOpen(true);}} style={{
      background:"none",border:"1px dashed #cbd5e1",borderRadius:7,
      padding:"4px 10px",fontSize:11,fontWeight:600,color:"#64748b",
      cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
      📝 {call.notes ? "Edit note" : "Add note"}
    </button>
  );

  return (
    <div onClick={e=>e.stopPropagation()}
      style={{marginTop:8,background:"#f8fafc",borderRadius:10,padding:10,
        border:"1px solid #e2e8f0"}}>
      <textarea value={note} onChange={e=>setNote(e.target.value)}
        placeholder="Enter note (e.g. reason for hold, parts pending, update for admin)…"
        rows={3} style={{width:"100%",fontSize:12,borderRadius:8,padding:"8px 10px",
          border:"1px solid #cbd5e1",fontFamily:"inherit",resize:"vertical",
          outline:"none",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
        <button onClick={()=>{setNote(call.notes??"");setOpen(false);}} style={{
          background:"none",border:"1px solid #e2e8f0",borderRadius:7,padding:"5px 12px",
          fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#64748b"}}>
          Cancel
        </button>
        <button onClick={save} disabled={saving||!note.trim()} style={{
          background:"#1d6ef5",color:"#fff",border:"none",borderRadius:7,
          padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer",
          fontFamily:"inherit",opacity:saving?0.6:1}}>
          {saving?"Saving…":"Save Note"}
        </button>
      </div>
    </div>
  );
};

const CallsTab = ({atms, engineer, addToast, onCallAssignmentHandled}:any) => {
  const [calls,setCalls]   = useState<any[]>([]);
  const [loading,setLoading] = useState(true);
  const [filter,setFilter] = useState("open");
  const [selected,setSelected] = useState<any>(null);
  const [modal,setModal]   = useState<null|"detail"|"close">(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/engineer/calls",{
        headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest"},
        credentials:"same-origin",
      });
      const data = await res.json();
      setCalls(Array.isArray(data)?data:[]);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ load(); },[]);

  const returnCall = async (call:any) => {
    if (!confirm("Return this call to the pending pool? You will be unassigned.")) return;
    const res = await fetch(`/engineer/calls/${call.id}/return`,{
      method:"POST",
      headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest","X-XSRF-TOKEN":getCSRFCookie()},
      credentials:"same-origin",
    });
    if (res.ok) { addToast("Call returned to pending pool.","success"); load(); }
    else { const e=await res.json(); addToast(e.message||"Failed.","error"); }
  };

  const saveNote = async (callId:number, notes:string) => {
    const res = await fetch(`/engineer/calls/${callId}/note`,{
      method:"POST",
      headers:{Accept:"application/json","Content-Type":"application/json",
        "X-Requested-With":"XMLHttpRequest","X-XSRF-TOKEN":getCSRFCookie()},
      credentials:"same-origin",
      body:JSON.stringify({notes}),
    });
    if (res.ok) { addToast("Note saved.","success"); load(); }
    else { const e=await res.json(); addToast(e.message||"Failed to save note.","error"); }
  };

  const selfAssign = async (call:any) => {
    const res = await fetch(`/engineer/calls/${call.id}/assign`,{
      method:"POST",
      headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest","X-XSRF-TOKEN":getCSRFCookie()},
      credentials:"same-origin",
    });
    if (res.ok) {
      onCallAssignmentHandled(call.id);
      addToast("Call assigned to you.","success");
      load();
    }
    else { const e=await res.json(); addToast(e.message||"Failed.","error"); }
  };

  const isClosed = (s:string) => s==="resolved" || s==="escalated";
  const filtered = filter==="mine"
    ? calls.filter(c=>c.is_mine&&!isClosed(c.status))
    : calls.filter(c=>!isClosed(c.status));

  const [bannerDismissed,setBannerDismissed] = useState(false);
  const mineCount = calls.filter(c=>c.is_mine&&!isClosed(c.status)).length;
  const openCount = calls.filter(c=>!isClosed(c.status)).length;

  return (
    <div style={{padding:"16px 16px 24px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{margin:0,fontSize:18,fontWeight:800,color:C.text}}>Calls</h2>
          <div style={{fontSize:12,color:C.textMuted,marginTop:2}}>All open calls — you can self-assign and close</div>
        </div>
        <button onClick={load} style={{background:C.surface,border:`1px solid ${C.border}`,
          borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:600,color:C.textMid,
          cursor:"pointer",fontFamily:"inherit"}}>↻ Refresh</button>
      </div>

      {/* Mine alert — dismissible */}
      {mineCount>0&&!bannerDismissed&&(
        <div style={{background:C.primaryLight,border:"1px solid #bfdbfe",borderRadius:14,
          padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:C.primary}}>
              📞 {mineCount} call{mineCount>1?"s":""} assigned to you
            </div>
            <div style={{fontSize:12,color:C.primary,opacity:.8,marginTop:2}}>Tap "My Calls" to view</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setFilter("mine")} style={{background:C.primary,color:"#fff",border:"none",
              borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              My Calls
            </button>
            <button onClick={()=>setBannerDismissed(true)} style={{background:"none",border:"none",
              cursor:"pointer",color:C.primary,fontSize:18,lineHeight:1,padding:4,opacity:.7}}>×</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {[
          {id:"open",     label:`All Open (${openCount})`},
          {id:"mine",     label:`Mine (${mineCount})`},
        ].map((f:any)=>(
          <button key={f.id} onClick={()=>setFilter(f.id)} style={{
            padding:"7px 16px",borderRadius:20,border:filter===f.id?"none":`1px solid ${C.border}`,
            cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:filter===f.id?700:500,
            background:filter===f.id?C.primary:C.surface,
            color:filter===f.id?"#fff":C.textMid,flexShrink:0}}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Calls list */}
      {loading ? (
        <div style={{textAlign:"center",padding:"48px 0",color:C.textMuted}}>Loading calls…</div>
      ) : filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"48px 16px",color:C.textMuted}}>
          <div style={{fontSize:36,marginBottom:10}}>📭</div>
          <div style={{fontSize:14}}>No open calls</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map((call:any)=>(
            <div key={call.id} style={{...card,padding:14,
              borderLeft:`4px solid ${CALL_PRIORITY[call.priority].color}`,
              cursor:"pointer"}}
              onClick={()=>{setSelected(call);setModal("detail");}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
                    <span style={{fontWeight:800,fontSize:15,color:C.text,fontFamily:"monospace"}}>
                      {call.atm.terminal_id}
                    </span>
                    <span style={{background:C.primaryLight,color:C.primary,borderRadius:5,
                      padding:"2px 7px",fontSize:11,fontWeight:700}}>
                      {call.atm.bank.short_code}
                    </span>
                    <span style={{background:CALL_TYPE[call.call_type].bg,
                      color:CALL_TYPE[call.call_type].color,borderRadius:5,
                      padding:"2px 7px",fontSize:11,fontWeight:700}}>
                      {CALL_TYPE[call.call_type].label}
                    </span>
                    {call.is_mine&&(
                      <span style={{background:C.primaryLight,color:C.primary,borderRadius:5,
                        padding:"2px 7px",fontSize:11,fontWeight:700}}>👤 Mine</span>
                    )}
                  </div>
                  <div style={{fontSize:13,color:C.textMid,marginBottom:4}}>{call.atm.location}</div>
                  <div style={{fontSize:13,color:C.text,lineHeight:1.5}}>
                    {call.fault_description.length>80
                      ? call.fault_description.slice(0,80)+"…"
                      : call.fault_description}
                  </div>
                  {call.notes&&(
                    <div style={{marginTop:5,background:"#fefce8",borderLeft:"3px solid #eab308",
                      borderRadius:"0 6px 6px 0",padding:"5px 10px",fontSize:12,color:"#713f12"}}>
                      📝 {call.notes}
                    </div>
                  )}
                  {!isClosed(call.status)&&(
                    <div style={{marginTop:6}}>
                      <NoteEditor call={call} onSave={saveNote}/>
                    </div>
                  )}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                  <span style={{background:CALL_PRIORITY[call.priority].bg,
                    color:CALL_PRIORITY[call.priority].color,
                    borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                    {CALL_PRIORITY[call.priority].label}
                  </span>
                  <span style={{background:CALL_STATUS[call.status].bg,
                    color:CALL_STATUS[call.status].color,
                    borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                    {CALL_STATUS[call.status].label}
                  </span>
                  {(()=>{const s=slaInfo(call);return s?(<span style={{background:s.bg,color:s.color,borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700}}>⏱ {s.text}</span>):null;})()}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                marginTop:10,paddingTop:8,borderTop:`1px solid ${C.surface}`,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:12}}>
                  <span style={{fontSize:12,color:C.textMuted}}>#{call.id}</span>
                  <span style={{fontSize:12,color:C.textMuted}}>{fmt(call.created_at)}</span>
                  <span style={{fontSize:12,color:call.engineer?C.textMid:C.danger,fontWeight:call.engineer?400:600}}>
                    {call.engineer?`👷 ${call.engineer.name}`:"⚠ Unassigned"}
                  </span>
                </div>
                <div style={{display:"flex",gap:8}} onClick={e=>e.stopPropagation()}>
                  {!call.engineer&&call.status==="pending"&&(
                    <button onClick={()=>selfAssign(call)} style={{
                      background:C.primary,color:"#fff",border:"none",borderRadius:8,
                      padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer",
                      fontFamily:"inherit"}}>
                      + Take Call
                    </button>
                  )}
                  {(call.is_mine||!call.engineer)&&call.status!=="resolved"&&(
                    <button onClick={()=>{setSelected(call);setModal("close");}} style={{
                      background:C.successLight,color:C.success,border:"1px solid #bbf7d0",
                      borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,
                      cursor:"pointer",fontFamily:"inherit"}}>
                      ✓ Close Call
                    </button>
                  )}
                  {call.is_mine&&call.status!=="resolved"&&(
                    <button onClick={()=>returnCall(call)} style={{
                      background:"#fff7ed",color:"#ea580c",border:"1px solid #fed7aa",
                      borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,
                      cursor:"pointer",fontFamily:"inherit"}}>
                      ↩ Return
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {modal==="detail"&&selected&&(
        <Modal title={`Call #${selected.id}`}
          subtitle={`${selected.atm.terminal_id} · ${selected.atm.location}`}
          onClose={()=>setModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:14,paddingBottom:8}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <span style={{background:CALL_PRIORITY[selected.priority].bg,color:CALL_PRIORITY[selected.priority].color,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700}}>{CALL_PRIORITY[selected.priority].label}</span>
              <span style={{background:CALL_STATUS[selected.status].bg,color:CALL_STATUS[selected.status].color,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700}}>{CALL_STATUS[selected.status].label}</span>
              <span style={{background:CALL_TYPE[selected.call_type].bg,color:CALL_TYPE[selected.call_type].color,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700}}>{CALL_TYPE[selected.call_type].label}</span>
            </div>
            <div style={{background:C.surface,borderRadius:12,padding:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[["ATM",selected.atm.terminal_id],["Bank",selected.atm.bank.name],["Location",selected.atm.location],["Opened",fmt(selected.created_at)],["Assigned to",selected.engineer?.name??"Unassigned"],["Job Cards",String(selected.job_cards_count)]].map(([k,v])=>(
                <div key={k}>
                  <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em"}}>{k}</div>
                  <div style={{fontSize:14,fontWeight:600,color:C.text,marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>Fault</div>
              <div style={{background:C.surface,borderRadius:10,padding:"12px 14px",fontSize:14,color:C.text,lineHeight:1.7}}>{selected.fault_description}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {!selected.engineer&&selected.status==="pending"&&(
                <Btn variant="primary" onClick={()=>{selfAssign(selected);setModal(null);}} full>+ Take This Call</Btn>
              )}
              {(selected.is_mine||!selected.engineer)&&selected.status!=="resolved"&&(
                <Btn variant="success" onClick={()=>setModal("close")} full>✓ Close Call</Btn>
              )}
              <Btn variant="secondary" onClick={()=>setModal(null)} full>Close</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Close Call Form Modal */}
      {modal==="close"&&selected&&(
        <Modal title={`Close Call #${selected.id}`}
          subtitle="Enter resolution details and submit a job card"
          onClose={()=>setModal(null)}>
          <CloseCallForm
            call={selected}
            onClose={()=>setModal(null)}
            onSaved={()=>{
              setModal(null);
              addToast("Call closed and job card created!","success");
              load();
            }}
          />
        </Modal>
      )}
    </div>
  );
};


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
  const [modal,setModal]           = useState<null|"detail"|"drawer">(null);
  const [profileOpen,setProfileOpen] = useState(false);
  const [passModalOpen,setPassModalOpen] = useState(false);
  const [detailCard,setDetail]     = useState<JobCard|null>(null);
  const [toasts,setToasts]     = useState<any[]>([]);
  const [assignedCallCount,setAssignedCallCount] = useState(0);
  const seenAssignedCallsRef = useRef<Set<number>|null>(null);
  const handledCallAssignmentsRef = useRef(new Set<number>());
  const [logAtmId,setLogAtmId] = useState<number|null>(null);
  const [logType,setLogType]   = useState("Quarterly PM");

  const addToast = useCallback((message:string,type:string="success")=>{
    setToasts(t=>[...t,{id:Date.now(),message,type}]);
  },[]);

  const markCallAssignmentHandled = useCallback((callId:number)=>{
    handledCallAssignmentsRef.current.add(callId);
  },[]);

  useEffect(()=>{
    let checking = false;
    const checkAssignedCalls = async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch("/engineer/calls",{
          headers:{Accept:"application/json","X-Requested-With":"XMLHttpRequest"},
          credentials:"same-origin",
          cache:"no-store",
        });
        if (!response.ok) throw new Error(`Call check failed (${response.status})`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Call check returned an unexpected response");

        const assignedCalls = data.filter(call =>
          call.is_mine && call.status !== "resolved" && call.status !== "escalated"
        );
        const currentIds = new Set<number>(assignedCalls.map(call=>call.id));
        const previousIds = seenAssignedCallsRef.current;
        if (previousIds) {
          assignedCalls
            .filter(call=>!previousIds.has(call.id)&&!handledCallAssignmentsRef.current.has(call.id))
            .forEach(call=>addToast(
              `New call assigned: ${call.atm?.terminal_id ?? "ATM"} (${call.priority} priority).`,
              "info",
            ));
        }
        assignedCalls.forEach(call=>handledCallAssignmentsRef.current.delete(call.id));
        seenAssignedCallsRef.current = currentIds;
        setAssignedCallCount(currentIds.size);
      } catch (error) {
        console.error("Unable to check for newly assigned calls.",error);
      } finally {
        checking = false;
      }
    };

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void checkAssignedCalls();
    };
    void checkAssignedCalls();
    const interval = window.setInterval(checkWhenVisible,30_000);
    window.addEventListener("focus",checkWhenVisible);
    document.addEventListener("visibilitychange",checkWhenVisible);
    return ()=>{
      window.clearInterval(interval);
      window.removeEventListener("focus",checkWhenVisible);
      document.removeEventListener("visibilitychange",checkWhenVisible);
    };
  },[addToast]);

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
            {t.id==="calls"&&assignedCallCount>0&&(
              <span style={{minWidth:18,height:18,padding:"0 5px",borderRadius:9,
                display:"inline-flex",alignItems:"center",justifyContent:"center",
                background:C.danger,color:"#fff",fontSize:10,fontWeight:800}}>
                {assignedCallCount>99?"99+":assignedCallCount}
              </span>
            )}
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
              <div style={{position:"relative"}}>
                <button onClick={()=>setProfileOpen(o=>!o)} style={{
                  display:"flex",alignItems:"center",gap:8,
                  border:`1px solid ${profileOpen?C.primary:C.border}`,
                  borderRadius:20,padding:"5px 12px 5px 6px",
                  background:"none",cursor:"pointer",fontFamily:"inherit",transition:"border-color .15s",
                }}>
                  <div style={{width:28,height:28,borderRadius:14,background:C.primaryLight,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:800,color:C.primary}}>{initials}</div>
                  <span style={{fontSize:13,fontWeight:600,color:C.text}}>{engineer.name}</span>
                  <span style={{fontSize:9,color:C.textMuted}}>{profileOpen?"▲":"▼"}</span>
                </button>
                {profileOpen&&(
                  <>
                    <div style={{position:"fixed",inset:0,zIndex:199}} onClick={()=>setProfileOpen(false)}/>
                    <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",
                      background:C.white,border:`1px solid ${C.border}`,borderRadius:16,
                      boxShadow:"0 8px 24px rgba(0,0,0,.10)",minWidth:240,zIndex:200,overflow:"hidden"}}>
                      <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`,
                        background:C.surface,display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:44,height:44,borderRadius:22,background:C.primaryLight,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:16,fontWeight:800,color:C.primary,flexShrink:0}}>{initials}</div>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:C.text}}>{engineer.name}</div>
                          <div style={{fontSize:12,color:C.textMuted,marginTop:1}}>{engineer.region} Region</div>
                          <div style={{marginTop:5,display:"inline-flex",background:C.primaryLight,borderRadius:999,padding:"2px 10px"}}>
                            <span style={{fontSize:10,fontWeight:700,color:C.primary}}>Field Engineer</span>
                          </div>
                        </div>
                      </div>
                      <div style={{padding:"6px 0"}}>
                        {[{icon:"✉️",label:engineer.email||"—"},{icon:"📞",label:engineer.phone||"—"}].map(({icon,label})=>(
                          <div key={label} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 18px",fontSize:13,color:C.textMid}}>
                            <span>{icon}</span><span>{label}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{borderTop:`1px solid ${C.border}`,padding:8}}>
                        <button onClick={()=>{setProfileOpen(false); setPassModalOpen(true);}}
                          style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                            borderRadius:8,border:"none",background:"none",cursor:"pointer",
                            fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.textMid}}>
                          <span>🔑</span> Change Password
                        </button>
                        <button onClick={()=>{if(confirm("Sign out?"))router.post("/logout");}}
                          style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                            borderRadius:8,border:"none",background:"none",cursor:"pointer",
                            fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.danger}}>
                          <span>🚪</span> Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
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
          {/* Avatar — opens profile dropdown */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setProfileOpen(o=>!o)} style={{
              width:32,height:32,borderRadius:16,background:C.primaryLight,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:12,fontWeight:800,color:C.primary,
              border:`2px solid ${profileOpen?C.primary:"transparent"}`,cursor:"pointer",
            }}>{initials}</button>
            {profileOpen&&(
              <>
                <div style={{position:"fixed",inset:0,zIndex:199}} onClick={()=>setProfileOpen(false)}/>
                <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",
                  background:C.white,border:`1px solid ${C.border}`,borderRadius:16,
                  boxShadow:"0 8px 24px rgba(0,0,0,.10)",minWidth:220,zIndex:200,overflow:"hidden"}}>
                  <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,
                    background:C.surface,display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:40,height:40,borderRadius:20,background:C.primaryLight,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:14,fontWeight:800,color:C.primary,flexShrink:0}}>{initials}</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{engineer.name}</div>
                      <div style={{fontSize:11,color:C.textMuted}}>{engineer.region} Region</div>
                      <div style={{marginTop:4,display:"inline-flex",background:C.primaryLight,borderRadius:999,padding:"1px 8px"}}>
                        <span style={{fontSize:10,fontWeight:700,color:C.primary}}>Field Engineer</span>
                      </div>
                    </div>
                  </div>
                  <div style={{padding:"6px 0"}}>
                    {[{icon:"✉️",label:engineer.email||"—"},{icon:"📞",label:engineer.phone||"—"}].map(({icon,label})=>(
                      <div key={label} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 16px",fontSize:12,color:C.textMid}}>
                        <span>{icon}</span><span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{borderTop:`1px solid ${C.border}`,padding:8}}>
                    <button onClick={()=>{if(confirm("Sign out?"))router.post("/logout");}}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                        borderRadius:8,border:"none",background:"none",cursor:"pointer",
                        fontFamily:"inherit",fontSize:13,fontWeight:600,color:C.danger}}>
                      <span>🚪</span> Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
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
        <div style={{paddingBottom:isMobile?96:0}}>
          {tab==="home"    && <HomeTab    engineer={engineer} atms={atms} jobCards={jobCards} pmRecords={pmRecords} currentQuarter={currentQuarter} currentYear={currentYear}/>}
          {tab==="pm"      && <PMTab      pmRecords={pmRecords} currentQuarter={currentQuarter} currentYear={currentYear} onLogJobCard={openLog}/>}
          {tab==="log"     && <LogTab     atms={atms} initialAtmId={logAtmId} onSave={(submitted:boolean)=>{ addToast(submitted?"Submitted for review!":"Saved as draft.","success"); router.reload(); setTab("cards"); }}/>}
          {tab==="cards"   && <CardsTab   jobCards={jobCards} onView={(c:JobCard)=>{setDetail(c);setModal("detail");}}/>}
          {tab==="profile" && <ProfileTab engineer={engineer} addToast={addToast} onPassClick={()=>setPassModalOpen(true)}/>}
          {tab==="calls"   && <CallsTab atms={atms} engineer={engineer} addToast={addToast} onCallAssignmentHandled={markCallAssignmentHandled}/>}
        </div>

        {/* ── FLOATING MOBILE BOTTOM NAV ── */}
        {isMobile&&(
          <div style={{
            position:"fixed", bottom:16, left:"50%",
            transform:"translateX(-50%)",
            zIndex:100,
            display:"flex",
            background:"rgba(255,255,255,0.82)",
            backdropFilter:"blur(20px)",
            WebkitBackdropFilter:"blur(20px)",
            borderRadius:32,
            border:"1px solid rgba(255,255,255,0.6)",
            boxShadow:"0 8px 32px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.08)",
            padding:"6px 6px",
            gap:2,
          }}>
            {TABS.map((t:any)=>{
              const active = tab===t.id;
              return (
                <button key={t.id} onClick={()=>setTab(t.id)} style={{
                  display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", gap:3,
                  border:"none", cursor:"pointer", fontFamily:"inherit",
                  padding: active ? "8px 18px" : "8px 14px",
                  borderRadius:26,
                  background: active ? C.primary : "transparent",
                  transition:"all .22s cubic-bezier(.34,1.56,.64,1)",
                  minWidth: active ? 72 : 48,
                  position:"relative",
                }}>
                  {t.id==="calls"&&assignedCallCount>0&&(
                    <span style={{position:"absolute",top:1,right:2,minWidth:16,height:16,
                      padding:"0 4px",borderRadius:8,display:"inline-flex",
                      alignItems:"center",justifyContent:"center",background:C.danger,
                      color:"#fff",fontSize:9,fontWeight:800,lineHeight:1}}>
                      {assignedCallCount>99?"99+":assignedCallCount}
                    </span>
                  )}
                  <span style={{
                    fontSize:19, lineHeight:1,
                    filter: active ? "brightness(10)" : "none",
                    transition:"filter .2s",
                  }}>{t.icon}</span>
                  {active && (
                    <span style={{
                      fontSize:10, fontWeight:700,
                      color:"#fff",
                      lineHeight:1,
                      maxWidth:64,
                      overflow:"hidden",
                      whiteSpace:"nowrap",
                      textOverflow:"ellipsis",
                    }}>{t.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

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
        
        {/* ── CHANGE PASSWORD MODAL ── */}
        {passModalOpen&&<ChangePasswordModal onClose={()=>setPassModalOpen(false)}/>}
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
