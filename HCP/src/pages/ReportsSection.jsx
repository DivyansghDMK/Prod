import React, { useState, useEffect } from "react";
import { FileText, Download, Eye, AlertTriangle, RefreshCw, Clock, CheckCircle, UserCheck } from "lucide-react";
import { getReports, filterReportsByRole, canViewPDF } from "../services/api.js";

/* ── palette (mirrors App.jsx COLORS) ─────────────────────────────── */
const C = {
  panel: "rgba(20, 29, 44, 0.72)", panel2: "#101724",
  border: "#263042", borderGlass: "rgba(255,255,255,0.08)",
  blue1: "#2E7DB8", blue2: "#3E97D6",
  text: "#E6EAF0", sub: "#7C8AA0",
  danger: "#D9534F", ok: "#3FA772", warn: "#C99A3C",
};

const STATUS_META = {
  "Pending":      { color: C.warn,   icon: <Clock size={12} />,       label: "Pending" },
  "Assigned":     { color: C.blue2,  icon: <UserCheck size={12} />,   label: "Assigned" },
  "Under Review": { color: C.warn,   icon: <Eye size={12} />,         label: "Under Review" },
  "Reviewed":     { color: C.ok,     icon: <CheckCircle size={12} />, label: "Reviewed" },
  "Compliant":    { color: C.ok,     icon: <CheckCircle size={12} />, label: "Compliant" },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { color: C.sub, icon: null, label: status || "Unknown" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: m.color + "22", color: m.color,
      fontSize: 11.5, fontWeight: 700, padding: "3px 9px",
      borderRadius: 20, letterSpacing: 0.3,
    }}>
      {m.icon} {m.label}
    </span>
  );
}

const MOCK_REPORTS = [
  {
    report_id: "rep1",
    report_uid: "REP-2026-001",
    patient_name: "Vikram Chauhan",
    created_at: "2026-07-01T10:00:00Z",
    status: "Reviewed",
    doctor_name: "Dr. Aditi Sharma",
    storage_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  },
  {
    report_id: "rep2",
    report_uid: "REP-2026-002",
    patient_name: "Meena Kulkarni",
    created_at: "2026-07-02T14:30:00Z",
    status: "Assigned",
    doctor_name: "Dr. Aditi Sharma",
    storage_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  },
  {
    report_id: "rep3",
    report_uid: "REP-2026-003",
    patient_name: "Ritu Malhotra",
    created_at: "2026-07-03T09:15:00Z",
    status: "Pending",
    doctor_name: null,
    storage_url: null
  }
];

function normalizeReport(r) {
  const pName = r.patient_name || r.patient || r.name || "—";
  const rId   = r.report_uid || r.report_id || r.id || "REP-" + Math.random().toString(36).substring(2, 9).toUpperCase();
  const dateStr = r.created_at || (r.date ? `${r.date}T${r.time || "00:00:00"}Z` : null);
  const status  = r.status || "Reviewed";
  const docName = r.doctor_name || r.doctor || r.doctorName || "—";
  const url     = r.storage_url || r.preview_url || r.presigned_url || r.file_url || r.fileUrl || r.url || "";
  
  return {
    patient_name: pName,
    report_uid: rId,
    created_at: dateStr,
    status: status,
    doctor_name: docName,
    storage_url: url
  };
}

export default function ReportsSection({ session, orgData, orgId }) {
  const devices = orgData?.devices?.[orgId] || [];
  const defaultSerial = devices.length > 0 ? devices[0].serial : "A010";

  const [selectedSerial, setSelectedSerial] = useState(defaultSerial);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState("");
  const [statusFilter, setF]  = useState("All");
  const [isLiveMode, setIsLiveMode] = useState(true);

  // Doctor Review states
  const [reviewModal, setReviewModal] = useState(null);
  const [decision, setDecision]       = useState("APPROVED");
  const [comments, setComments]       = useState("");

  const role       = session?.role || "";
  const pdfOk      = canViewPDF(role);
  const isHead     = role === "HCP Head" || role === "Doctor Head" || role === "HCP_ADMIN" || role === "DOCTOR_ADMIN";
  const isAdmin    = role === "Sr. Admin" || role === "Jr. Admin";
  const isDoctor   = role === "Sr. Clinical Doctor" || role === "Jr. Clinical Doctor" || role === "HCP_CLINICAL" || role === "DOCTOR_CLINICAL";
  const noAccess   = !isHead && !isAdmin && !isDoctor;

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await getReports(selectedSerial);
      const raw = Array.isArray(res) ? res : (res.data || res.reports || []);
      const normalized = raw.map(normalizeReport);
      setReports(filterReportsByRole(normalized, session));
      setIsLiveMode(true);
    } catch (e) {
      console.warn("Live ECG reports fetch failed, using fallback mock data:", e.message);
      const normalizedMock = MOCK_REPORTS.map(normalizeReport);
      setReports(filterReportsByRole(normalizedMock, session));
      setIsLiveMode(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedSerial]);

  if (noAccess) return (
    <div style={{ padding: "40px 32px", textAlign: "center" }}>
      <AlertTriangle size={40} color={C.warn} style={{ marginBottom: 16 }} />
      <p style={{ color: C.text, fontSize: 16, fontWeight: 600 }}>Access Restricted</p>
      <p style={{ color: C.sub, fontSize: 13.5, marginTop: 6 }}>
        ECG report access is not available for your role ({role}).
      </p>
    </div>
  );

  const visible = reports.filter((r) => {
    const q = search.toLowerCase();
    const matchQ = !q || r.patient_name?.toLowerCase().includes(q) ||
      r.report_uid?.toLowerCase().includes(q) || r.doctor_name?.toLowerCase().includes(q);
    const matchS = statusFilter === "All" || r.status === statusFilter;
    return matchQ && matchS;
  });

  return (
    <div style={{ padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ color:C.text, fontSize:20, fontWeight:700, margin:0 }}>ECG Reports</h2>
            <p style={{ color:C.sub, fontSize:13, marginTop:4, margin:0 }}>
              {isHead ? "All organisation reports" : isAdmin ? "All reports (view only)" : "Your assigned reports"}
            </p>
          </div>
          {isLiveMode ? (
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              background: C.ok + "22", color: C.ok, padding: "2px 8px", borderRadius: 4,
              letterSpacing: 0.5, alignSelf: "center", marginTop: 2,
            }}>
              Live Cloud Sync
            </span>
          ) : (
            <span 
              title="Authenticate via phone OTP on login screen to connect to live AWS database"
              style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                background: C.warn + "22", color: C.warn, padding: "2px 8px", borderRadius: 4,
                letterSpacing: 0.5, alignSelf: "center", marginTop: 2, cursor: "help",
              }}
            >
              Offline / Mock Demo
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {devices.length > 0 && (
            <select
              value={selectedSerial}
              onChange={(e) => setSelectedSerial(e.target.value)}
              style={{
                background: C.panel2, border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.text, padding: "8px 12px",
                fontSize: 13, outline: "none", cursor: "pointer",
              }}
            >
              {devices.map((d) => (
                <option key={d.id} value={d.serial}>
                  {d.model || "RhythmPro"} ({d.serial})
                </option>
              ))}
            </select>
          )}
          <button onClick={load} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.sub, cursor:"pointer", padding:"7px 14px", fontSize:13 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search patient, report ID, doctor…"
          style={{ flex:1, minWidth:200, background:C.panel2, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"9px 14px", fontSize:13.5, outline:"none" }} />
        {["All","Pending","Assigned","Under Review","Reviewed"].map((s) => (
          <button key={s} onClick={()=>setF(s)} style={{ padding:"8px 16px", borderRadius:20, fontSize:12.5, fontWeight:600, cursor:"pointer", border:"1px solid", borderColor:statusFilter===s?C.blue1:C.border, background:statusFilter===s?C.blue1+"22":"transparent", color:statusFilter===s?C.blue2:C.sub }}>
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign:"center", padding:"60px 0", color:C.sub }}>
          <RefreshCw size={28} style={{ marginBottom:12 }} />
          <p style={{ margin:0, fontSize:14 }}>Loading reports from server…</p>
        </div>
      )}

      {!loading && error && (
        <div style={{ background:C.danger+"18", border:`1px solid ${C.danger}44`, borderRadius:10, padding:"18px 22px", color:C.danger, fontSize:14 }}>
          <AlertTriangle size={16} style={{ marginRight:8, verticalAlign:-2 }} />
          {error}
          <button onClick={load} style={{ marginLeft:16, background:"none", border:"none", color:C.blue2, cursor:"pointer", fontSize:13, fontWeight:600 }}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div style={{ background:C.panel, borderRadius:14, border:`1px solid ${C.borderGlass}`, backdropFilter:"blur(12px)", overflow:"hidden" }}>
          {visible.length === 0 ? (
            <div style={{ padding:"52px 0", textAlign:"center", color:C.sub }}>
              <FileText size={36} style={{ marginBottom:12, opacity:0.4 }} />
              <p style={{ fontSize:14, margin:0 }}>No reports found.</p>
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13.5, minWidth:640 }}>
                <thead>
                  <tr>
                    {["Patient","Report ID","Date","Status","Assigned Doctor","Actions"].map((col) => (
                      <th key={col} style={{ textAlign:"left", color:C.sub, fontWeight:600, padding:"12px 16px", fontSize:11.5, letterSpacing:0.4, textTransform:"uppercase", borderBottom:`1px solid ${C.borderGlass}` }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={r.report_id || r.report_uid || i} style={{ borderTop: i>0 ? `1px solid ${C.borderGlass}` : "none" }}>
                      <td style={{ padding:"13px 16px", color:C.text, fontWeight:600 }}>{r.patient_name || "—"}</td>
                      <td style={{ padding:"13px 16px", color:C.sub, fontFamily:"monospace", fontSize:12 }}>{r.report_uid || r.report_id || "—"}</td>
                      <td style={{ padding:"13px 16px", color:C.sub, fontSize:12.5 }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—"}
                      </td>
                      <td style={{ padding:"13px 16px" }}><StatusBadge status={r.status} /></td>
                      <td style={{ padding:"13px 16px", color:C.sub, fontSize:13 }}>{r.doctor_name || <span style={{opacity:0.4}}>Unassigned</span>}</td>
                      <td style={{ padding:"13px 16px" }}>
                        <div style={{ display:"flex", gap:8 }}>
                          {pdfOk && r.storage_url ? (
                            <>
                              <a href={r.storage_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"5px 12px", borderRadius:6, fontSize:12, fontWeight:600, background:C.blue1+"22", color:C.blue2, border:`1px solid ${C.blue1}44`, textDecoration:"none" }}>
                                <Eye size={13} /> View
                              </a>
                              {r.status !== "APPROVED" && r.status !== "REJECTED" && (
                                <button onClick={() => setReviewModal(r)} style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"5px 12px", borderRadius:6, fontSize:12, fontWeight:600, background:C.ok+"22", color:C.ok, border:`1px solid ${C.ok}44`, cursor:"pointer" }}>
                                  Review
                                </button>
                              )}
                              <a href={r.storage_url} download style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:6, fontSize:12, background:"transparent", color:C.sub, border:`1px solid ${C.border}`, textDecoration:"none" }}>
                                <Download size={13} />
                              </a>
                            </>
                          ) : (
                            <span style={{ color:C.sub, fontSize:12, opacity:0.5 }}>{pdfOk?"No PDF":"No access"}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <p style={{ color:C.sub, fontSize:12, marginTop:12 }}>
          Showing {visible.length} of {reports.length} report{reports.length!==1?"s":""}
        </p>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(4,7,14,0.6)",
          backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          padding: 16,
        }}>
          <div style={{
            width: 480, maxWidth: "94vw",
            background: "#141D2C", border: `1px solid rgba(255,255,255,0.08)`,
            borderRadius: 16, padding: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}>
            <h3 style={{ margin: "0 0 14px", color: C.text }}>Review Report ({reviewModal.report_uid || reviewModal.id})</h3>
            <p style={{ color: C.sub, fontSize: 13.5, marginBottom: 18 }}>
              Patient: <strong style={{ color: C.text }}>{reviewModal.patient_name}</strong>
            </p>
            
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: C.sub, marginBottom: 6 }}>Decision</label>
              <div style={{ display: "flex", gap: 10 }}>
                <button 
                  onClick={() => setDecision("APPROVED")}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid", borderColor: decision === "APPROVED" ? C.ok : C.border, background: decision === "APPROVED" ? C.ok + "22" : "transparent", color: decision === "APPROVED" ? C.ok : C.sub }}
                >
                  Approve
                </button>
                <button 
                  onClick={() => setDecision("REJECTED")}
                  style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid", borderColor: decision === "REJECTED" ? C.danger : C.border, background: decision === "REJECTED" ? C.danger + "22" : "transparent", color: decision === "REJECTED" ? C.danger : C.sub }}
                >
                  Reject
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, color: C.sub, marginBottom: 6 }}>Comments</label>
              <textarea 
                value={comments} 
                onChange={(e) => setComments(e.target.value)} 
                placeholder="Enter review comments or medical notes..."
                style={{ width: "100%", height: 80, padding: "10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#101724", color: C.text, fontSize: 13, resize: "none", outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button 
                onClick={() => setReviewModal(null)}
                style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", background: "transparent", color: C.text, border: `1px solid ${C.border}` }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  try {
                    const { submitReportReview } = await import("../services/api.js");
                    await submitReportReview(reviewModal.id || reviewModal.report_id, decision, comments);
                    setReviewModal(null);
                    setDecision("APPROVED");
                    setComments("");
                    load();
                  } catch (e) {
                    alert(e.message || "Failed to submit review");
                  }
                }}
                disabled={!decision}
                style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: `linear-gradient(135deg, ${C.blue1}, ${C.blue2})`, color: "#FFF", border: "none" }}
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
