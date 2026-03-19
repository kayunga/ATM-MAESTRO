import { useState, FormEvent } from "react";
import { router } from "@inertiajs/react";

export default function Login({ errors }: { errors?: { email?: string; password?: string } }) {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [remember, setRemember]   = useState(false);
  const [processing, setProcessing] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    router.post("/login", { email, password, remember }, {
      onFinish: () => setProcessing(false),
    });
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logoBox}>🏧</div>
          <div style={s.appName}>NCR Fleet</div>
          <div style={s.appSub}>ATM MANAGER · ENGINEER PORTAL</div>
        </div>

        <h1 style={s.title}>Sign In</h1>
        <p style={s.subtitle}>Access your admin or engineer portal.</p>

        <form onSubmit={submit} style={s.form}>
          {/* Email */}
          <div style={s.field}>
            <label style={s.label}>Email address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@techmasters.zm" required autoFocus
              style={{ ...s.input, ...(errors?.email ? s.inputError : {}) }}
            />
            {errors?.email && <span style={s.error}>{errors.email}</span>}
          </div>

          {/* Password */}
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{ ...s.input, ...(errors?.password ? s.inputError : {}) }}
            />
            {errors?.password && <span style={s.error}>{errors.password}</span>}
          </div>

          {/* Remember */}
          <div style={s.rememberRow}>
            <label style={s.rememberLabel}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                style={{ marginRight: 8, accentColor: "#1d6ef5" }}/>
              Remember me
            </label>
          </div>

          <button type="submit" disabled={processing} style={{
            ...s.btn, ...(processing ? s.btnDisabled : {}),
          }}>
            {processing ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Role hint */}
        <div style={s.hint}>
          <span style={s.hintIcon}>ℹ️</span>
          <span>Admins go to the fleet dashboard. Engineers go to the job card portal. Your role is detected automatically.</span>
        </div>

        <p style={s.footer}>NCR Fleet · Techmasters Zambia</p>
      </div>
    </div>
  );
}

const C = {
  primary:"#1d6ef5", primaryLight:"#eef3fe", danger:"#ef4444", dangerLight:"#fef2f2",
  text:"#1a1d23", textMid:"#4b5260", textMuted:"#8b909a", border:"#e8eaed", surface:"#f8f9fb",
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight:"100vh", fontFamily:"'DM Sans',system-ui,sans-serif",
    background:`linear-gradient(135deg,${C.primaryLight} 0%,${C.surface} 55%,${C.primaryLight} 100%)`,
    display:"flex", alignItems:"center", justifyContent:"center", padding:24,
  },
  card: {
    background:"#fff", borderRadius:20, border:`1px solid ${C.border}`,
    boxShadow:"0 8px 32px rgba(0,0,0,.08)", padding:"40px 36px",
    width:"100%", maxWidth:420,
  },
  logoWrap: { display:"flex", flexDirection:"column", alignItems:"center", marginBottom:28 },
  logoBox:  {
    width:56, height:56, borderRadius:14, background:C.primary,
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:26, marginBottom:10,
  },
  appName: { fontSize:18, fontWeight:800, color:C.text, lineHeight:1.1 },
  appSub:  { fontSize:10, fontWeight:600, color:C.textMuted, letterSpacing:"0.08em", marginTop:3 },
  title:   { margin:"0 0 6px", fontSize:22, fontWeight:800, color:C.text, textAlign:"center" },
  subtitle:{ margin:"0 0 24px", fontSize:13, color:C.textMuted, textAlign:"center" },
  form:    { display:"flex", flexDirection:"column" },
  field:   { display:"flex", flexDirection:"column", marginBottom:16 },
  label:   { fontSize:13, fontWeight:600, color:C.textMid, marginBottom:6 },
  input:   {
    padding:"11px 14px", borderRadius:10, border:`1.5px solid ${C.border}`,
    fontSize:14, fontFamily:"inherit", color:C.text, background:C.surface, outline:"none",
  },
  inputError: { borderColor:C.danger, background:C.dangerLight },
  error:   { fontSize:12, color:C.danger, marginTop:5, fontWeight:500 },
  rememberRow: { marginBottom:20 },
  rememberLabel: {
    display:"flex", alignItems:"center", fontSize:13, color:C.textMid,
    cursor:"pointer", userSelect:"none",
  },
  btn: {
    background:C.primary, color:"#fff", border:"none", borderRadius:10,
    padding:"13px 20px", fontSize:15, fontWeight:700, fontFamily:"inherit",
    cursor:"pointer", width:"100%", boxShadow:"0 2px 8px rgba(29,110,245,.25)",
  },
  btnDisabled: { opacity:0.6, cursor:"not-allowed" },
  hint: {
    display:"flex", gap:8, alignItems:"flex-start", marginTop:20,
    background:C.primaryLight, borderRadius:10, padding:"12px 14px",
    fontSize:12, color:C.textMid, lineHeight:1.5,
  },
  hintIcon: { fontSize:14, flexShrink:0 },
  footer: { textAlign:"center", fontSize:12, color:C.textMuted, marginTop:20, marginBottom:0 },
};

Login.layout = (page: any) => page;
