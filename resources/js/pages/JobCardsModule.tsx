// @ts-nocheck
/* eslint-disable */

/**
 * ─── Job Cards Module (Web Admin) ────────────────────────────────────────────
 *
 * Drop this file into resources/js/pages/atm-fleet/
 * Then in ATMFleetManager.tsx:
 *   1. Import it:
 *      import JobCardsModule from "./JobCardsModule";
 *
 *   2. Add to navItems:
 *      { id: "jobcards", label: "Job Cards", icon: "📋" }
 *
 *   3. Add to main content render:
 *      {page === "jobcards" && (
 *        <JobCardsModule atms={atms} engineers={engineers} banks={banks} />
 *      )}
 *
 *   4. The module fetches from /api/admin/job-cards directly (JSON, not Inertia).
 *      Make sure your API routes are registered and Sanctum is configured for
 *      web sessions (stateful) or pass a CSRF token in the fetch headers.
 */

import { useState, useEffect, useCallback } from "react";
import { C, bankColor, MAINT_TYPES } from "./constants";
import { fmt, statusColor, statusBg } from "./helpers";
import { usePagination } from "./hooks";
import {
  Badge, Btn, Modal, Card, EmptyState, Paginator
} from "./components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────
interface JobCard {
  id: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  type: string;
  work_description: string;
  parts_used?: string;
  hours_spent: number;
  scheduled_date: string;
  completed_date?: string;
  quarter: number;
  year: number;
  notes?: string;
  rejection_reason?: string;
  photos: string[];
  submitted_at?: string;
  reviewed_at?: string;
  created_at: string;
  atm: {
    id: number; terminal_id: string; location: string;
    model: string; status: string;
    bank: { id: number; name: string; short_code: string };
  };
  reviewer?: { name: string };
}

// ─── Status config ─────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  draft:     { color: C.textMuted, bg: C.surface,     label: "Draft"     },
  submitted: { color: C.amber,     bg: C.amberLight,  label: "Pending"   },
  approved:  { color: C.green,     bg: C.greenLight,  label: "Approved"  },
  rejected:  { color: C.red,       bg: C.redLight,    label: "Rejected"  },
};

const FILTERS = ["all", "submitted", "approved", "rejected", "draft"] as const;
const FILTER_LABELS: Record<string, string> = {
  all: "All", submitted: "Pending", approved: "Approved", rejected: "Rejected", draft: "Drafts",
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
  card, banks, onApprove, onReject, onClose,
}: { card: JobCard; banks: any[]; onApprove: () => void; onReject: () => void; onClose: () => void }) => {
  const sc  = STATUS_CFG[card.status] ?? STATUS_CFG.draft;
  const bi  = banks.findIndex(b => b.id === card.atm.bank.id);
  const col = bankColor(bi);

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
            ["Hours Spent", `${card.hours_spent}h`],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 2 }}>{v || "—"}</div>
            </div>
          ))}
        </div>

        {/* Work description */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Work Performed</div>
          <div style={{ background: C.surface, borderRadius: 8, padding: "12px 14px", fontSize: 14, color: C.text, lineHeight: 1.6 }}>
            {card.work_description}
          </div>
        </div>

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
        {card.notes && (
          <div style={{ background: C.amberLight, border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e" }}>
            📝 {card.notes}
          </div>
        )}

        {/* Attachments — each file downloadable in original format */}
        {(card as any).attachments?.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
              Attachments ({(card as any).attachments.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(card as any).attachments.map((a: any, i: number) => (
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
        {!(card as any).attachments?.length && card.photos?.length > 0 && (
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
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
            <Btn variant="secondary" onClick={onClose}>Close</Btn>
            <Btn variant="danger"    onClick={onReject}>✕ Reject</Btn>
            <Btn variant="primary"   onClick={onApprove}>✓ Approve</Btn>
          </div>
        )}

        {card.status !== "submitted" && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={onClose}>Close</Btn>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Main module ──────────────────────────────────────────────────────────────
export default function JobCardsModule({ atms, engineers, banks }) {
  const [cards, setCards]       = useState<JobCard[]>([]);
  const [filter, setFilter]     = useState("submitted");
  const [loading, setLoading]   = useState(true);
  const [detail, setDetail]     = useState<JobCard | null>(null);
  const [rejectTarget, setRejectTarget] = useState<JobCard | null>(null);
  const [selectedIds, setSelectedIds]   = useState<number[]>([]);

  const toggleSelect = (id: number) => setSelectedIds(s =>
    s.includes(id) ? s.filter(x => x !== id) : [...s, id]
  );
  const toggleAll = () => setSelectedIds(s =>
    s.length === filtered.length ? [] : filtered.map((c: any) => c.id)
  );

  const bulkDownload = () => {
    if (selectedIds.length === 0) return;
    const form = document.createElement("form");
    form.method = "POST"; form.action = "/job-cards/bulk-download";
    const csrf = document.createElement("input");
    csrf.type = "hidden"; csrf.name = "_token";
    csrf.value = (document.querySelector('meta[name="csrf-token"]') as any)?.content ?? "";
    form.appendChild(csrf);
    selectedIds.forEach(id => {
      const inp = document.createElement("input");
      inp.type = "hidden"; inp.name = "ids[]"; inp.value = String(id);
      form.appendChild(inp);
    });
    document.body.appendChild(form); form.submit(); document.body.removeChild(form);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/job-cards/data?status=${filter}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
      });
      const data = await res.json();
      setCards(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [filter]);

  const getCSRF = () => {
    // Read XSRF-TOKEN cookie that Laravel sets automatically
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    // Fallback to meta tag
    return (document.querySelector('meta[name="csrf-token"]') as any)?.content ?? "";
  };

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
      load();
    } catch (e) {
      alert("Network error — could not approve job card.");
    }
  }, [load]);

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
      load();
    } catch (e) {
      alert("Network error — could not reject job card.");
    }
  }, [load]);

  const filtered = cards; // Already filtered server-side
  const { page, setPage, totalPages, slice, total } = usePagination(filtered);

  const countAll       = cards.length;
  const countSubmitted = cards.filter(c => c.status === "submitted").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>Job Cards</h2>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
            Review and approve maintenance job cards submitted by field engineers
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {selectedIds.length > 0 && (
            <Btn variant="primary" onClick={bulkDownload}>
              ⬇ Download {selectedIds.length} selected
            </Btn>
          )}
          <Btn variant="secondary" onClick={load}>↻ Refresh</Btn>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer",
                background: active ? C.accent : C.surface,
                color: active ? "#fff" : C.textMid,
                fontWeight: active ? 700 : 500,
                fontSize: 13, fontFamily: "inherit",
                border: active ? "none" : `1px solid ${C.border}`,
              }}
            >
              {FILTER_LABELS[f]}
              {f === "submitted" && countSubmitted > 0 && (
                <span style={{
                  marginLeft: 6, background: active ? "rgba(255,255,255,.25)" : C.amber,
                  color: active ? "#fff" : "#fff", borderRadius: 10,
                  padding: "1px 6px", fontSize: 11, fontWeight: 700,
                }}>
                  {countSubmitted}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: C.textMuted }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState message={`No ${FILTER_LABELS[filter].toLowerCase()} job cards`} />
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                    {["", "ATM", "Bank", "Type", "Engineer", "Quarter", "Submitted", "Files", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.textMuted, whiteSpace: "nowrap", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slice.map(card => {
                    const sc  = STATUS_CFG[card.status] ?? STATUS_CFG.draft;
                    const bi  = banks.findIndex(b => b.id === card.atm.bank.id);
                    const col = bankColor(bi);
                    return (
                      <tr
                        key={card.id}
                        className="data-row"
                        style={{ borderBottom: `1px solid ${C.surface}`, cursor: "pointer",
                          background: selectedIds.includes(card.id) ? C.accentLight+"55" : undefined }}
                        onClick={() => setDetail(card)}
                      >
                        <td style={{ padding:"12px 16px" }} onClick={e=>{e.stopPropagation();toggleSelect(card.id);}}>
                          <input type="checkbox" checked={selectedIds.includes(card.id)}
                            onChange={()=>toggleSelect(card.id)}
                            style={{width:16,height:16,accentColor:C.accent,cursor:"pointer"}}/>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, fontFamily: "monospace" }}>{card.atm.terminal_id}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{card.atm.location}</div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ background: col + "18", border: `1px solid ${col}30`, borderRadius: 5, padding: "2px 6px", fontSize: 11, fontWeight: 700, color: col }}>
                            {card.atm.bank.short_code}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: C.text }}>{card.type}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: C.text }}>
                          {engineers.find(e => e.id === card.atm?.engineer_id)?.name ?? "—"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: C.textMid }}>Q{card.quarter} {card.year}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: C.textMid }}>{fmt(card.submitted_at)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: C.textMid }}>{card.hours_spent}h</td>
                        <td style={{ padding: "12px 16px" }}>
                          <Badge label={sc.label} color={sc.color} bg={sc.bg} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {(card as any).attachments?.length > 0
                            ? <span style={{background:C.accentLight,color:C.accent,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>
                                📎 {(card as any).attachments.length}
                              </span>
                            : <span style={{fontSize:12,color:C.textMuted}}>—</span>
                          }
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <Btn small variant="secondary" onClick={e => { e.stopPropagation(); setDetail(card); }}>Review</Btn>
                            {(card as any).attachments?.length > 0 && (
                              <a href={`/job-cards/${card.id}/files/0`}
                                onClick={e=>e.stopPropagation()}
                                title="Download first attachment"
                                style={{padding:"5px 10px",borderRadius:8,background:C.accentLight,
                                  color:C.accent,fontSize:12,fontWeight:700,textDecoration:"none",
                                  border:`1px solid ${C.accent}33`}}>
                                ⬇
                              </a>
                            )}
                            {card.status === "submitted" && (
                              <>
                                <Btn small variant="primary" onClick={e => { e.stopPropagation(); approve(card); }}>✓</Btn>
                                <Btn small variant="danger"  onClick={e => { e.stopPropagation(); setRejectTarget(card); }}>✕</Btn>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginator page={page} totalPages={totalPages} total={total} pageSize={15} setPage={setPage} />
          </>
        )}
      </Card>

      {/* Detail modal */}
      {detail && (
        <DetailModal
          card={detail}
          banks={banks}
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
