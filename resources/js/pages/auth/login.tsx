import { useState, FormEvent } from "react";
import { router } from "@inertiajs/react";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors]     = useState<{ email?: string; password?: string }>({});
  const [processing, setProcessing] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    router.post("/login", { email, password, remember }, {
      onError:  (e) => { setErrors(e); setProcessing(false); },
      onFinish: ()  => setProcessing(false),
    });
  };

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logoBox}>🏧</div>
          <div style={s.logoText}>NCR Fleet</div>
          <div style={s.logoSub}>ATM MANAGER</div>
        </div>

        <h1 style={s.title}>Sign In</h1>
        <p style={s.sub}>Use your credentials to access the fleet manager or engineer portal.</p>

        <form onSubmit={submit} style={s.form}>

          {/* Email */}
          <div style={s.field}>
            <label style={s.label}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@techmasters.zm"
              required
              autoFocus
              style={{ ...s.input, ...(errors.email ? s.inputError : {}) }}
            />
            {errors.email && <span style={s.error}>{errors.email}</span>}
          </div>

          {/* Password */}
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ ...s.input, ...(errors.password ? s.inputError : {}) }}
            />
            {errors.password && <span style={s.error}>{errors.password}</span>}
          </div>

          {/* Remember me */}
          <div style={s.rememberRow}>
            <label style={s.rememberLabel}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={{ marginRight: 8, accentColor: "#1d6ef5" }}
              />
              Remember me
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={processing}
            style={{ ...s.btn, ...(processing ? s.btnDisabled : {}) }}
          >
            {processing ? "Signing in…" : "Sign In"}
          </button>

        </form>

        <p style={s.footer}>NCR Fleet · Techmasters Zambia</p>
        <p style={{...s.footer, marginTop:8, fontSize:11}}>Admins → dashboard &nbsp;·&nbsp; Engineers → portal</p>
      </div>
    </div>
  );
}

const C = {
  primary:     "#1d6ef5",
  primaryLight:"#eef3fe",
  text:        "#1a1d23",
  textMid:     "#4b5260",
  textMuted:   "#8b909a",
  border:      "#e8eaed",
  surface:     "#f8f9fb",
  danger:      "#ef4444",
  dangerLight: "#fef2f2",
  white:       "#ffffff",
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #eef3fe 0%, #f8f9fb 50%, #eef3fe 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  card: {
    background: C.white,
    borderRadius: 20,
    border: `1px solid ${C.border}`,
    boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
    padding: "40px 36px",
    width: "100%",
    maxWidth: 420,
  },
  logoWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 28,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: C.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    marginBottom: 10,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 800,
    color: C.text,
    lineHeight: 1.1,
  },
  logoSub: {
    fontSize: 10,
    fontWeight: 600,
    color: C.textMuted,
    letterSpacing: "0.1em",
    marginTop: 2,
  },
  title: {
    margin: "0 0 6px",
    fontSize: 22,
    fontWeight: 800,
    color: C.text,
    textAlign: "center",
  },
  sub: {
    margin: "0 0 28px",
    fontSize: 14,
    color: C.textMuted,
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: C.textMid,
    marginBottom: 6,
  },
  input: {
    padding: "11px 14px",
    borderRadius: 10,
    border: `1.5px solid ${C.border}`,
    fontSize: 14,
    fontFamily: "inherit",
    color: C.text,
    background: C.surface,
    outline: "none",
    transition: "border-color .15s",
  },
  inputError: {
    borderColor: C.danger,
    background: C.dangerLight,
  },
  error: {
    fontSize: 12,
    color: C.danger,
    marginTop: 5,
    fontWeight: 500,
  },
  rememberRow: {
    marginBottom: 22,
  },
  rememberLabel: {
    display: "flex",
    alignItems: "center",
    fontSize: 13,
    color: C.textMid,
    cursor: "pointer",
    userSelect: "none",
  },
  btn: {
    background: C.primary,
    color: C.white,
    border: "none",
    borderRadius: 10,
    padding: "13px 20px",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    width: "100%",
    transition: "all .15s",
    boxShadow: "0 2px 8px rgba(29,110,245,0.25)",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: C.textMuted,
    marginTop: 28,
    marginBottom: 0,
  },
};
