import React, { useState, useEffect } from "react";
import {
  Activity, Users, Building2, Stethoscope, Shield, FileText,
  ChevronDown, LogOut, Search, Plus, X, Edit2, Trash2, Eye,
  Wifi, WifiOff, AlertTriangle, UserPlus, MapPin, ClipboardList,
  Settings, ArrowLeft, Menu, HeartPulse
} from "lucide-react";
import ReportsSection from "./pages/ReportsSection.jsx";
import { sendOTP, verifyOTP } from "./services/api.js";

/* ---------------------------------------------------------
   DeckLink — Clinician Portal
   Palette: deep navy base + steel-blue accent gradient
   Glassmorphic panels, responsive mobile nav
--------------------------------------------------------- */

const COLORS = {
  bg: "#0B1220",
  panel: "rgba(20, 29, 44, 0.72)",
  panelSolid: "#141D2C",
  panel2: "#101724",
  glass: "rgba(11, 18, 32, 0.82)",
  border: "#263042",
  borderGlass: "rgba(255,255,255,0.08)",
  orange1: "#2E7DB8",   // primary accent — steel blue
  orange2: "#3E97D6",
  text: "#E6EAF0",
  sub: "#7C8AA0",
  danger: "#D9534F",
  ok: "#3FA772",
  warn: "#C99A3C",
};

const uid = () => Math.random().toString(36).slice(2, 10);
const LS_KEY = "decklink_data_v1";
const SS_KEY = "decklink_session_v1";

const ROLES = [
  "Sr. Clinical Doctor",
  "Jr. Clinical Doctor",
  "Sr. Admin",
  "Jr. Admin",
  "Employee",
  "Receptionist",
];

const seedData = () => ({
  orgs: [
    { id: "org1", name: "Faridabad Sleep & Respiratory Clinic", type: "HCP Head" },
  ],
  users: {
    org1: [
      { id: uid(), name: "Dr. Aditi Sharma", role: "Sr. Clinical Doctor", email: "aditi.sharma@fsrc.in", phone: "9810000001", providerId: "PRV-1001", password: "123" },
      { id: uid(), name: "Rahul Mehta", role: "HCP Head", email: "rahul.mehta@fsrc.in", phone: "9810000002", providerId: "", password: "123" },
      { id: uid(), name: "Priya Nair", role: "Receptionist", email: "priya.nair@fsrc.in", phone: "9810000003", providerId: "", password: "123" },
    ],
  },
  physicians: {
    org1: [
      { id: uid(), name: "Dr. Karan Bose", speciality: "Pulmonology", hospital: "Apollo Gurgaon", phone: "9911112222", access: "Read-only" },
      { id: uid(), name: "Dr. Sunita Rao", speciality: "Sleep Medicine", hospital: "Fortis Faridabad", phone: "9911113333", access: "Read-only" },
    ],
  },
  insurers: {
    org1: [
      { id: uid(), name: "Star Health", policyPortal: "portal.starhealth.in", contact: "billing@starhealth.in" },
    ],
  },
  locations: {
    org1: [
      { id: uid(), name: "Main Clinic", address: "Sector 15, Faridabad, HR" },
    ],
  },
  patients: {
    org1: [
      { id: uid(), name: "Vikram Chauhan", age: 54, therapy: "CPAP", connectivity: "Wireless", ahi: 3.2, usageHrs: 6.5, status: "Compliant", alert: null },
      { id: uid(), name: "Meena Kulkarni", age: 61, therapy: "BiPAP", connectivity: "Wireless", ahi: 8.9, usageHrs: 3.1, status: "Attention", alert: "Low usage 3 nights" },
      { id: uid(), name: "Ashok Verma", age: 47, therapy: "CPAP", connectivity: "SD Card", ahi: 1.8, usageHrs: 7.2, status: "Compliant", alert: null },
      { id: uid(), name: "Ritu Malhotra", age: 39, therapy: "BiPAP-Ventilation", connectivity: "Wireless", ahi: 12.4, usageHrs: 2.0, status: "Critical", alert: "High residual AHI + low adherence" },
      { id: uid(), name: "Suresh Iyer", age: 66, therapy: "CPAP", connectivity: "Wireless", ahi: 2.1, usageHrs: 6.9, status: "Compliant", alert: null },
    ],
  },
  referrals: {
    org1: [
      { id: uid(), patient: "Neha Kapoor", referredBy: "Dr. Karan Bose", reason: "Suspected OSA", date: "2026-06-28", status: "Pending" },
    ],
  },
  devices: {
    org1: [
      { id: "dev1", serial: "0000", model: "RhythmUltra V1" },
      { id: "dev2", serial: "0010", model: "RhythmUltra V1" },
      { id: "dev3", serial: "A010", model: "RhythmUltra V1" },
      { id: "dev4", serial: "A057", model: "RhythmUltra V1" },
    ],
  },
});

function loadData() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const seeded = seedData();
  localStorage.setItem(LS_KEY, JSON.stringify(seeded));
  return seeded;
}
function saveData(d) {
  localStorage.setItem(LS_KEY, JSON.stringify(d));
}
function loadSession() {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}
function saveSession(s) {
  sessionStorage.setItem(SS_KEY, JSON.stringify(s));
}
function clearSession() {
  sessionStorage.removeItem(SS_KEY);
}

/* ---------------- Shared UI bits ---------------- */

function Btn({ children, onClick, variant = "primary", style, type = "button", disabled }) {
  const base = {
    padding: "10px 18px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent",
    transition: "all .15s",
    opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: {
      background: `linear-gradient(135deg, ${COLORS.orange1}, ${COLORS.orange2})`,
      color: "#FFFFFF",
    },
    ghost: {
      background: "transparent",
      color: COLORS.text,
      border: `1px solid ${COLORS.border}`,
    },
    danger: {
      background: "transparent",
      color: COLORS.danger,
      border: `1px solid ${COLORS.danger}55`,
    },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: COLORS.sub, marginBottom: 6, letterSpacing: 0.3 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.panel2,
  color: COLORS.text,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(4,7,14,0.6)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      padding: 16,
    }}>
      <div style={{
        width, maxWidth: "94vw", maxHeight: "85vh", overflowY: "auto",
        background: COLORS.glass, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${COLORS.borderGlass}`,
        borderRadius: 16, padding: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, color: COLORS.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.sub, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    Compliant: { c: COLORS.ok, bg: "#3DDC9722" },
    Attention: { c: COLORS.warn, bg: "#FFC65C22" },
    Critical: { c: COLORS.danger, bg: "#FF5C7A22" },
    Pending: { c: COLORS.warn, bg: "#FFC65C22" },
  };
  const s = map[status] || { c: COLORS.sub, bg: "#8A96AE22" };
  return (
    <span style={{
      color: s.c, background: s.bg, fontSize: 12, fontWeight: 600,
      padding: "4px 10px", borderRadius: 999,
    }}>
      {status}
    </span>
  );
}

/* ---------------- Landing / Org / Role / Auth flow ---------------- */

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
      * { font-family: 'Outfit', system-ui, sans-serif; box-sizing: border-box; }
      ::selection { background: ${COLORS.orange1}55; }
      input:disabled { opacity: 0.6; }
      select { appearance: none; }
    `}</style>
  );
}

function Logo({ small }) {
  const height = small ? 30 : 48;
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: small ? 0 : 8 }}>
      <img src="/logo.png" alt="DeckLink Logo" style={{ height, objectFit: "contain" }} />
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundImage: "linear-gradient(rgba(11, 18, 32, 0.45), rgba(11, 18, 32, 0.65)), url('/login-bg.png')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      fontFamily: "'Outfit', system-ui, sans-serif",
    }}>
      <GlobalStyles />
      {children}
    </div>
  );
}

const cardStyle = {
  background: "rgba(11, 18, 32, 0.82)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "24px",
  padding: "36px 40px",
  width: "100%",
  maxWidth: "460px",
  boxShadow: "0 32px 64px rgba(0,0,0,0.65)",
  backdropFilter: "blur(20px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center"
};

function Landing({ onNewOrg, onExisting }) {
  return (
    <Centered>
      <div style={cardStyle}>
        <Logo />
        <p style={{ color: COLORS.sub, marginBottom: 32, textAlign: "center", fontSize: 14 }}>
          CPAP / BiPAP therapy monitoring — clinician portal
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          <Btn onClick={onNewOrg} style={{ width: "100%" }}>Register new organisation</Btn>
          <Btn variant="ghost" onClick={onExisting} style={{ width: "100%" }}>Sign in to existing organisation</Btn>
        </div>
      </div>
    </Centered>
  );
}

function OrgSelect({ data, onSelect, onDelete, onBack, onCreateNew }) {
  return (
    <Centered>
      <div style={cardStyle}>
        <Logo />
        <div style={{ width: "100%", marginTop: 20 }}>
          <h3 style={{ color: COLORS.text, fontSize: 16, marginBottom: 14, textAlign: "center" }}>Select organisation</h3>
          {data.orgs.length === 0 && <p style={{ color: COLORS.sub, fontSize: 14, textAlign: "center", marginBottom: 14 }}>No organisations yet.</p>}
          <div style={{ maxHeight: "240px", overflowY: "auto", width: "100%", paddingRight: 4, marginBottom: 14 }}>
            {data.orgs.map((o) => (
              <div key={o.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: COLORS.panel2, border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: "12px 14px", marginBottom: 10, gap: 10
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                  <div style={{ color: COLORS.sub, fontSize: 11.5 }}>{o.type}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn onClick={() => onSelect(o)} style={{ padding: "6px 12px", fontSize: 12.5 }}>Continue</Btn>
                  <button onClick={() => onDelete(o.id)} style={{
                    background: "none", border: `1px solid ${COLORS.danger}55`,
                    borderRadius: 8, color: COLORS.danger, cursor: "pointer", padding: "0 8px",
                  }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <Btn variant="ghost" onClick={onBack} style={{ padding: "8px 14px", fontSize: 13 }}><ArrowLeft size={13} style={{ marginRight: 4, verticalAlign: -1 }} />Back</Btn>
            <Btn variant="ghost" onClick={onCreateNew} style={{ padding: "8px 14px", fontSize: 13 }}>+ New Org</Btn>
          </div>
        </div>
      </div>
    </Centered>
  );
}

function RoleCard({ label, desc, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: "100%", background: COLORS.panel2, border: `1px solid ${COLORS.border}`,
      borderRadius: 12, padding: 18, cursor: "pointer",
      transition: "border-color .15s",
    }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.orange1}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.border}
    >
      <div style={{ color: COLORS.orange1, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ color: COLORS.sub, fontSize: 12.5, lineHeight: 1.4 }}>{desc}</div>
    </div>
  );
}

function RoleSelect({ onPick, onBack }) {
  return (
    <Centered>
      <div style={cardStyle}>
        <Logo />
        <h3 style={{ color: COLORS.text, fontSize: 16, margin: "20px 0 16px" }}>Continue as</h3>
        <div style={{ display: "flex", gap: 14, flexDirection: "column", width: "100%", marginBottom: 20 }}>
          <RoleCard label="Doctor Head" desc="Clinical lead — full patient & clinical data access" onClick={() => onPick("Doctor Head")} />
          <RoleCard label="HCP Head" desc="Admin lead — organisation, staff & compliance management" onClick={() => onPick("HCP Head")} />
        </div>
        <Btn variant="ghost" onClick={onBack} style={{ width: "100%" }}>
          <ArrowLeft size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Back
        </Btn>
      </div>
    </Centered>
  );
}

function TabBtn({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 13, cursor: "pointer",
      border: `1px solid ${active ? COLORS.orange1 : COLORS.border}`,
      background: active ? `${COLORS.orange1}18` : "transparent",
      color: active ? COLORS.orange1 : COLORS.sub, fontWeight: 600,
    }}>
      {children}
    </button>
  );
}

function AuthForm({ mode, role, onSubmit, onSwitchMode, onBack, pendingRole }) {
  const [tab, setTab] = useState("password");
  const [form, setForm] = useState({
    orgName: "", name: "", email: "", phone: "", password: "", providerId: "", city: "", otp: "",
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [devOtp, setDevOtp] = useState(null); // shown in UI when backend is offline

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSendOTP = async () => {
    if (!form.phone) {
      setOtpError("Please enter your phone number.");
      return;
    }
    setOtpLoading(true); setOtpError(null); setDevOtp(null);
    try {
      const res = await sendOTP(form.phone);
      setOtpSent(true);
      // Dev mode: backend offline, OTP is returned directly
      if (res?.devMode && res?.otp) {
        setDevOtp(res.otp);
      }
    } catch (err) {
      setOtpError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!form.otp) {
      setOtpError("Please enter the OTP.");
      return;
    }
    setOtpLoading(true); setOtpError(null);
    try {
      const sessionData = await verifyOTP(form.phone, form.otp);
      // sessionData is already fully built — pass it directly to goDashboard
      onSubmit({ ...sessionData, isOtpVerified: true });
    } catch (err) {
      setOtpError(err.message || "Invalid or expired OTP.");
    } finally {
      setOtpLoading(false);
    }
  };


  return (
    <Centered>
      <div style={{ ...cardStyle, maxWidth: "500px" }}>
        <Logo />
        <div style={{ width: "100%", marginTop: 16 }}>
          <h3 style={{ color: COLORS.text, fontSize: 17, marginBottom: 4, textAlign: "center" }}>
            {mode === "signup" ? "Create Account" : "Sign In"}
          </h3>
          <p style={{ color: COLORS.sub, fontSize: 13, marginBottom: 18, textAlign: "center" }}>
            {mode === "signup" ? `${role} — ${form.orgName || "Organisation"}` : `Access ${pendingRole?.org?.name || "Organisation"}`}
          </p>

          {mode === "login" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <TabBtn active={tab === "password"} onClick={() => setTab("password")}>Name & Password</TabBtn>
              <TabBtn active={tab === "phone"} onClick={() => setTab("phone")}>Phone OTP</TabBtn>
            </div>
          )}

          <div style={{ maxHeight: "360px", overflowY: "auto", paddingRight: 4, marginBottom: 18 }}>
            {mode === "signup" && (
              <>
                <Field label="Organisation Name">
                  <input style={inputStyle} value={form.orgName} onChange={set("orgName")} placeholder="e.g. Faridabad Sleep & Respiratory Clinic" />
                </Field>
                <Field label="Full Name">
                  <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Dr. / Mr. / Ms. full name" />
                </Field>
                <Field label="Email">
                  <input style={inputStyle} value={form.email} onChange={set("email")} placeholder="name@clinic.in" />
                </Field>
                <Field label="Phone Number">
                  <input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="10-digit mobile" />
                </Field>
                {role === "Doctor Head" && (
                  <Field label="Provider ID">
                    <input style={inputStyle} value={form.providerId} onChange={set("providerId")} placeholder="Clinical provider identifier" />
                  </Field>
                )}
                <Field label="City">
                  <input style={inputStyle} value={form.city} onChange={set("city")} placeholder="City" />
                </Field>
                <Field label="Password">
                  <input type="password" style={inputStyle} value={form.password} onChange={set("password")} placeholder="Create a password" />
                </Field>
              </>
            )}

            {mode === "login" && tab === "password" && (
              <>
                <Field label="Name">
                  <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Your name" />
                </Field>
                <Field label="Password">
                  <input type="password" style={inputStyle} value={form.password} onChange={set("password")} placeholder="Password" />
                </Field>
              </>
            )}
            {mode === "login" && tab === "phone" && (
              <>
                <Field label="Phone Number">
                  <input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="10-digit mobile" disabled={otpSent} />
                </Field>
              {otpSent && (
                <Field label="Enter OTP">
                  <input style={inputStyle} value={form.otp} onChange={set("otp")} placeholder="e.g. 1234" maxLength={6} />
                </Field>
              )}
              {/* Dev mode: show OTP inline when backend is offline */}
              {devOtp && (
                <div style={{
                  background: "rgba(63, 167, 114, 0.15)",
                  border: "1px solid rgba(63, 167, 114, 0.4)",
                  borderRadius: 8, padding: "10px 14px", marginBottom: 12,
                  fontSize: 13, color: COLORS.ok, lineHeight: 1.5,
                }}>
                  <strong>🧪 Dev Mode</strong> — Backend offline. Your OTP is:{" "}
                  <strong style={{ fontSize: 16, letterSpacing: 2 }}>{devOtp}</strong>
                  <span style={{ color: COLORS.sub, fontSize: 12, display: "block", marginTop: 4 }}>
                    Or type any 4–6 digit number to log in.
                  </span>
                </div>
              )}
              {otpError && (
                <div style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>
                  {otpError}
                </div>
              )}
              </>
            )}
          </div>

          {mode === "login" && tab === "phone" ? (
            !otpSent ? (
              <Btn onClick={handleSendOTP} disabled={otpLoading} style={{ width: "100%", minHeight: "44px" }}>
                {otpLoading ? "Sending..." : "Send Verification OTP"}
              </Btn>
            ) : (
              <Btn onClick={handleVerifyOTP} disabled={otpLoading} style={{ width: "100%", minHeight: "44px" }}>
                {otpLoading ? "Verifying..." : "Verify & Sign In"}
              </Btn>
            )
          ) : (
            <Btn onClick={() => onSubmit(form)} style={{ width: "100%", minHeight: "44px" }}>
              {mode === "signup" ? "Create Account" : "Sign In"}
            </Btn>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <Btn variant="ghost" onClick={onBack} style={{ padding: "8px 12px" }}><ArrowLeft size={13} style={{ marginRight: 4, verticalAlign: -1 }} />Back</Btn>
            <button onClick={onSwitchMode} style={{ background: "none", border: "none", color: COLORS.orange1, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {mode === "signup" ? "Sign in instead" : "Create account"}
            </button>
          </div>
        </div>
      </div>
    </Centered>
  );
}

/* ---------------- Dashboard shell + top nav ---------------- */

const NAV = {
  patients: [
    { key: "all", label: "All therapy" },
    { key: "wireless", label: "Wireless" },
    { key: "action", label: "Action Groups" },
    { key: "ventilation", label: "Ventilation patients" },
    { key: "referrals", label: "Referrals" },
  ],
  business: [
    { key: "modules", label: "Module management" },
    { key: "compliance", label: "Compliance exports" },
  ],
  admin: [
    { key: "org", label: "Organisation Details" },
    { key: "locations", label: "Locations" },
    { key: "users", label: "Users" },
    { key: "physicians", label: "Physicians" },
    { key: "insurers", label: "Insurers" },
    { key: "devices", label: "ECG Devices" },
    { key: "complianceOptions", label: "Compliance options" },
  ],
  ecgReports: [
    { key: "all", label: "All Reports" },
    { key: "pending", label: "Pending" },
    { key: "assigned", label: "Assigned" },
    { key: "reviewed", label: "Reviewed" },
  ],
};

function NavDropdown({ label, icon, items, onPick, active }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button style={{
        display: "flex", alignItems: "center", gap: 6, background: "none",
        border: "none", color: active ? COLORS.orange1 : COLORS.text,
        fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "8px 4px",
      }}>
        {icon}{label}<ChevronDown size={14} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, background: COLORS.panelSolid,
          border: `1px solid ${COLORS.border}`, borderRadius: 10, minWidth: 200,
          padding: 6, zIndex: 50, boxShadow: "0 12px 24px rgba(0,0,0,0.4)",
        }}>
          {items.map((it) => (
            <div key={it.key} onClick={() => { onPick(it.key); setOpen(false); }} style={{
              padding: "10px 12px", borderRadius: 7, fontSize: 13.5, color: COLORS.text,
              cursor: "pointer", fontWeight: 500,
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = COLORS.panel2}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {it.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

function TopBar({ session, view, setView, onLogout }) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const glassBar = {
    background: COLORS.glass,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderBottom: `1px solid ${COLORS.borderGlass}`,
  };

  if (isMobile) {
    return (
      <div style={{ position: "sticky", top: 0, zIndex: 60, ...glassBar }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px",
        }}>
          <Logo small />
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8,
            color: COLORS.text, padding: "8px 10px", cursor: "pointer",
          }}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {menuOpen && (
          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            <MobileNavGroup label="Patients" icon={<Users size={15} />} items={NAV.patients}
              onPick={(k) => { setView({ section: "patients", tab: k }); setMenuOpen(false); }} />
            <MobileNavGroup label="Business" icon={<Building2 size={15} />} items={NAV.business}
              onPick={(k) => { setView({ section: "business", tab: k }); setMenuOpen(false); }} />
            <MobileNavGroup label="Administration" icon={<Shield size={15} />} items={NAV.admin}
              onPick={(k) => { setView({ section: "admin", tab: k }); setMenuOpen(false); }} />
            <button
              onClick={() => { setView({ section: "ecgReports", tab: "all" }); setMenuOpen(false); }}
              style={{
                textAlign: "left", background: "none", border: "none",
                color: view.section === "ecgReports" ? COLORS.orange2 : COLORS.text,
                fontSize: 14, fontWeight: 600, padding: "10px 4px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              ECG Reports
            </button>
            <button onClick={() => { setView({ section: "profile" }); setMenuOpen(false); }} style={{
              textAlign: "left", background: "none", border: "none", color: COLORS.text,
              fontSize: 14, fontWeight: 600, padding: "10px 4px", cursor: "pointer",
            }}>
              My profile
            </button>
            <div style={{ fontSize: 12.5, color: COLORS.sub, padding: "6px 4px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              {session.userName} · <span style={{ color: COLORS.orange2 }}>{session.role}</span>
              {session.role !== "Doctor Head" && session.role !== "HCP Head" && (
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                  textTransform: "uppercase", background: COLORS.danger + "22",
                  color: COLORS.danger, padding: "2px 6px", borderRadius: 4,
                }}>
                  View Only
                </span>
              )}
            </div>
            <button onClick={onLogout} style={{
              background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8,
              color: COLORS.sub, cursor: "pointer", padding: "10px 12px", display: "flex",
              alignItems: "center", gap: 6, fontSize: 13, marginTop: 4,
            }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 28px", ...glassBar,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        <Logo small />
        <NavDropdown
          label="Patients" icon={<Users size={15} style={{ marginRight: 2 }} />}
          items={NAV.patients} active={view.section === "patients"}
          onPick={(k) => setView({ section: "patients", tab: k })}
        />
        <NavDropdown
          label="Business" icon={<Building2 size={15} style={{ marginRight: 2 }} />}
          items={NAV.business} active={view.section === "business"}
          onPick={(k) => setView({ section: "business", tab: k })}
        />
        <NavDropdown
          label="Administration" icon={<Shield size={15} style={{ marginRight: 2 }} />}
          items={NAV.admin} active={view.section === "admin"}
          onPick={(k) => setView({ section: "admin", tab: k })}
        />
        <div
          onClick={() => setView({ section: "ecgReports", tab: "all" })}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            color: view.section === "ecgReports" ? COLORS.orange2 : COLORS.text,
            fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "8px 4px",
          }}
        >
          ECG Reports
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div onClick={() => setView({ section: "profile" })} style={{
          cursor: "pointer", fontSize: 13.5, color: view.section === "profile" ? COLORS.orange2 : COLORS.text,
          fontWeight: 600,
        }}>
          My profile
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.sub, display: "flex", alignItems: "center", gap: 6 }}>
          {session.userName} · <span style={{ color: COLORS.orange2 }}>{session.role}</span>
          {session.role !== "Doctor Head" && session.role !== "HCP Head" && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              textTransform: "uppercase", background: COLORS.danger + "22",
              color: COLORS.danger, padding: "2px 6px", borderRadius: 4,
            }}>
              View Only
            </span>
          )}
        </div>
        <button onClick={onLogout} style={{
          background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8,
          color: COLORS.sub, cursor: "pointer", padding: "7px 12px", display: "flex",
          alignItems: "center", gap: 6, fontSize: 13,
        }}>
          <LogOut size={14} /> Logout
        </button>
      </div>
    </div>
  );
}

function MobileNavGroup({ label, icon, items, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "none", border: "none", color: COLORS.text, fontSize: 14, fontWeight: 600,
        padding: "10px 4px", cursor: "pointer",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{icon}{label}</span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div style={{ paddingLeft: 22, display: "flex", flexDirection: "column" }}>
          {items.map((it) => (
            <button key={it.key} onClick={() => onPick(it.key)} style={{
              textAlign: "left", background: "none", border: "none", color: COLORS.sub,
              fontSize: 13.5, padding: "8px 4px", cursor: "pointer",
            }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Patients section ---------------- */

function PatientsSection({ tab }) {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const { getPatients } = await import("./services/api.js");
        const res = await getPatients(q);
        const raw = res.data || res.patients || res || [];
        setPatients(raw);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [q]);

  if (tab === "referrals") {
    return (
      <Panel title="Referrals" icon={<ClipboardList size={18} />}>
        <div style={{ color: COLORS.sub, fontSize: 13.5, padding: "20px 0", textAlign: "center" }}>No referrals yet.</div>
      </Panel>
    );
  }

  let filtered = patients;
  const titleMap = {
    all: "All therapy",
    wireless: "Wireless patients",
    action: "Action Groups — needs attention",
    ventilation: "Ventilation patients",
  };

  return (
    <Panel title={titleMap[tab] || "Patients"} icon={<Users size={18} />}
      right={
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.panel2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 10px" }}>
          <Search size={14} color={COLORS.sub} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients"
            style={{ background: "none", border: "none", outline: "none", color: COLORS.text, fontSize: 13 }} />
        </div>
      }
    >
      {loading ? (
        <div style={{ color: COLORS.sub, textAlign: "center", padding: "20px 0" }}>Loading patients...</div>
      ) : error ? (
        <div style={{ color: COLORS.danger, textAlign: "center", padding: "20px 0" }}>{error}</div>
      ) : (
        <Table
          cols={["Patient", "Age", "Therapy", "Connectivity", "AHI", "Usage (hrs/night)", "Status", "Alert"]}
          rows={filtered.map((p) => {
            const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown Patient";
            const age = p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : "—";
            const therapy = p.notes || "ECG Therapy";
            const connectivity = p.phone || "Wireless";
            
            return [
              name, 
              age, 
              therapy,
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Wifi size={13} color={COLORS.ok} />
                {connectivity}
              </span>,
              "5.2", 
              "6.5", 
              <StatusPill status="Compliant" />,
              <span style={{ color: COLORS.sub }}>—</span>,
            ];
          })}
          empty="No patients match this view."
        />
      )}
    </Panel>
  );
}

/* ---------------- Business section ---------------- */

function BusinessSection({ tab }) {
  if (tab === "modules") {
    return (
      <Panel title="Module management" icon={<Settings size={18} />}>
        {["CPAP Monitoring", "BiPAP Monitoring", "Ventilation Add-on", "Sleep Apnea Screening"].map((m) => (
          <div key={m} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 16px", border: `1px solid ${COLORS.border}`, borderRadius: 10, marginBottom: 10,
            background: COLORS.panel2,
          }}>
            <span style={{ color: COLORS.text, fontSize: 14 }}>{m}</span>
            <span style={{ color: COLORS.ok, fontSize: 12.5, fontWeight: 600 }}>Active</span>
          </div>
        ))}
      </Panel>
    );
  }
  return (
    <Panel title="Compliance exports" icon={<FileText size={18} />}>
      <p style={{ color: COLORS.sub, fontSize: 13.5, marginBottom: 16 }}>
        Generate adherence/compliance reports for insurer reimbursement.
      </p>
      <Btn>Export compliance report (CSV)</Btn>
    </Panel>
  );
}

/* ---------------- Administration section ---------------- */

function AdminSection({ tab, orgData, orgId, setOrgData, isRestricted, onRestrictedClick }) {
  const [modal, setModal] = useState(null); // {type, item}
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadDevices = async () => {
    try {
      const { getDevices } = await import("./services/api.js");
      const data = await getDevices();
      setDevices(data || []);
    } catch (e) {
      console.error("Failed to load devices:", e);
    }
  };

  const loadUsers = async () => {
    try {
      const { getUsers } = await import("./services/api.js");
      const data = await getUsers();
      setUsers(data || []);
    } catch (e) {
      console.error("Failed to load users:", e);
    }
  };

  useEffect(() => {
    if (tab === "devices") {
      loadDevices();
    } else if (tab === "users") {
      loadUsers();
    }
  }, [tab, modal]);

  const commit = (next) => {
    setOrgData(next);
    saveData(next);
  };

  if (tab === "org") {
    const org = orgData.orgs.find((o) => o.id === orgId);
    return (
      <Panel title="Organisation Details" icon={<Building2 size={18} />}>
        <Field label="Organisation name"><input style={inputStyle} defaultValue={org?.name || "CardioX Organization"} disabled={isRestricted} /></Field>
        <Field label="Organisation type"><input style={inputStyle} defaultValue={org?.type || "HCP"} disabled /></Field>
        <Btn onClick={isRestricted ? onRestrictedClick : undefined} disabled={isRestricted} style={isRestricted ? { background: "#cccccc", color: "#666666" } : undefined}>Save changes</Btn>
      </Panel>
    );
  }

  if (tab === "locations") {
    const locs = orgData.locations[orgId] || [];
    return (
      <Panel title="Locations" icon={<MapPin size={18} />} right={<Btn onClick={isRestricted ? onRestrictedClick : () => setModal({ type: "location" })} style={isRestricted ? { background: "#cccccc", color: "#666666" } : undefined}><Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Add location</Btn>}>
        <Table cols={["Name", "Address"]} rows={locs.map((l) => [l.name, l.address])} empty="No locations added." />
        {modal?.type === "location" && (
          <SimpleAddModal title="Add location" fields={[{ k: "name", label: "Location name" }, { k: "address", label: "Address" }]}
            onClose={() => setModal(null)}
            onSave={(vals) => {
              const next = { ...orgData };
              next.locations[orgId] = [...locs, { id: uid(), ...vals }];
              commit(next); setModal(null);
            }}
          />
        )}
      </Panel>
    );
  }

  if (tab === "insurers") {
    const insurers = orgData.insurers[orgId] || [];
    return (
      <Panel title="Insurers" icon={<Shield size={18} />} right={<Btn onClick={isRestricted ? onRestrictedClick : () => setModal({ type: "insurer" })} style={isRestricted ? { background: "#cccccc", color: "#666666" } : undefined}><Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Add insurer</Btn>}>
        <Table cols={["Name", "Policy portal", "Contact"]} rows={insurers.map((i) => [i.name, i.policyPortal, i.contact])} empty="No insurers added." />
        {modal?.type === "insurer" && (
          <SimpleAddModal title="Add insurer" fields={[{ k: "name", label: "Insurer name" }, { k: "policyPortal", label: "Policy portal URL" }, { k: "contact", label: "Contact email" }]}
            onClose={() => setModal(null)}
            onSave={(vals) => {
              const next = { ...orgData };
              next.insurers[orgId] = [...insurers, { id: uid(), ...vals }];
              commit(next); setModal(null);
            }}
          />
        )}
      </Panel>
    );
  }

  if (tab === "devices") {
    return (
      <Panel title="ECG Devices" icon={<Activity size={18} />} right={<Btn onClick={isRestricted ? onRestrictedClick : () => setModal({ type: "device" })} style={isRestricted ? { background: "#cccccc", color: "#666666" } : undefined}><Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Register Device</Btn>}>
        <p style={{ color: COLORS.sub, fontSize: 12.5, marginBottom: 12 }}>
          Register clinical ECG hardware devices (by serial number) to link S3 report folders.
        </p>
        <Table cols={["Serial Number", "Model / Name", ""]} rows={devices.map((d) => [
          d.rhythmulta_serial || d.machine_serial || d.serial, d.device_name || d.model,
          <button onClick={isRestricted ? onRestrictedClick : async () => {
            try {
              const { deleteDevice } = await import("./services/api.js");
              await deleteDevice(d.id);
              loadDevices();
            } catch (e) {
              alert(e.message || "Failed to delete device");
            }
          }} style={{ background: "none", border: "none", color: isRestricted ? COLORS.sub + "55" : COLORS.danger, cursor: "pointer" }}>
            <Trash2 size={14} />
          </button>
        ])} empty="No devices registered." />
        {modal?.type === "device" && (
          <SimpleAddModal title="Register Device" fields={[{ k: "serial", label: "Device Serial Number (e.g. A010, A057)" }, { k: "model", label: "Model / Description" }]}
            onClose={() => setModal(null)}
            onSave={async (vals) => {
              try {
                const { registerDevice } = await import("./services/api.js");
                await registerDevice(vals.serial, vals.model);
                setModal(null);
                loadDevices();
              } catch (e) {
                alert(e.message || "Failed to register device");
              }
            }}
          />
        )}
      </Panel>
    );
  }

  if (tab === "complianceOptions") {
    return (
      <Panel title="Compliance options" icon={<FileText size={18} />}>
        <Field label="Minimum usage hours/night for compliance">
          <input style={inputStyle} defaultValue="4" disabled={isRestricted} />
        </Field>
        <Field label="Minimum compliant nights (of 30)">
          <input style={inputStyle} defaultValue="21" disabled={isRestricted} />
        </Field>
        <Btn onClick={isRestricted ? onRestrictedClick : undefined} disabled={isRestricted} style={isRestricted ? { background: "#cccccc", color: "#666666" } : undefined}>Save options</Btn>
      </Panel>
    );
  }

  if (tab === "physicians") {
    const physicians = orgData.physicians[orgId] || [];
    return (
      <Panel title="Physicians" icon={<Stethoscope size={18} />}
        right={<Btn onClick={isRestricted ? onRestrictedClick : () => setModal({ type: "physician" })} style={isRestricted ? { background: "#cccccc", color: "#666666" } : undefined}><Plus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Add physician</Btn>}
      >
        <p style={{ color: COLORS.sub, fontSize: 12.5, marginBottom: 12 }}>
          External referring physicians — read-only access to their referred patients' data.
        </p>
        <Table
          cols={["Name", "Speciality", "Hospital", "Phone", "Access", ""]}
          rows={physicians.map((p) => [
            p.name, p.speciality, p.hospital, p.phone, p.access,
            <button onClick={isRestricted ? onRestrictedClick : () => {
              const next = { ...orgData };
              next.physicians[orgId] = physicians.filter((x) => x.id !== p.id);
              commit(next);
            }} style={{ background: "none", border: "none", color: isRestricted ? COLORS.sub + "55" : COLORS.danger, cursor: "pointer" }}>
              <Trash2 size={14} />
            </button>,
          ])}
          empty="No physicians added."
        />
        {modal?.type === "physician" && (
          <SimpleAddModal title="Add physician" fields={[
            { k: "name", label: "Full name" }, { k: "speciality", label: "Speciality" },
            { k: "hospital", label: "Hospital / clinic" }, { k: "phone", label: "Phone" },
          ]}
            onClose={() => setModal(null)}
            onSave={(vals) => {
              const next = { ...orgData };
              next.physicians[orgId] = [...physicians, { id: uid(), access: "Read-only", ...vals }];
              commit(next); setModal(null);
            }}
          />
        )}
      </Panel>
    );
  }

  // Users CRUD
  return (
    <Panel title="Users" icon={<Users size={18} />}
      right={<Btn onClick={isRestricted ? onRestrictedClick : () => setModal({ type: "userCreate" })} style={isRestricted ? { background: "#cccccc", color: "#666666" } : undefined}><UserPlus size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Add user</Btn>}
    >
      <Table
        cols={["Name", "Role", "Email", "Phone", ""]}
        rows={users.map((u) => [
          u.full_name || u.name, u.role_name || u.role, u.email, u.phone,
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setModal({ type: "userView", item: u })} style={{ background: "none", border: "none", color: COLORS.sub, cursor: "pointer" }}><Eye size={14} /></button>
            <button onClick={isRestricted ? onRestrictedClick : () => setModal({ type: "userEdit", item: u })} style={{ background: "none", border: "none", color: isRestricted ? COLORS.sub + "55" : COLORS.sub, cursor: "pointer" }}><Edit2 size={14} /></button>
            <button onClick={isRestricted ? onRestrictedClick : async () => {
              try {
                const { deleteUser } = await import("./services/api.js");
                await deleteUser(u.id);
                loadUsers();
              } catch (e) {
                alert(e.message || "Failed to delete user");
              }
            }} style={{ background: "none", border: "none", color: isRestricted ? COLORS.danger + "55" : COLORS.danger, cursor: "pointer" }}><Trash2 size={14} /></button>
          </div>,
        ])}
        empty="No users yet."
      />

      {modal?.type === "userCreate" && (
        <UserModal title="Add user" onClose={() => setModal(null)}
          onSave={async (vals) => {
            try {
              const { createUser } = await import("./services/api.js");
              await createUser(vals);
              setModal(null);
              loadUsers();
            } catch (e) {
              alert(e.message || "Failed to create user");
            }
          }}
        />
      )}
      {modal?.type === "userEdit" && (
        <UserModal title="Edit user" initial={modal.item} onClose={() => setModal(null)}
          onSave={async (vals) => {
            try {
              const { updateUser } = await import("./services/api.js");
              await updateUser(modal.item.id, vals);
              setModal(null);
              loadUsers();
            } catch (e) {
              alert(e.message || "Failed to update user");
            }
          }}
        />
      )}
      {modal?.type === "userView" && (
        <Modal title="User details" onClose={() => setModal(null)}>
          {Object.entries(modal.item).filter(([k]) => k !== "id").map(([k, v]) => (
            <div key={k} style={{ marginBottom: 10, fontSize: 13.5 }}>
              <span style={{ color: COLORS.sub, textTransform: "capitalize" }}>{k}: </span>
              <span style={{ color: COLORS.text }}>{String(v) || "—"}</span>
            </div>
          ))}
        </Modal>
      )}
    </Panel>
  );
}

function UserModal({ title, initial, onClose, onSave }) {
  const [form, setForm] = useState({
    name: initial?.name || "", role: initial?.role || ROLES[0],
    email: initial?.email || "", phone: initial?.phone || "", providerId: initial?.providerId || "",
    password: initial?.password || "123",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Full name"><input style={inputStyle} value={form.name} onChange={set("name")} /></Field>
      <Field label="Role">
        <select style={inputStyle} value={form.role} onChange={set("role")}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Email"><input style={inputStyle} value={form.email} onChange={set("email")} /></Field>
      <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={set("phone")} /></Field>
      <Field label="Provider ID (clinical roles)"><input style={inputStyle} value={form.providerId} onChange={set("providerId")} /></Field>
      <Field label="Password"><input type="password" style={inputStyle} value={form.password} onChange={set("password")} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(form)} disabled={!form.name}>Save</Btn>
      </div>
    </Modal>
  );
}

function SimpleAddModal({ title, fields, onClose, onSave }) {
  const init = {};
  fields.forEach((f) => init[f.k] = "");
  const [form, setForm] = useState(init);
  return (
    <Modal title={title} onClose={onClose}>
      {fields.map((f) => (
        <Field key={f.k} label={f.label}>
          <input style={inputStyle} value={form[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
        </Field>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(form)}>Save</Btn>
      </div>
    </Modal>
  );
}

/* ---------------- Profile section ---------------- */

function ProfileSection({ session, isRestricted, onRestrictedClick }) {
  const [tab, setTab] = useState("basic");
  return (
    <Panel title="My profile" icon={<Settings size={18} />}>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <TabBtn active={tab === "basic"} onClick={() => setTab("basic")}>Basic details</TabBtn>
        <TabBtn active={tab === "contact"} onClick={() => setTab("contact")}>Contact details</TabBtn>
      </div>
      {tab === "basic" ? (
        <>
          <Field label="Full name"><input style={inputStyle} defaultValue={session.userName} disabled={isRestricted} /></Field>
          <Field label="Role"><input style={inputStyle} defaultValue={session.role} disabled /></Field>
          <Field label="Username"><input style={inputStyle} defaultValue={session.userName?.replace(/\s+/g, "")} disabled /></Field>
          <Field label="Provider ID"><input style={inputStyle} defaultValue={session.providerId || ""} disabled={isRestricted} /></Field>
        </>
      ) : (
        <>
          <Field label="Email"><input style={inputStyle} defaultValue={session.email || ""} disabled={isRestricted} /></Field>
          <Field label="Phone"><input style={inputStyle} defaultValue={session.phone || ""} disabled={isRestricted} /></Field>
        </>
      )}
      <Btn onClick={isRestricted ? onRestrictedClick : undefined} disabled={isRestricted} style={isRestricted ? { background: "#cccccc", color: "#666666" } : undefined}>Save changes</Btn>
    </Panel>
  );
}

/* ---------------- Layout helpers ---------------- */

function Panel({ title, icon, right, children }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ padding: isMobile ? "18px 14px" : "28px 32px" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center",
        marginBottom: 20, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ color: COLORS.orange2 }}>{icon}</div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 19, color: COLORS.text, fontWeight: 700 }}>{title}</h2>
        </div>
        {right}
      </div>
      <div style={{
        background: COLORS.glass,
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${COLORS.borderGlass}`, borderRadius: 16,
        padding: isMobile ? 14 : 22,
        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      }}>
        {children}
      </div>
    </div>
  );
}

function Table({ cols, rows, empty }) {
  if (rows.length === 0) {
    return <div style={{ color: COLORS.sub, fontSize: 13.5, padding: "20px 0", textAlign: "center" }}>{empty}</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 560 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{ textAlign: "left", color: COLORS.sub, fontWeight: 600, padding: "0 10px 12px", fontSize: 12, letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${COLORS.borderGlass}` }}>
              {r.map((cell, j) => (
                <td key={j} style={{ padding: "12px 10px", color: COLORS.text, whiteSpace: "nowrap" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Root App ---------------- */

export default function App() {
  const [data, setData] = useState(loadData());
  const [session, setSession] = useState(loadSession());
  const [screen, setScreen] = useState(session ? "dashboard" : "landing");
  const [pendingRole, setPendingRole] = useState(null);
  const [authMode, setAuthMode] = useState("signup");
  const [view, setView] = useState({ section: "patients", tab: "all" });
  const [restrictedAlert, setRestrictedAlert] = useState(false);

  useEffect(() => { saveData(data); }, [data]);

  const goDashboard = (sess) => {
    saveSession(sess);
    setSession(sess);
    setScreen("dashboard");
  };

  if (screen === "landing") {
    return <Landing
      onNewOrg={() => { setAuthMode("signup"); setScreen("orgFlowNew"); }}
      onExisting={() => setScreen("orgSelect")}
    />;
  }

  if (screen === "orgSelect") {
    return <OrgSelect
      data={data}
      onBack={() => setScreen("landing")}
      onCreateNew={() => { setAuthMode("signup"); setScreen("orgFlowNew"); }}
      onSelect={(org) => { setAuthMode("login"); setScreen("auth"); setPendingRole({ org }); }}
      onDelete={(id) => {
        const next = { ...data, orgs: data.orgs.filter((o) => o.id !== id) };
        setData(next); saveData(next);
      }}
    />;
  }

  if (screen === "orgFlowNew") {
    return <RoleSelect
      onBack={() => setScreen("landing")}
      onPick={(role) => { setPendingRole({ role, isNew: true }); setAuthMode("signup"); setScreen("auth"); }}
    />;
  }

  if (screen === "roleSelect") {
    return <RoleSelect
      onBack={() => setScreen("orgSelect")}
      onPick={(role) => { setPendingRole({ ...pendingRole, role }); setScreen("auth"); }}
    />;
  }

  if (screen === "auth") {
    return <AuthForm
      mode={authMode}
      role={pendingRole?.role}
      pendingRole={pendingRole}
      onBack={() => setScreen(pendingRole?.isNew ? "orgFlowNew" : "orgSelect")}
      onSwitchMode={() => setAuthMode(authMode === "signup" ? "login" : "signup")}
      onSubmit={async (form) => {
        try {
          if (authMode === "signup") {
            const { registerOrg } = await import("./services/api.js");
            const sessionData = await registerOrg(form, pendingRole);
            goDashboard(sessionData);
          } else {
            if (form.isOtpVerified) {
              goDashboard(form); // session was saved during verification
              return;
            }
            const { loginWithPassword } = await import("./services/api.js");
            const sessionData = await loginWithPassword(form.name || form.email || form.phone, form.password);
            goDashboard(sessionData);
          }
        } catch (err) {
          alert(err.message || "Authentication failed");
        }
      }}
    />;
  }

  // dashboard
  const orgId = session.orgId;
  const isRestricted = session.role !== "Doctor Head" && session.role !== "HCP Head";
  const onRestrictedClick = () => setRestrictedAlert(true);

  return (
    <div style={{
      minHeight: "100vh",
      background: `
        radial-gradient(circle at 10% 10%, rgba(46,125,184,0.12), transparent 40%),
        radial-gradient(circle at 90% 90%, rgba(62,151,214,0.10), transparent 45%),
        linear-gradient(160deg, #0B1220 0%, #0E1524 55%, #0B1220 100%)
      `,
      fontFamily: "'Outfit', system-ui, sans-serif",
    }}>
      <GlobalStyles />
      <TopBar session={session} view={view} setView={setView} onLogout={() => {
        clearSession(); setSession(null); setScreen("landing");
      }} />
      {view.section === "patients" && <PatientsSection tab={view.tab} orgData={data} orgId={orgId} />}
      {view.section === "business" && <BusinessSection tab={view.tab} />}
      {view.section === "admin" && <AdminSection tab={view.tab} orgData={data} orgId={orgId} setOrgData={setData} isRestricted={isRestricted} onRestrictedClick={onRestrictedClick} />}
      {view.section === "ecgReports" && <ReportsSection session={session} orgData={data} orgId={orgId} />}
      {view.section === "profile" && <ProfileSection session={session} isRestricted={isRestricted} onRestrictedClick={onRestrictedClick} />}

      {restrictedAlert && (
        <Modal title="Access Restricted" onClose={() => setRestrictedAlert(false)}>
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <p style={{ color: COLORS.text, fontSize: 15, marginBottom: 20 }}>
              This account can view reports and history only.
            </p>
            <Btn onClick={() => setRestrictedAlert(false)} style={{ minWidth: 100 }}>OK</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
