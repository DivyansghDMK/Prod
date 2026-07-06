# Backend API

This folder is the shared backend for both:

- `qww_new` desktop software
- `HCP` clinician portal

The backend should own all business logic that both clients need, including:

- authentication
- organizations
- users
- devices
- patients
- reports
- dashboard
- licensing

## Target layout

```text
backend/
├── db/
│   ├── schema/
│   │   └── 001_initial.sql
│   └── migrations/
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
├── prisma/
├── package.json
├── server.js
├── .env
└── README.md
```

## Recommended responsibilities

- Validate requests from both clients
- Store records in PostgreSQL
- Handle upload metadata and report links
- Centralize OTP and login flows
- Centralize license activation
- Serve dashboard aggregates to the HCP portal

## Database layer

- `db/schema/001_initial.sql` contains the PostgreSQL foundation schema.
- `src/repositories/` contains repository placeholders for each entity.
- No query logic, ORM models, or API handlers are implemented yet.

## Notes

This backend replaces duplicated API logic that currently lives across desktop-side helpers and the clinician portal.
