import { useState, useEffect, useCallback } from "react";
import {
  Badge, Btn, Modal, Paginator
} from "./components/ui";
import { C, bankColor } from "./constants";
import { fmt } from "./helpers";
import "./job-cards.css";

// ─── Types ────────────────────────────────────────────────────────────────────
type JobCardStatus = "draft" | "submitted" | "approved" | "rejected";
type JobCardFilter = "all" | JobCardStatus;

interface Bank {
  id: number;
  name: string;
  short_code: string;
}

interface Attachment {
  name: string;
  path: string;
  type: string;
  size: number;
  url: string;
  is_image: boolean;
  is_pdf: boolean;
}

interface JobCard {
  id: number;
  status: JobCardStatus;
  type: string;
  job_type?: string;
  work_description: string;
  fault_category?: string;
  phone_support?: boolean;
  checklist?: Record<string, string[]>;
  atm_status?: string;
  start_time?: string;
  end_time?: string;
  technician_signature?: string;
  custodian1_name?: string;
  custodian1_signature?: string;
  custodian2_name?: string;
  custodian2_signature?: string;
  parts_used?: string;
  hours_spent: number;
  scheduled_date: string;
  completed_date?: string;
  quarter: number;
  year: number;
  notes?: string;
  rejection_reason?: string;
  photos: string[];
  attachments?: Attachment[];
  submitted_at?: string;
  reviewed_at?: string;
  created_at: string;
  atm: {
    id: number; terminal_id: string; location: string;
    model: string; status: string; engineer_id?: number | null;
    bank: { id: number; name: string; short_code: string };
  };
  engineer?: { id: number; name: string } | null;
  reviewer?: { name: string };
}

interface JobCardResponse {
  data: JobCard[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  counts: Record<JobCardFilter, number>;
}

const PM_CHECKS: Record<string, { title: string; items: string[] }> = {
  canopyHood: { title: "TOP BOX / CANOPY", items: ["Encrypting PIN pad and FDKs working", "Card reader: cleaned, transport clear, test transaction done", "Journal printer cleaned, print legible", "Receipt printer cleaned and working", "PC Core: opened and cleaned"] },
  cashDispenser: { title: "Cash Dispenser Modules", items: ["All cassettes working (self-test run, notes learned)", "All pick modules / slots working", "D-wheel timing and status of all pick lines checked", "Carriage, Bill Aligner Module and SNT checked & cleaned", "Worn suction cups replaced", "Filter replaced", "Exit shutter cleaned"] },
  gbna: { title: "GBNA Module", items: ["Pre-acceptor cleaned, status checked", "Cassettes accepting notes for configured denominations", "Escrow / reservoir and bill validator cleaned and checked", "Transport test: upper, lower and exit shutter"] },
  atmRoom: { title: "ATM Room", items: ["Inverter / UPS installed and working", "Air conditioner installed and working"] },
};

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  draft:     { color: C.textMuted, bg: C.surface,     label: "Draft"     },
  submitted: { color: C.amber,     bg: C.amberLight,  label: "Pending"   },
  approved:  { color: C.green,     bg: C.greenLight,  label: "Approved"  },
  rejected:  { color: C.red,       bg: C.redLight,    label: "Rejected"  },
};

const FILTERS = ["all", "submitted", "approved", "rejected", "draft"] as const;
const FILTER_LABELS: Record<string, string> = {
  all: "All", submitted: "Needs review", approved: "Approved", rejected: "Returned", draft: "Drafts",
};

// ─── Reject modal ─────────────────────────────────────────────────────────────
const RejectModal = ({ card, onConfirm, onClose }: { card: JobCard; onConfirm: (reason: string) => void; onClose: () => void }) => {
  const [reason, setReason] = useState("");
  return (
    <Modal title="Reject Job Card" subtitle={`${card.atm.terminal_id} · ${card.atm.location}`} onClose={onClose} width={480}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: C.redLight, border: "1px solid #fecaca", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.red }}>
          The engineer will be notified and can resubmit with corrections.
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.textMid, display: "block", marginBottom: 6 }}>
            Reason for rejection <span style={{ color: C.red }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Explain clearly what needs to be corrected…"
            rows={4}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim()}>
            Reject Card
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Detail modal ─────────────────────────────────────────────────────────────
const DetailModal = ({
  card, onApprove, onReject, onClose,
}: { card: JobCard; onApprove: () => void; onReject: () => void; onClose: () => void }) => {
  const sc  = STATUS_CFG[card.status] ?? STATUS_CFG.draft;

  return (
    <Modal title="Job Card Review" subtitle={`#${card.id} · Submitted ${fmt(card.submitted_at)}`} onClose={onClose} width={660}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Status banner */}
        <div style={{ background: sc.bg, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: sc.color }}>{sc.label}</div>
            {card.rejection_reason && <div style={{ fontSize: 13, color: sc.color, marginTop: 4 }}>{card.rejection_reason}</div>}
            {card.reviewer && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>by {card.reviewer.name} · {fmt(card.reviewed_at)}</div>}
          </div>
          <Badge label={sc.label} color={sc.color} bg={sc.bg} />
        </div>

        {/* ATM + Engineer */}
        <div style={{ background: C.surface, borderRadius: 10, padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            ["ATM", card.atm.terminal_id],
            ["Location", card.atm.location],
            ["ATM Model", card.atm.model],
            ["Bank", card.atm.bank.name],
            ["Type", card.type],
            ["Quarter", `Q${card.quarter} ${card.year}`],
            ["Scheduled", fmt(card.scheduled_date)],
            ["Completed", fmt(card.completed_date)],
            ["Visit time", card.start_time && card.end_time ? `${card.start_time}–${card.end_time}` : "—"],
            ["ATM status", card.atm_status || "—"],
            ["Hours Spent", `${card.hours_spent}h`],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 2 }}>{v || "—"}</div>
            </div>
          ))}
        </div>

        {/* PM cards use the form's Notes / Remarks field; repair cards use Work Performed. */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
            {card.job_type === "maintenance" ? "Notes / Remarks" : "Work Performed"}
          </div>
          <div style={{ background: C.surface, borderRadius: 8, padding: "12px 14px", fontSize: 14, color: C.text, lineHeight: 1.6 }}>
            {card.job_type === "maintenance" ? card.notes || "No notes recorded" : card.work_description}
          </div>
        </div>

        {card.job_type === "repair" && card.fault_category && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Fault Category</div>
            <div style={{ background: C.surface, borderRadius: 8, padding: "12px 14px", fontSize: 14, color: C.text }}>
              {card.fault_category}
            </div>
          </div>
        )}

        {card.job_type === "maintenance" && card.checklist && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(card.checklist).map(([section, answers]) => (
              <div key={section} style={{ background: C.surface, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 6 }}>{PM_CHECKS[section]?.title ?? section}</div>
                {(answers as string[]).map((answer, index) => (
                  <div key={index} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderTop: `1px solid ${C.border}`, padding: "6px 0", fontSize: 13, color: C.textMid }}>
                    <span>{index === 4 && section === "canopyHood" ? <><strong>PC Core</strong>: opened and cleaned</> : PM_CHECKS[section]?.items[index] ?? `Check ${index + 1}`}</span><strong>{answer === "ok" ? "Done" : answer === "na" ? "N/A" : answer === "nr" ? "No action needed" : answer === "fail" ? "Not OK" : "—"}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {(card.status !== "draft" && card.technician_signature || card.custodian1_name || card.custodian2_name) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            {([
              ["Engineer", card.status !== "draft" ? card.technician_signature : null],
              [card.custodian1_name || "Custodian 1", card.custodian1_signature],
              [card.custodian2_name || "Custodian 2", card.custodian2_signature],
            ] as [string, string | null | undefined][]).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0
            ).map(([name, signature]) => (
              <div key={name} style={{ background: C.surface, borderRadius: 8, padding: 10, fontSize: 12, color: C.textMid }}>
                <div style={{ fontWeight: 700, marginBottom: 5 }}>{name}</div>
                <img src={signature} alt={`${name} signature`} style={{ width: "100%", height: 48, objectFit: "contain", background: "#fff", borderRadius: 6 }} />
              </div>
            ))}
          </div>
        )}

        {/* Parts */}
        {card.parts_used && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Parts Used</div>
            <div style={{ background: C.surface, borderRadius: 8, padding: "12px 14px", fontSize: 14, color: C.text }}>
              {card.parts_used}
            </div>
          </div>
        )}

        {/* Notes */}
        {card.job_type !== "maintenance" && card.notes && (
          <div style={{ background: C.amberLight, border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
            📝 {card.notes}
          </div>
        )}

        {/* Attachments — each file downloadable in original format */}
        {card.attachments && card.attachments.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
              Attachments ({card.attachments.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {card.attachments.map((a, i) => (
                <a key={i} href={`/job-cards/${card.id}/files/${i}`}
                  download={a.name}
                  style={{ display:"flex", alignItems:"center", gap:10,
                    background:C.surface, border:`1px solid ${C.border}`,
                    borderRadius:10, padding:"10px 14px", textDecoration:"none" }}>
                  {a.is_image
                    ? <img src={a.url} alt="" style={{width:44,height:44,borderRadius:6,objectFit:"cover",flexShrink:0}}/>
                    : <span style={{fontSize:24,flexShrink:0}}>{a.is_pdf?"📄":"📎"}</span>
                  }
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                    <div style={{fontSize:11,color:C.textMuted,marginTop:1}}>
                      {a.type} · {Math.round(a.size/1024)}KB
                    </div>
                  </div>
                  <span style={{fontSize:12,color:C.accent,fontWeight:700,flexShrink:0}}>↓ Download</span>
                </a>
              ))}
            </div>
          </div>
        )}
        {/* Legacy photos (old records without attachments) */}
        {!card.attachments?.length && card.photos?.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
              Photos ({card.photos.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {card.photos.map((url: string, i: number) => (
                <a key={i} href={`/storage/${url}`} target="_blank" rel="noreferrer">
                  <img src={`/storage/${url}`} alt={`Photo ${i + 1}`}
                    style={{ width: 100, height: 100, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.border}`, cursor: "pointer" }}/>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {card.status === "submitted" && (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
            <a href={`/job-cards/${card.id}/print`} target="_blank" rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", borderRadius: 8, padding: "9px 14px", background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              ↓ Print / Save PDF
            </a>
            <Btn variant="secondary" onClick={onClose}>Close</Btn>
            <Btn variant="danger"    onClick={onReject}>✕ Reject</Btn>
            <Btn variant="primary"   onClick={onApprove}>✓ Approve</Btn>
          </div>
        )}

        {card.status !== "submitted" && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a href={`/job-cards/${card.id}/print`} target="_blank" rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", borderRadius: 8, padding: "9px 14px", background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              ↓ Print / Save PDF
            </a>
            <Btn variant="secondary" onClick={onClose}>Close</Btn>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Main module ──────────────────────────────────────────────────────────────
interface JobCardsModuleProps {
  banks: Bank[];
  onApproved?: () => void;
}

const PAGE_SIZE = 15;
const INITIAL_COUNTS: Record<JobCardFilter, number> = {
  all: 0,
  submitted: 0,
  approved: 0,
  rejected: 0,
  draft: 0,
};

export default function JobCardsModule({ banks, onApproved }: JobCardsModuleProps) {
  const [cards, setCards]       = useState<JobCard[]>([]);
  const [filter, setFilter]     = useState<JobCardFilter>("submitted");
  const [search, setSearch]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [jobType, setJobType]   = useState("all");
  const [page, setPage]         = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal]       = useState(0);
  const [statusCounts, setStatusCounts] = useState(INITIAL_COUNTS);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail]     = useState<JobCard | null>(null);
  const [rejectTarget, setRejectTarget] = useState<JobCard | null>(null);
  const [selectedIds, setSelectedIds]   = useState<number[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const toggleSelect = (id: number) => setSelectedIds(selected =>
    selected.includes(id) ? selected.filter(selectedId => selectedId !== id) : [...selected, id]
  );
  const toggleAll = () => setSelectedIds(selected => {
    const visibleIds = cards.map(card => card.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));
    return allVisibleSelected
      ? selected.filter(id => !visibleIds.includes(id))
      : [...new Set([...selected, ...visibleIds])];
  });

  const bulkDownload = () => {
    if (selectedIds.length === 0) return;
    const form = document.createElement("form");
    form.method = "POST"; form.action = "/job-cards/bulk-download";
    const csrf = document.createElement("input");
    csrf.type = "hidden";
    csrf.name = "_token";
    csrf.value = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";
    form.appendChild(csrf);
    selectedIds.forEach(id => {
      const inp = document.createElement("input");
      inp.type = "hidden"; inp.name = "ids[]"; inp.value = String(id);
      form.appendChild(inp);
    });
    document.body.appendChild(form); form.submit(); document.body.removeChild(form);
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchCards = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: filter,
          page: String(page),
          per_page: String(PAGE_SIZE),
          search: debouncedSearch,
          job_type: jobType,
        });
        const res = await fetch(`/job-cards/data?${params}`, {
          headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to load job cards (${res.status})`);
        const result = await res.json() as JobCardResponse;
        if (controller.signal.aborted) return;
        setCards(result.data);
        setLastPage(result.meta.last_page);
        setTotal(result.meta.total);
        setStatusCounts(result.counts);
        setLoadError(null);
        if (page > result.meta.last_page) setPage(result.meta.last_page);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Failed to load job cards.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void fetchCards();
    return () => controller.abort();
  }, [filter, page, refreshKey, debouncedSearch, jobType]);

  const refresh = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setRefreshKey(key => key + 1);
  }, []);

  const changeFilter = (nextFilter: JobCardFilter) => {
    if (nextFilter === filter && page === 1) {
      refresh();
      return;
    }
    setLoading(true);
    setFilter(nextFilter);
    setPage(1);
  };

  const changePage = (nextPage: number | ((currentPage: number) => number)) => {
    setLoading(true);
    setPage(nextPage);
  };

  const getCSRF = useCallback(() => {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";
  }, []);

  const approve = useCallback(async (card: JobCard) => {
    try {
      const res = await fetch(`/job-cards/${card.id}/approve`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-XSRF-TOKEN": getCSRF(),
        },
        credentials: "same-origin",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || `Failed to approve (${res.status}). Check you are logged in as admin.`);
        return;
      }
      setDetail(null);
      refresh();
      onApproved?.();
    } catch {
      alert("Network error — could not approve job card.");
    }
  }, [getCSRF, onApproved, refresh]);

  const reject = useCallback(async (card: JobCard, reason: string) => {
    try {
      const res = await fetch(`/job-cards/${card.id}/reject`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-XSRF-TOKEN": getCSRF(),
        },
        credentials: "same-origin",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || `Failed to reject (${res.status}). Check you are logged in as admin.`);
        return;
      }
      setRejectTarget(null);
      setDetail(null);
      refresh();
    } catch {
      alert("Network error — could not reject job card.");
    }
  }, [getCSRF, refresh]);

  return (
    <div className="jobcards-page">
      <header className="jobcards-header">
        <div className="jobcards-heading">
          <h1>Job cards</h1>
          <p>Review and manage engineer job card submissions.</p>
        </div>
        <div className="jobcards-header-actions">
          {selectedIds.length > 0 && (
            <button className="jobcards-button jobcards-button--primary" onClick={bulkDownload}>
              <span aria-hidden="true">↓</span> Download selected <span className="jobcards-button-count">{selectedIds.length}</span>
            </button>
          )}
          <button className="jobcards-button jobcards-button--secondary" onClick={refresh} disabled={loading}>
            <span className={loading ? "jobcards-refresh-icon is-spinning" : "jobcards-refresh-icon"} aria-hidden="true">↻</span>
            Refresh
          </button>
        </div>
      </header>

      <section className="jobcards-board">
        <div className="jobcards-board-toolbar">
          <div className="jobcards-filter-group" role="tablist" aria-label="Filter job cards">
            {FILTERS.map(f => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => changeFilter(f)}
                  className={`jobcards-filter${active ? " is-active" : ""}`}
                  role="tab"
                  aria-selected={active}
                >
                  {FILTER_LABELS[f]}
                  <span className="jobcards-filter-count">{statusCounts[f]}</span>
                </button>
              );
            })}
          </div>
          <div className="jobcards-list-controls">
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search ATM, card #, bank, engineer…"
              aria-label="Search job cards"
              className="jobcards-search"
            />
            <select
              value={jobType}
              onChange={event => { setJobType(event.target.value); setPage(1); }}
              aria-label="Filter job cards by type"
              className="jobcards-type-filter"
            >
              <option value="all">All job types</option>
              <option value="maintenance">PM</option>
              <option value="repair">Repair</option>
            </select>
          </div>
        </div>
        <div className="jobcards-board-summary">
          <span className="jobcards-live-dot" />
          {loading ? "Updating records…" : `${total} ${total === 1 ? "record" : "records"}`}
          {selectedIds.length > 0 && <span className="jobcards-selection-count">{selectedIds.length} selected</span>}
        </div>

        {loadError ? (
          <div className="jobcards-empty" role="alert">
            <h3>Unable to load job cards</h3>
            <p>{loadError}</p>
            <button className="jobcards-button jobcards-button--secondary" onClick={refresh}>Try again</button>
          </div>
        ) : loading && cards.length === 0 ? (
          <div className="jobcards-loading">
            <span className="jobcards-spinner" />
            <span>Loading job card records</span>
          </div>
        ) : cards.length === 0 ? (
          <div className="jobcards-empty">
            <div className="jobcards-empty-icon" aria-hidden="true">{filter === "submitted" ? "✓" : "⌕"}</div>
            <h3>{filter === "submitted" ? "Review queue is clear" : filter === "approved" ? "No approved job cards" : filter === "rejected" ? "No job cards have been returned" : filter === "draft" ? "No draft job cards" : "No job cards yet"}</h3>
            <p>{filter === "submitted" ? "New engineer submissions will appear here for review." : "Try another status filter to view more records."}</p>
          </div>
        ) : (
          <>
            <div className="jobcards-table-scroll">
              <table className="jobcards-table">
                <thead>
                  <tr>
                    <th className="jobcards-check-cell">
                      <input
                        type="checkbox"
                        checked={cards.length > 0 && cards.every(card => selectedIds.includes(card.id))}
                        onChange={() => toggleAll()}
                        aria-label="Select all job cards on this page"
                      />
                    </th>
                    {["ATM / SITE", "BANK", "JOB TYPE", "ENGINEER", "PERIOD", "SUBMITTED", "HOURS", "OUTCOME", "STATUS", "ACTION"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cards.map(card => {
                    const sc  = STATUS_CFG[card.status] ?? STATUS_CFG.draft;
                    const bi  = banks.findIndex(b => b.id === card.atm.bank.id);
                    const col = bankColor(bi);
                    const initials = card.engineer?.name?.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
                    const outcomeClass = card.atm_status === "In Service"
                      ? "in-service"
                      : card.atm_status === "Out of Service"
                        ? "out-of-service"
                        : card.atm_status === "Pending Parts"
                          ? "pending-parts"
                          : "unrecorded";
                    return (
                      <tr key={card.id} className={`jobcards-row${selectedIds.includes(card.id) ? " is-selected" : ""}`} onClick={() => setDetail(card)}>
                        <td className="jobcards-check-cell" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.includes(card.id)} onChange={() => toggleSelect(card.id)} aria-label={`Select job card ${card.id}`} />
                        </td>
                        <td className="jobcards-atm-cell">
                          <span className="jobcards-terminal">{card.atm.terminal_id}</span>
                          <span className="jobcards-location">{card.atm.location}</span>
                        </td>
                        <td><span className="jobcards-bank" style={{ "--bank-color": col } as React.CSSProperties}>{card.atm.bank.short_code}</span></td>
                        <td><span className={`jobcards-type jobcards-type--${card.job_type === "repair" ? "repair" : "maintenance"}`}>{card.job_type === "repair" ? "Repair" : card.type}</span></td>
                        <td>
                          <div className="jobcards-engineer">
                            <span className="jobcards-avatar">{initials || "—"}</span>
                            <span>{card.engineer?.name ?? "Unassigned"}</span>
                          </div>
                        </td>
                        <td><span className="jobcards-period">Q{card.quarter} {card.year}</span></td>
                        <td className="jobcards-date">{fmt(card.submitted_at) || "—"}</td>
                        <td className="jobcards-hours">{Number(card.hours_spent || 0).toFixed(1)}<small>h</small></td>
                        <td><span className={`jobcards-outcome jobcards-outcome--${outcomeClass}`}>{card.atm_status || "Not recorded"}</span></td>
                        <td><span className={`jobcards-status jobcards-status--${card.status}`}>{sc.label}</span></td>
                        <td onClick={e => e.stopPropagation()}>
                          <button className="jobcards-review-button" onClick={() => setDetail(card)}>
                            Review <span aria-hidden="true">→</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="jobcards-pagination">
              <Paginator page={page} totalPages={lastPage} total={total} pageSize={PAGE_SIZE} setPage={changePage} />
            </div>
          </>
        )}
      </section>

      {/* Detail modal */}
      {detail && (
        <DetailModal
          card={detail}
          onApprove={() => approve(detail)}
          onReject={() => { setRejectTarget(detail); setDetail(null); }}
          onClose={() => setDetail(null)}
        />
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          card={rejectTarget}
          onConfirm={reason => reject(rejectTarget, reason)}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
