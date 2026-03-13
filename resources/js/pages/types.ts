// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface Bank {
  id: number;
  name: string;
  shortCode: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  headquarters?: string;
  notes?: string;
  // raw Laravel snake_case (present before normalisation)
  short_code?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface Engineer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  region: string;
}

export interface Atm {
  id: number;
  terminalId: string;
  serialNumber?: string;
  model: string;
  location: string;
  address?: string;
  bankId: number;
  engineerId: number;
  status: string;
  installDate?: string;
  notes?: string;
  // raw Laravel snake_case
  terminal_id?: string;
  serial_number?: string;
  bank_id?: number;
  engineer_id?: number;
  install_date?: string;
}

export interface MaintenanceRecord {
  id: number;
  atmId: number;
  engineerId: number;
  type: string;
  status: string;
  scheduledDate: string;
  completedDate?: string;
  quarter: number;
  year: number;
  notes?: string;
  // raw Laravel snake_case
  atm_id?: number;
  engineer_id?: number;
  scheduled_date?: string;
  completed_date?: string;
}

// ─── UI / Component Types ─────────────────────────────────────────────────────

export type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "teal";

export type ToastType = "success" | "error" | "warning" | "info";

export type NavPage = "dashboard" | "banks" | "atms" | "maintenance" | "engineers";

// ─── Bulk PM Wizard ───────────────────────────────────────────────────────────

export interface BulkPMConfig {
  type: string;
  status: string;
  scheduledDate: string;
  completedDate: string;
  quarter: string;
  year: string;
  notes: string;
  filterBank: string;
  filterStatus: string;
}

export interface BulkPMRecord {
  atmId: number;
  engineerId: number;
  type: string;
  status: string;
  scheduledDate: string;
  completedDate: string | null;
  quarter: number;
  year: number;
  notes: string;
}

// ─── Inertia Page Props ───────────────────────────────────────────────────────

export interface PageProps {
  atms: Atm[];
  banks: Bank[];
  engineers: Engineer[];
  maintenance: MaintenanceRecord[];
}
