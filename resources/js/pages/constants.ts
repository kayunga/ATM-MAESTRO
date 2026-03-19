// ─── Design Tokens ────────────────────────────────────────────────────────────

export const C = {
  bg: "#ffffff",
  surface: "#f8f9fb",
  navBg: "#f4f5f7",
  navBorder: "#e8eaed",
  border: "#e8eaed",
  borderHover: "#c8cdd5",
  text: "#1a1d23",
  textMid: "#4b5260",
  textMuted: "#8b909a",
  accent: "#1d6ef5",
  accentLight: "#eef3fe",
  green: "#10b366",
  greenLight: "#eafaf2",
  amber: "#f59e0b",
  amberLight: "#fffbeb",
  red: "#ef4444",
  redLight: "#fef2f2",
  purple: "#7c3aed",
  purpleLight: "#f5f3ff",
  teal: "#0891b2",
  tealLight: "#ecfeff",
  shadow: "0 1px 3px rgba(0,0,0,0.08)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.10)",
} as const;

// ─── ATM / Domain Constants ───────────────────────────────────────────────────

export const NCR_MODELS = [
  "NCR 6622", "NCR 6626", "NCR 6627", "NCR 6634",
  "NCR 6638", "NCR 6684", "NCR SelfServ 80", "NCR SelfServ 84", "NCR SelfServ 87",
];

export const STATUSES = ["Active", "Offline", "Under Maintenance", "Decommissioned"];

export const MAINT_TYPES = [
  "Quarterly PM", "Emergency", "Part Replacement",
  "Software Update", "Cash Jam", "Card Reader Service",
];

export const MAINT_STATUS = ["Scheduled", "In Progress", "Completed", "Cancelled"];

export const ZAMBIA_BANKS = [
  "Zanaco", "Stanbic Bank Zambia", "Standard Chartered Zambia",
  "FNB Zambia", "Absa Bank Zambia", "Access Bank Zambia",
  "Atlas Mara Zambia", "Citibank Zambia", "Bank of China Zambia",
  "Indo Zambia Bank", "Madison Finance", "United Bank for Africa Zambia",
];

// ─── Bank Colour Palette ──────────────────────────────────────────────────────

export const BANK_COLORS = [
  "#1d6ef5", "#10b366", "#f59e0b", "#ef4444",
  "#7c3aed", "#0891b2", "#be185d", "#065f46",
];

export const bankColor = (idx: number): string =>
  BANK_COLORS[idx % BANK_COLORS.length];

// ─── Toast UI Tokens ──────────────────────────────────────────────────────────

export const TOAST_ICONS: Record<string, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
};

export const TOAST_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  success: { bg: "#f0fdf4",   border: "#bbf7d0", text: C.green  },
  error:   { bg: "#fef2f2",   border: "#fecaca", text: C.red    },
  warning: { bg: "#fffbeb",   border: "#fde68a", text: "#b45309" },
  info:    { bg: C.accentLight, border: "#bfdbfe", text: C.accent },
};

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PAGE_SIZE = 15;
