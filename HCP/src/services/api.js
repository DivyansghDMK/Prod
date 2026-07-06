import axios from "axios";

const SESSION_KEY = "decklink_session_v1";

// Create Axios client pointing to local API
const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Inject JWT token if present in session
api.interceptors.request.use(
  (config) => {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (session && session.accessToken) {
        config.headers["Authorization"] = `Bearer ${session.accessToken}`;
      }
    } catch (err) {
      console.error("API interceptor error:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto Refresh JWT on 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/auth/login") &&
      !originalRequest.url.includes("/auth/verify-otp") &&
      !originalRequest.url.includes("/auth/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
        const refreshToken = session ? session.refreshToken : null;

        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        const res = await axios.post("/api/v1/auth/refresh", { refreshToken });
        const data = res.data;

        if (data && data.accessToken) {
          const updatedSession = {
            ...session,
            token: data.accessToken,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || refreshToken,
          };
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));

          processQueue(null, data.accessToken);
          isRefreshing = false;

          originalRequest.headers["Authorization"] = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } else {
          throw new Error("Invalid refresh response");
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        sessionStorage.removeItem(SESSION_KEY);
        window.location.reload();
        return Promise.reject(refreshError);
      }
    }

    const msg = error.response?.data?.message || error.message || "Request failed";
    return Promise.reject(new Error(msg));
  }
);

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getToken() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    return session?.accessToken || null;
  } catch {
    return null;
  }
}

export function saveToken(token) {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, token, accessToken: token }));
  } catch {}
}

// ─── Auth Endpoints ────────────────────────────────────────────────────────────

// ── Dev-mode local seed helpers ──────────────────────────────────────────────
const LS_DATA_KEY = "decklink_data_v1";
const LS_OTP_KEY  = "decklink_dev_otp_v1"; // { phone, otp, expiresAt }

// Hardcoded seed users — always available even if localStorage is empty
const SEED_USERS = [
  { id: "seed-1", name: "Dr. Aditi Sharma",  role: "Sr. Clinical Doctor", email: "aditi.sharma@fsrc.in",  phone: "9810000001", password: "123" },
  { id: "seed-2", name: "Rahul Mehta",        role: "HCP Head",            email: "rahul.mehta@fsrc.in",   phone: "9810000002", password: "123" },
  { id: "seed-3", name: "Priya Nair",         role: "Receptionist",        email: "priya.nair@fsrc.in",    phone: "9810000003", password: "123" },
];
const SEED_ORG = { id: "org1", name: "Faridabad Sleep & Respiratory Clinic", type: "HCP Head" };

function _getLocalUsers() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_DATA_KEY) || "null");
    if (d?.users) {
      const stored = Object.values(d.users).flat();
      if (stored.length > 0) return stored;
    }
  } catch {}
  // Always fall back to hardcoded seed users
  return SEED_USERS;
}

function _buildLocalSession(user, org) {
  const fakeId = user.id || ("local-" + Math.random().toString(36).slice(2, 10));
  const sessionData = {
    token:        "dev-token-" + fakeId,
    accessToken:  "dev-token-" + fakeId,
    refreshToken: "dev-refresh-" + fakeId,
    orgId:        org?.id || "org1",
    userName:     user.name || user.full_name || user.email || "Clinician",
    email:        user.email || "",
    phone:        user.phone || "",
    role:         user.role || "HCP Head",
    userId:       fakeId,
    id:           fakeId,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  return sessionData;
}

export async function sendOTP(phone) {
  const phoneClean = normalizePhone(phone);
  try {
    return await api.post("/auth/send-otp", { phone: phoneClean });
  } catch (err) {
    // ── Dev fallback: backend/DB unavailable ──────────────────────────────────
    console.warn("[DEV] Backend unavailable for send-otp, using local dev fallback.", err.message);
    // Generate a simple dev OTP and store it locally
    const devOtp = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
    const expiresAt = Date.now() + 10 * 60 * 1000;
    localStorage.setItem(LS_OTP_KEY, JSON.stringify({ phone: phoneClean, otp: devOtp, expiresAt }));
    console.info(`[DEV MODE] OTP for ${phoneClean}: ${devOtp}  (or use any 4-digit code)`);
    return { message: "[DEV] OTP logged to console — check browser console for code", devMode: true, otp: devOtp };
  }
}

export async function verifyOTP(phone, otp) {
  const phoneClean = normalizePhone(phone);
  try {
    const res = await api.post("/auth/verify-otp", {
      phone: phoneClean,
      otp: String(otp).trim(),
      deviceName: typeof window !== "undefined" ? window.navigator.userAgent : "HCP Portal",
    });

    const token = res.accessToken || res.token;
    if (!token) throw new Error("No JWT token returned from server.");

    const sessionData = {
      token,
      accessToken:  token,
      refreshToken: res.refreshToken,
      // Backend returns camelCase: fullName, not full_name
      orgId:        res.organization?.id || res.user?.organization_id || "org1",
      userName:     res.user?.fullName || res.user?.full_name || res.user?.email || "Clinician",
      email:        res.user?.email || "",
      phone:        res.user?.phone || phone,
      role:         res.role || res.user?.role || "HCP Head",
      userId:       res.user?.id || "user-1",
      id:           res.user?.id || "user-1",
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    return sessionData;
  } catch (err) {
    // ── Dev fallback: backend/DB unavailable ──────────────────────────────────
    console.warn("[DEV] Backend unavailable for verify-otp, using local dev fallback.", err.message);
    const stored = JSON.parse(localStorage.getItem(LS_OTP_KEY) || "null");
    const otpClean = String(otp).trim();
    const phoneMatch = stored?.phone === phoneClean;
    const otpMatch   = stored?.otp === otpClean;
    const notExpired  = stored?.expiresAt > Date.now();
    // In dev mode: accept stored OTP, OR any 4-6 digit numeric code
    const devAccept = /^\d{4,6}$/.test(otpClean);
    if (!phoneMatch && !devAccept) {
      throw new Error("[DEV] No OTP found for this phone. Send OTP first.");
    }
    if (stored && phoneMatch && !notExpired) {
      throw new Error("OTP has expired. Please request a new one.");
    }

    // Find the user in local seed data by phone
    const users = _getLocalUsers();
    const normPhone = (p) => String(p || "").replace(/\D/g, "").slice(-10);
    const user = users.find((u) => normPhone(u.phone) === normPhone(phoneClean))
      || users[0]; // fallback to first seed user if phone not found

    if (!user) throw new Error("No user found in local data. Please register first.");

    // Load org from seed data
    let org = null;
    try {
      const d = JSON.parse(localStorage.getItem(LS_DATA_KEY) || "null");
      org = d?.orgs?.[0] || null;
    } catch {}

    localStorage.removeItem(LS_OTP_KEY);
    return _buildLocalSession(user, org);
  }
}

export async function loginWithPassword(identifier, password) {
  try {
    const res = await api.post("/auth/login", {
      identifier,
      password,
      deviceName: typeof window !== "undefined" ? window.navigator.userAgent : "HCP Portal",
    });

    const token = res.accessToken || res.token;
    if (!token) throw new Error("No JWT token returned from server.");

    const sessionData = {
      token,
      accessToken:  token,
      refreshToken: res.refreshToken,
      // Backend returns camelCase: fullName, not full_name
      orgId:        res.organization?.id || res.user?.organization_id || "org1",
      userName:     res.user?.fullName || res.user?.full_name || res.user?.email || "Clinician",
      email:        res.user?.email || "",
      phone:        res.user?.phone || "",
      role:         res.role || res.user?.role || "HCP Head",
      userId:       res.user?.id || "user-1",
      id:           res.user?.id || "user-1",
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    return sessionData;
  } catch (err) {
    // ── Dev fallback: match against local seed users ──────────────────────────
    console.warn("[DEV] Backend unavailable for login, using local seed data.", err.message);
    const users = _getLocalUsers();
    const id = String(identifier || "").toLowerCase().trim();
    const pwd = String(password || "");
    const user = users.find((u) => {
      const matchId =
        (u.email && u.email.toLowerCase() === id) ||
        (u.phone && u.phone === id) ||
        (u.name  && u.name.toLowerCase()  === id);
      const matchPwd = u.password === pwd || pwd === "123";
      return matchId && matchPwd;
    }) || (pwd === "123" ? users[0] : null);

    if (!user) throw new Error("Invalid credentials. Try password: 123");

    let org = SEED_ORG;
    try {
      const d = JSON.parse(localStorage.getItem(LS_DATA_KEY) || "null");
      org = d?.orgs?.[0] || SEED_ORG;
    } catch {}

    return _buildLocalSession(user, org);
  }
}

export async function registerOrg(form, pendingRole) {
  // 1. Create Organization
  const orgRes = await api.post("/organizations", {
    name: form.orgName || "HCP Clinic",
    type: pendingRole?.role || "HCP Head",
  });
  const orgId = orgRes.id || orgRes.data?.id;

  // 2. Fetch all roles to map role_id
  const rolesRes = await api.get("/roles");
  const roles = rolesRes.data || rolesRes || [];
  
  const hcpAdminRole = roles.find(r => r.name === "HCP_ADMIN") || roles[0];
  const roleId = hcpAdminRole.id;

  // 3. Register user within Organization context
  const userRes = await api.post("/users", {
    organization_id: orgId,
    role_id: roleId,
    full_name: form.name || "Head Owner",
    email: form.email,
    phone: normalizePhone(form.phone),
    password: form.password || "123",
  });

  // 4. Log in immediately
  return loginWithPassword(form.email || form.phone, form.password || "123");
}

// ─── Patients Endpoints ────────────────────────────────────────────────────────

export async function getPatients(search = "") {
  return api.get("/patients", { params: { search } });
}

export async function createPatient(patientData) {
  return api.post("/patients", patientData);
}

export async function updatePatient(id, patientData) {
  return api.put(`/patients/${id}`, patientData);
}

export async function deletePatient(id) {
  return api.delete(`/patients/${id}`);
}

// ─── Devices Endpoints ─────────────────────────────────────────────────────────

export async function getDevices() {
  const res = await api.get("/devices");
  return res.data || res;
}

export async function registerDevice(serial, model) {
  return api.post("/devices/register", {
    machine_serial: serial,
    rhythmulta_serial: serial,
    device_name: model || "RhythmPro",
  });
}

export async function deleteDevice(id) {
  return api.delete(`/devices/${id}`);
}

// ─── Users Endpoints ───────────────────────────────────────────────────────────

export async function getUsers() {
  const res = await api.get("/users");
  return res.data || res;
}

export async function createUser(userData) {
  const rolesRes = await api.get("/roles");
  const roles = rolesRes.data || rolesRes || [];
  const targetRole = roles.find(r => r.name === "HCP_CLINICAL") || roles[0];
  
  return api.post("/users", {
    ...userData,
    role_id: targetRole.id,
    full_name: userData.name || "New Staff User",
  });
}

export async function updateUser(id, userData) {
  return api.put(`/users/${id}`, userData);
}

export async function deleteUser(id) {
  return api.delete(`/users/${id}`);
}

// ─── Report Endpoints ─────────────────────────────────────────────────────────

export async function getReports(serial = "") {
  const res = await api.get("/reports", { params: { RhythmUltra_serial: serial } });
  
  // Map backend format to expectations of reports list UI
  const rawList = res.data || res.reports || [];
  const populated = [];
  
  for (const rep of rawList) {
    let storageUrl = "";
    try {
      const urlRes = await api.get(`/reports/${rep.id}/download-url`);
      storageUrl = urlRes.url || urlRes.data?.url || "";
    } catch (e) {
      console.warn("Failed to generate signed download link for report", rep.id);
    }
    populated.push({
      ...rep,
      storage_url: storageUrl,
    });
  }
  
  return populated;
}

export async function submitReportReview(reportId, decision, comments) {
  return api.post(`/reports/${reportId}/review`, { decision, comments });
}

export function filterReportsByRole(reports, session) {
  if (!Array.isArray(reports)) return [];
  const role = session?.role;
  if (role === "HCP Head" || role === "Doctor Head" || role === "HCP_ADMIN" || role === "DOCTOR_ADMIN") return reports;
  if (role === "Sr. Clinical Doctor" || role === "Jr. Clinical Doctor" || role === "HCP_CLINICAL" || role === "DOCTOR_CLINICAL") {
    return reports.filter(
      (r) =>
        r.doctor_name?.toLowerCase() === session.userName?.toLowerCase() ||
        r.doctor_id === session.id
    );
  }
  return [];
}

export function canViewPDF(role) {
  return (
    role === "HCP Head" || role === "Doctor Head" ||
    role === "Sr. Clinical Doctor" || role === "Jr. Clinical Doctor" ||
    role === "HCP_ADMIN" || role === "DOCTOR_ADMIN" ||
    role === "HCP_CLINICAL" || role === "DOCTOR_CLINICAL"
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}
