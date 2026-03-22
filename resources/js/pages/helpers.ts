import { C } from "./constants";
import type { Atm, Bank, MaintenanceRecord } from "./types";

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export const fmt = (d?: string | null): string =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtISO = (d: Date): string => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/** Stable reference – computed once at module load */
export const today = new Date();

export const qtr = (d: Date): number => Math.ceil((d.getMonth() + 1) / 3);

// ─── Status Colours ───────────────────────────────────────────────────────────

export const statusColor = (s: string): string =>
  ({ Active: C.green, Offline: C.red, "Under Maintenance": C.amber, Decommissioned: C.textMuted })[s] ?? C.textMuted;

export const statusBg = (s: string): string =>
  ({ Active: C.greenLight, Offline: C.redLight, "Under Maintenance": C.amberLight, Decommissioned: C.surface })[s] ?? C.surface;

export const mColor = (s: string): string =>
  ({ Completed: C.green, "In Progress": C.accent, Scheduled: C.amber, Cancelled: C.textMuted })[s] ?? C.textMuted;

export const mBg = (s: string): string =>
  ({ Completed: C.greenLight, "In Progress": C.accentLight, Scheduled: C.amberLight, Cancelled: C.surface })[s] ?? C.surface;

// ─── Laravel snake_case → camelCase Normalisers ───────────────────────────────

export const normAtm = (a: Atm): Atm => ({
  ...a,
  terminalId:   a.terminal_id   ?? a.terminalId,
  serialNumber: a.serial_number ?? a.serialNumber,
  bankId:       a.bank_id       ?? a.bankId,
  engineerId:   a.engineer_id   ?? a.engineerId,
  installDate:  toDateStr(a.install_date ?? a.installDate),
});

export const normBank = (b: Bank): Bank => ({
  ...b,
  shortCode:     b.short_code      ?? b.shortCode,
  contactPerson: b.contact_person  ?? b.contactPerson,
  contactPhone:  b.contact_phone   ?? b.contactPhone,
  contactEmail:  b.contact_email   ?? b.contactEmail,
});

const toDateStr = (v: any): string => {
  if (!v) return "";
  const s = String(v);
  // ISO datetime or date-only — slice to YYYY-MM-DD
  return s.slice(0, 10);
};

export const normMaint = (m: MaintenanceRecord): MaintenanceRecord => ({
  ...m,
  atmId:         m.atm_id          ?? m.atmId,
  engineerId:    m.engineer_id     ?? m.engineerId,
  scheduledDate: toDateStr(m.scheduled_date ?? m.scheduledDate),
  completedDate: toDateStr(m.completed_date ?? m.completedDate),
});

export const normEng = <T>(e: T): T => ({ ...e });
