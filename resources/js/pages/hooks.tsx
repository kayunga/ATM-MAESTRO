import { useState, useEffect, useCallback } from "react";
import { C, TOAST_ICONS, TOAST_COLORS, PAGE_SIZE } from "./constants";
import type { ToastType } from "./types";

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  leaving: boolean;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type, leaving: false }]);
    setTimeout(() => {
      setToasts(p => p.map(t => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 350);
    }, duration);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(p => p.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 350);
  }, []);

  const ToastContainer = () => (
    <div style={{
      position: "fixed", bottom: 24, right: 20, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 10,
      pointerEvents: "none", maxWidth: 360,
    }}>
      {toasts.map(t => {
        const col = TOAST_COLORS[t.type] ?? TOAST_COLORS.info;
        return (
          <div key={t.id} style={{
            background: col.bg, border: `1.5px solid ${col.border}`, borderRadius: 12,
            padding: "13px 16px", display: "flex", alignItems: "flex-start", gap: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,.12)", pointerEvents: "all",
            transform: t.leaving ? "translateX(120%)" : "translateX(0)",
            opacity: t.leaving ? 0 : 1,
            transition: "transform .32s cubic-bezier(.4,0,.2,1), opacity .32s ease",
          }}>
            <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>{TOAST_ICONS[t.type]}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: col.text, flex: 1, lineHeight: 1.5 }}>{t.message}</span>
            <button onClick={() => dismiss(t.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 16, color: col.text, opacity: 0.5, padding: 0,
              lineHeight: 1, flexShrink: 0, marginTop: 1,
            }}>×</button>
          </div>
        );
      })}
    </div>
  );

  return { toast, ToastContainer };
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationResult<T> {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  slice: T[];
  total: number;
}

export function usePagination<T>(items: T[], pageSize: number = PAGE_SIZE): PaginationResult<T> {
  const [pg, setPg] = useState(1);

  // Reset to page 1 whenever filtered list length changes
  useEffect(() => { setPg(1); }, [items.length]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePg     = Math.min(pg, totalPages);
  const slice      = items.slice((safePg - 1) * pageSize, safePg * pageSize);

  return { page: safePg, setPage: setPg, totalPages, slice, total: items.length };
}
