import { C, PAGE_SIZE } from "../constants";
import type { BtnVariant } from "../types";

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps { label: string; color: string; bg: string; }
export const Badge = ({ label, color, bg }: BadgeProps) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: "2px 10px", borderRadius: 20,
    fontSize: 12, fontWeight: 600, color, background: bg,
  }}>{label}</span>
);

// ─── Btn ──────────────────────────────────────────────────────────────────────

interface BtnProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  small?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}
export const Btn = ({ children, onClick, variant = "primary", small, disabled, type = "button" }: BtnProps) => {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 8, fontFamily: "inherit", fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", border: "none", outline: "none",
    transition: "all .15s", fontSize: small ? 13 : 14,
    padding: small ? "6px 14px" : "9px 20px", opacity: disabled ? 0.5 : 1,
  };
  const styles: Record<BtnVariant, React.CSSProperties> = {
    primary:   { background: C.accent,    color: "#fff",        boxShadow: "0 1px 3px rgba(29,110,245,.3)" },
    secondary: { background: C.surface,   color: C.text,        border: `1px solid ${C.border}` },
    ghost:     { background: "transparent", color: C.textMid },
    danger:    { background: C.redLight,  color: C.red,         border: "1px solid #fecaca" },
    teal:      { background: C.tealLight, color: C.teal,        border: `1px solid ${C.teal}33` },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...styles[variant] }}>
      {children}
    </button>
  );
};

// ─── Input ────────────────────────────────────────────────────────────────────

interface SelectOption { value: string | number; label: string; }
interface InputProps {
  label?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  options?: (string | SelectOption)[];
  rows?: number;
}
export const Input = ({ label, value, onChange, placeholder, type = "text", required, options, rows }: InputProps) => {
  const fs: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit",
    color: C.text, background: "#fff", outline: "none", boxSizing: "border-box",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>
          {label}{required && <span style={{ color: C.red }}> *</span>}
        </label>
      )}
      {options ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            ...fs, appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b909a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32,
          }}
        >
          <option value="">— Select —</option>
          {options.map(o => {
            const val = typeof o === "object" ? o.value : o;
            const lbl = typeof o === "object" ? o.label : o;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
      ) : rows ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={{ ...fs, resize: "vertical" }}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={fs}
        />
      )}
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}
export const Modal = ({ title, subtitle, onClose, children, width = 560 }: ModalProps) => (
  <div
    style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
      backdropFilter: "blur(4px)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}
    onClick={onClose}
  >
    <div
      style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: width,
        boxShadow: C.shadowMd, maxHeight: "92vh", overflowY: "auto",
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px 0" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>{title}</h2>
          {subtitle && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 22, color: C.textMuted, lineHeight: 1, padding: 4, marginLeft: 12,
        }}>×</button>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  hoverable?: boolean;
  className?: string;
}
export const Card = ({ children, style, hoverable, className = "" }: CardProps) => (
  <div
    className={`${hoverable ? "card-hover" : "card"} ${className}`}
    style={{
      background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`,
      boxShadow: C.shadow, transition: "all .22s cubic-bezier(.4,0,.2,1)", ...style,
    }}
  >
    {children}
  </div>
);

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
  icon?: string;
}
export const StatCard = ({ label, value, sub, color = C.accent, icon }: StatCardProps) => (
  <div
    className="stat-card"
    style={{
      background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`,
      boxShadow: C.shadow, padding: "20px 24px", flex: 1, minWidth: 140,
      transition: "all .22s cubic-bezier(.4,0,.2,1)", cursor: "default",
      position: "relative", overflow: "hidden",
    }}
  >
    <div className="stat-card-shine" />
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
      <div>
        <div className="stat-card-value" style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, transition: "transform .22s cubic-bezier(.4,0,.2,1)" }}>{value}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid, marginTop: 6 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
      {icon && (
        <div
          className="stat-card-icon"
          style={{ fontSize: 28, opacity: 0.18, transition: "all .3s cubic-bezier(.4,0,.2,1)", transform: "scale(1)", position: "absolute", right: 20, top: "50%", marginTop: -14 }}
        >{icon}</div>
      )}
    </div>
  </div>
);

// ─── EmptyState ───────────────────────────────────────────────────────────────

export const EmptyState = ({ message }: { message: string }) => (
  <div style={{ textAlign: "center", padding: "48px 24px", color: C.textMuted }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
    <div style={{ fontSize: 15 }}>{message}</div>
  </div>
);

// ─── Confirm ──────────────────────────────────────────────────────────────────

interface ConfirmProps { message: string; onConfirm: () => void; onCancel: () => void; }
export const Confirm = ({ message, onConfirm, onCancel }: ConfirmProps) => (
  <Modal title="Confirm Action" onClose={onCancel} width={420}>
    <p style={{ color: C.textMid, margin: "0 0 24px", lineHeight: 1.6 }}>{message}</p>
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
      <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
      <Btn variant="danger" onClick={onConfirm}>Confirm</Btn>
    </div>
  </Modal>
);

// ─── Checkbox ─────────────────────────────────────────────────────────────────

interface CheckboxProps { checked: boolean; indeterminate?: boolean; onChange: (checked: boolean) => void; }
export const Checkbox = ({ checked, indeterminate, onChange }: CheckboxProps) => (
  <input
    type="checkbox"
    checked={checked}
    ref={el => { if (el) el.indeterminate = !!indeterminate; }}
    onChange={e => onChange(e.target.checked)}
    style={{ width: 16, height: 16, accentColor: C.accent, cursor: "pointer" }}
  />
);

// ─── BulkBar ──────────────────────────────────────────────────────────────────

interface BulkAction { label: string; icon: string; variant?: BtnVariant; onClick: () => void; }
interface BulkBarProps { count: number; actions: BulkAction[]; onClear: () => void; }
export const BulkBar = ({ count, actions, onClear }: BulkBarProps) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 12,
    background: C.accentLight, border: `1.5px solid ${C.accent}44`,
    borderRadius: 10, padding: "10px 16px", flexWrap: "wrap",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 13, background: C.accent, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
      }}>{count}</div>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>
        {count === 1 ? "1 item selected" : `${count} items selected`}
      </span>
    </div>
    <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
      {actions.map(a => (
        <Btn key={a.label} small variant={a.variant ?? "secondary"} onClick={a.onClick}>
          {a.icon} {a.label}
        </Btn>
      ))}
    </div>
    <Btn small variant="ghost" onClick={onClear}>✕ Clear</Btn>
  </div>
);

// ─── Paginator ────────────────────────────────────────────────────────────────

interface PaginatorProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  setPage: (updater: number | ((p: number) => number)) => void;
}
export const Paginator = ({ page, totalPages, total, pageSize, setPage }: PaginatorProps) => {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  // Build page number list with ellipsis
  const show = new Set(
    [1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages)
  );
  const sorted = [...show].sort((a, b) => a - b);
  const pages: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) pages.push("…");
    pages.push(p);
    prev = p;
  }

  const btnBase: React.CSSProperties = {
    borderRadius: 7, border: `1px solid ${C.border}`,
    background: "#fff", cursor: "pointer",
    color: C.text, fontSize: 13, fontFamily: "inherit",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px", borderTop: `1px solid ${C.border}`,
      flexWrap: "wrap", gap: 8,
    }}>
      <span style={{ fontSize: 13, color: C.textMuted }}>
        Showing <b style={{ color: C.text }}>{from}–{to}</b> of <b style={{ color: C.text }}>{total}</b>
      </span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{ ...btnBase, padding: "5px 10px", opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? "not-allowed" : "pointer" }}
        >‹</button>

        {pages.map((p, i) =>
          p === "…"
            ? <span key={"e" + i} style={{ padding: "0 4px", color: C.textMuted, fontSize: 13 }}>…</span>
            : <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  ...btnBase,
                  width: 32, height: 32, padding: 0,
                  border: `1.5px solid ${p === page ? C.accent : C.border}`,
                  background: p === page ? C.accent : "#fff",
                  color: p === page ? "#fff" : C.text,
                  fontWeight: p === page ? 700 : 400,
                }}
              >{p}</button>
        )}

        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{ ...btnBase, padding: "5px 10px", opacity: page === totalPages ? 0.5 : 1, cursor: page === totalPages ? "not-allowed" : "pointer" }}
        >›</button>
      </div>
    </div>
  );
};
