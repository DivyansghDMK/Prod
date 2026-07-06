# DeckLink — Clinician Portal

DeckLink is a premium, highly responsive web-based clinician portal for CPAP/BiPAP therapy monitoring and patient data triage. It adapts clinical workflows into a modern web experience featuring steel-blue branding over a deep navy theme.

---

## 🌟 Key Features

1. **AirView Dropdown Navigation Layout**:
   - **Patients**: Access to *All therapy*, *Wireless* (SD-Card vs cellular logs), *Action Groups* (exception-based triage), *Ventilation patients*, and *Referrals*.
   - **Business**: *Module management* and *Compliance report exports*.
   - **Administration**: Registry modules for *Organisation Details*, *Locations*, *Users*, *Physicians*, *Insurers*, and *Compliance options*.
   - **My Profile**: Live tabbed interface managing basic info and contact details.

2. **Clean Entity Separation**:
   - **Users** (internal clinic/HCP staff: Sr. Doctors, Jr. Doctors, Admins, Receptionists) and **Physicians** (external referring doctor accounts) are split into independent tables and interfaces.
   - Separate registries for **Locations** and **Insurers**.

3. **Responsive Mobile Interface**:
   - Collapses the TopBar header into a slide-out hamburger navigation menu on viewports below `768px`.
   - Grid elements stack vertically and table logs use responsive overflow scrolling (`overflow-x: auto`) to avoid squishing clinical metrics.

4. **Visual Design System**:
   - High-fidelity **frosted glassmorphic cards** (`rgba(11, 18, 32, 0.82)`) with a `20px` backdrop filter overlaying a custom clinician stock photo workspace background.
   - Consistent steel-blue primary gradients (`#2E7DB8` / `#3E97D6`) on a deep dark canvas.

---

## 📂 Project Architecture

```
HCP/
├── public/
│   ├── logo.png         # Brand caduceus graphic asset
│   └── login-bg.png     # Custom generated background stock photo
├── src/
│   ├── App.jsx          # Self-contained React SPA (Routing, Components & UI Panels)
│   ├── index.css        # Core design resets & Outfit typography rules
│   └── main.jsx         # Bootstrapping React DOM entry
├── package.json         # Build details & Lucide react icon dependencies
└── vite.config.js       # Vite configuration
```

---

## 💾 Local Storage Schema

All prototype state is managed locally inside browser client space:
- **`decklink_session_v1`**: Holds active login session details (name, email, role, phone, and organization).
- **`decklink_data_v1`**: Contains the full operational relational schema:
  - `orgs`: List of registered clinical sites.
  - `users`: List of internal clinic staff.
  - `physicians`: List of external referring physicians.
  - `locations`: Internal hospital/clinic office coordinates.
  - `insurers`: Supported insurance provider details.
  - `patients`: Clinical patient registry.

---

## 🚀 Local Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Launch Development Server
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

### 3. Production Build
```bash
npm run build
```

---

## ☁️ AWS Production Deployment Blueprint

To move DeckLink live on AWS, transition the local storage prototype into a server architecture:

```
[ Frontend: S3 + CloudFront CDN ] <---> [ ECS Fargate Node.js API ] <---> [ AWS RDS PostgreSQL Database ]
```

1. **Deploy Frontend**:
   - Sync the production build folder `dist/` to an **AWS S3 Bucket**.
   - Create an **AWS CloudFront Distribution** pointing to the S3 bucket to serve static assets globally over HTTPS (secured with a free **AWS Certificate Manager** SSL certificate).

2. **Deploy Backend API**:
   - Replace direct local storage read/write states in `src/App.jsx` with asynchronous `fetch` calls.
   - Run a Node.js/Express or Python backend container on **AWS ECS Fargate**.

3. **Configure Database**:
   - Launch an **AWS RDS (PostgreSQL/MySQL)** instance to securely store organizations, clinicians, patient reports, and compliance logs.
