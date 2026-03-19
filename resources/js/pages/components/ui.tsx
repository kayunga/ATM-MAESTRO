import { C, PAGE_SIZE } from "../constants";
import type { BtnVariant } from "../types";

// ─── Badge ────────────────────────────────────────────────────────────────────
interface BadgeProps { label: string; color: string; bg: string; }
export const Badge = ({ label, color, bg }: BadgeProps) => (
  <span className="badge" style={{ color, background: bg }}>{label}</span>
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
export const Btn = ({ children, onClick, variant = "primary", small, disabled, type = "button" }: BtnProps) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={["btn", `btn--${variant}`, small ? "btn--small" : "", disabled ? "btn--disabled" : ""].filter(Boolean).join(" ")}
  >{children}</button>
);

// ─── Input ────────────────────────────────────────────────────────────────────
interface SelectOption { value: string | number; label: string; }
interface InputProps {
  label?: string; value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
  options?: (string | SelectOption)[]; rows?: number;
}
export const Input = ({ label, value, onChange, placeholder, type = "text", required, options, rows }: InputProps) => (
  <div className="field-wrap">
    {label && <label className="field-label">{label}{required && <span className="field-required"> *</span>}</label>}
    {options ? (
      <select value={value} onChange={e => onChange(e.target.value)} className="field-control field-select">
        <option value="">— Select —</option>
        {options.map(o => { const val = typeof o === "object" ? o.value : o; const lbl = typeof o === "object" ? o.label : o; return <option key={val} value={val}>{lbl}</option>; })}
      </select>
    ) : rows ? (
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="field-control field-textarea"/>
    ) : (
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} className="field-control"/>
    )}
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; width?: number; }
export const Modal = ({ title, subtitle, onClose, children, width = 560 }: ModalProps) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-box" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <div>
          <h2 className="modal-title">{title}</h2>
          {subtitle && <div className="modal-subtitle">{subtitle}</div>}
        </div>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
);

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps { children: React.ReactNode; style?: React.CSSProperties; hoverable?: boolean; className?: string; }
export const Card = ({ children, style, hoverable, className = "" }: CardProps) => (
  <div className={`${hoverable ? "card-hover" : "card"} ${className}`} style={style}>{children}</div>
);

// ─── StatCard ─────────────────────────────────────────────────────────────────
interface StatCardProps { label: string; value: number | string; sub?: string; color?: string; icon?: string; }
export const StatCard = ({ label, value, sub, color = C.accent, icon }: StatCardProps) => (
  <div className="stat-card">
    <div className="stat-card__shine"/>
    <div className="stat-card__inner">
      <div>
        <div className="stat-card__value" style={{ color }}>{value}</div>
        <div className="stat-card__label">{label}</div>
        {sub && <div className="stat-card__sub">{sub}</div>}
      </div>
      {icon && <div className="stat-card__icon">{icon}</div>}
    </div>
  </div>
);

// ─── EmptyState ───────────────────────────────────────────────────────────────
export const EmptyState = ({ message }: { message: string }) => (
  <div className="empty-state">
    <div className="empty-state__icon">📭</div>
    <div className="empty-state__msg">{message}</div>
  </div>
);

// ─── Confirm ──────────────────────────────────────────────────────────────────
interface ConfirmProps { message: string; onConfirm: () => void; onCancel: () => void; }
export const Confirm = ({ message, onConfirm, onCancel }: ConfirmProps) => (
  <Modal title="Confirm Action" onClose={onCancel} width={420}>
    <p className="confirm-message">{message}</p>
    <div className="confirm-actions">
      <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
      <Btn variant="danger" onClick={onConfirm}>Confirm</Btn>
    </div>
  </Modal>
);

// ─── Checkbox ─────────────────────────────────────────────────────────────────
interface CheckboxProps { checked: boolean; indeterminate?: boolean; onChange: (checked: boolean) => void; }
export const Checkbox = ({ checked, indeterminate, onChange }: CheckboxProps) => (
  <input type="checkbox" checked={checked}
    ref={el => { if (el) el.indeterminate = !!indeterminate; }}
    onChange={e => onChange(e.target.checked)}
    style={{ width: 16, height: 16, accentColor: C.accent, cursor: "pointer" }}
  />
);

// ─── BulkBar ──────────────────────────────────────────────────────────────────
interface BulkAction { label: string; icon: string; variant?: BtnVariant; onClick: () => void; }
interface BulkBarProps { count: number; actions: BulkAction[]; onClear: () => void; }
export const BulkBar = ({ count, actions, onClear }: BulkBarProps) => (
  <div className="bulk-bar">
    <div className="bulk-bar__count-wrap">
      <div className="bulk-bar__badge">{count}</div>
      <span className="bulk-bar__label">{count === 1 ? "1 item selected" : `${count} items selected`}</span>
    </div>
    <div className="bulk-bar__actions">
      {actions.map(a => <Btn key={a.label} small variant={a.variant ?? "secondary"} onClick={a.onClick}>{a.icon} {a.label}</Btn>)}
    </div>
    <Btn small variant="ghost" onClick={onClear}>✕ Clear</Btn>
  </div>
);

// ─── Paginator ────────────────────────────────────────────────────────────────
interface PaginatorProps { page: number; totalPages: number; total: number; pageSize: number; setPage: (u: number | ((p: number) => number)) => void; }
export const Paginator = ({ page, totalPages, total, pageSize, setPage }: PaginatorProps) => {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  const show = new Set([1, totalPages, page, page - 1, page + 1].filter(p => p >= 1 && p <= totalPages));
  const sorted = [...show].sort((a, b) => a - b);
  const pages: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) { if (prev && p - prev > 1) pages.push("…"); pages.push(p); prev = p; }
  return (
    <div className="paginator">
      <span className="paginator__info">Showing <b>{from}–{to}</b> of <b>{total}</b></span>
      <div className="paginator__pages">
        <button className={`paginator__btn paginator__btn--prev${page===1?" paginator__btn--disabled":""}`} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹</button>
        {pages.map((p,i) => p==="…"
          ? <span key={"e"+i} className="paginator__ellipsis">…</span>
          : <button key={p} onClick={()=>setPage(p)}
              className={`paginator__btn paginator__btn--page${p===page?" paginator__btn--active":""}`}
              style={p===page?{background:C.accent,borderColor:C.accent,color:"#fff"}:undefined}
            >{p}</button>
        )}
        <button className={`paginator__btn paginator__btn--next${page===totalPages?" paginator__btn--disabled":""}`} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>›</button>
      </div>
    </div>
  );
};
