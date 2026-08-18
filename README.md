# Pro-Fit Green Energy — Roofing & Solar ERP (multi-tenant SaaS)

A cloud-hosted version of the Pro-Fit Green Energy ERP: an Express backend
backed by Postgres, with real per-company login, so any number of separate
companies can sign up, each with its own completely isolated data — leads,
jobs, invoices, quotes, materials pricing, and automation rules — reachable
from any PC via a browser, nothing stored locally.

```
pro-fit-saas/
├── Dockerfile         container build for deployment
├── render.yaml        one-click Render blueprint
├── DEPLOY.md          step-by-step: get this live on the internet
├── .env.example       required environment variables
├── backend/
│   ├── server.js       entry point — API + serves the frontend
│   ├── db/             Postgres schema, connection pool, per-org defaults
│   ├── middleware/      session auth (JWT cookie) + admin-role gate
│   ├── routes/          auth, leads, jobs, invoices, materials, quotes, ...
│   └── services/        shared automation-engine helpers
└── frontend/
    └── index.html      the whole UI (HTML/CSS/JS, no build step) + login gate
```

## How multi-tenancy works

- Every business table (`leads`, `jobs`, `invoices`, `materials`, `quotes`,
  `automations`, `activity`) carries an `org_id`. Every single query in
  every route filters by the signed-in user's `org_id` — that's the whole
  isolation boundary, and it's enforced server-side, not just hidden in
  the UI.
- **Sign-up** (`POST /api/auth/register`) creates a brand new organization
  plus its first user, who becomes that organization's admin. There's
  currently no separate "create org" step — registering *is* how a new
  tenant comes into being.
- **Login** is a normal email + password check, hashed with bcrypt,
  returning an httpOnly session cookie (JWT) — not stored in
  localStorage, so it isn't reachable from JS/XSS.
- New organizations are seeded with a starter materials price catalog and
  the standard automation rules, so the estimator works from day one — but
  deliberately **not** with demo leads/jobs/invoices, since a real
  company's account shouldn't start with fake data in it.
- The old shared "Materials tab password" from the single-tenant version
  is gone — replaced by the `admin` role on each user. Any signed-in user
  can view materials (the estimator needs that); only admins can edit or
  reset the price catalog.

## Running it

You need a Postgres database reachable via a connection string (Neon,
Supabase, RDS, or any self-hosted Postgres all work) — see **DEPLOY.md**
for the fastest way to get one for free plus deploy the app itself so it's
reachable from any PC. To run it locally against that database:

```bash
cd backend
npm install
DATABASE_URL="postgres://..." JWT_SECRET="$(openssl rand -hex 32)" npm start
```

Then open **http://localhost:3000**. The server creates its own tables on
first boot (`CREATE TABLE IF NOT EXISTS`, safe to run every time) — there's
no separate migration step to run by hand.

## Environment variables

See `.env.example`. In short: `DATABASE_URL` (Postgres connection string,
required), `JWT_SECRET` (long random string signing session cookies,
required), `PORT` (optional, most hosts set this for you).

## Deploying so it's reachable from any PC

Full walkthrough in **DEPLOY.md** — free-tier Neon (database) + Render
(hosting), roughly 15 minutes end to end, HTTPS included.
