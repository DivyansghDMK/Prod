# CardioX Workspace

This repository is organized around a shared backend so the desktop app and clinician portal can evolve independently while reusing the same APIs and data model.

## Structure

```text
ProD/
├── qww_new/      # Python desktop software
├── HCP/          # React clinician portal
├── backend/     # Shared backend API
├── docs/        # Architecture and product documentation
└── README.md
```

## Why this split

Both frontends should talk to one backend:

- `qww_new` sends signup, reports, device, and sync data.
- `HCP` consumes the same backend for clinician workflows, dashboards, and review.
- `backend` owns the business logic so API rules are implemented once.

That keeps the platform easier to maintain and avoids duplicating auth, user, organization, device, patient, and report logic in two places.

## Planned backend responsibilities

```text
backend/
├── src/
│   ├── auth/
│   ├── organizations/
│   ├── users/
│   ├── devices/
│   ├── patients/
│   ├── reports/
│   ├── dashboard/
│   ├── license/
│   ├── middleware/
│   ├── utils/
│   ├── config/
│   ├── routes/
│   └── app.js
├── prisma/        # or migrations/
├── package.json
├── server.js
├── .env
└── README.md
```

## Suggested API surface

- `POST /auth/send-otp`
- `POST /auth/verify-otp`
- `GET /organizations`
- `POST /organizations`
- `GET /devices`
- `POST /devices`
- `GET /patients`
- `POST /patients`
- `GET /reports`
- `POST /reports`
- `GET /dashboard`

## Data flow

```text
Desktop (qww_new) -> Backend -> PostgreSQL -> S3
HCP (React)      -> Backend -> PostgreSQL -> S3
```

## License server direction

The long-term direction is to merge license APIs into the shared backend instead of keeping a separate service. That means the backend eventually owns:

- license activation
- OTP login
- users
- organizations
- devices
- patients
- reports
- dashboard data

## Current apps

- `qww_new`: Python desktop ECG and Holter software
- `HCP`: React clinician portal

