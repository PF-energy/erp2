# Deploying Pro-Fit Green Energy ERP as a hosted SaaS

This turns the app into something reachable from any PC via a URL, with
all data in the cloud. Two free accounts, ~15 minutes.

- **Database:** [Neon](https://neon.tech) — serverless Postgres, generous free tier, gives you a `DATABASE_URL` in about 60 seconds.
- **Hosting:** [Render](https://render.com) — free web service tier, deploys straight from this folder (or a GitHub repo), HTTPS included automatically.

You can swap either for a different provider (Supabase instead of Neon; Railway or Fly.io instead of Render) — the app only needs a Postgres connection string and somewhere to run a Node process, nothing provider-specific.

## 1. Create the database (Neon)

1. Go to neon.tech → sign up (free) → **Create a project**.
2. Once created, Neon shows a **connection string** that looks like:
   `postgres://neondb_owner:••••@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
3. Copy it — this is your `DATABASE_URL`. You don't need to run any SQL
   yourself; the app creates its own tables on first boot.

## 2. Deploy the app (Render)

**Option A — from this folder, via the Render dashboard:**
1. Push this folder to a new GitHub repo (or use Render's "Upload" flow if offered).
2. In Render: **New → Web Service** → connect the repo.
3. Render should detect the `Dockerfile` automatically (runtime: Docker). If asked for a start command, leave it blank — the Dockerfile handles it.
4. Under **Environment**, add:
   - `DATABASE_URL` → paste the Neon connection string from step 1
   - `JWT_SECRET` → any long random string (Render can generate one for you, or run `openssl rand -hex 32` locally)
5. Choose the **Free** instance type → **Create Web Service**.
6. Wait for the build to finish — Render gives you a URL like `https://pro-fit-green-energy-erp.onrender.com`. That's your app, reachable from any PC.

**Option B — one-step blueprint:** if you push this repo to GitHub with `render.yaml` included, Render's **New → Blueprint** flow reads it automatically and prompts you only for `DATABASE_URL`.

## 3. First login

Open the Render URL. You'll see a sign-in / create-company-account screen.
Use **Create company account** once, for your own company — that becomes
your organization, and you're its admin. Anyone who needs access after
that logs in with their own email (see "Adding teammates" below).

## 4. Adding teammates

This version's sign-up flow always creates a *new* company. There's no
"invite a teammate" screen yet — if you need several people in the same
company's account, the fastest path today is to add a row directly to the
`users` table in Neon's SQL editor:

```sql
-- run in Neon's SQL editor, replace the values in <>
insert into users (id, org_id, email, password_hash, name, role, created_at)
values (
  gen_random_uuid()::text,
  '<your org_id — find it via: select id from organizations>',
  '<teammate email>',
  '<bcrypt hash — see note below>',
  '<teammate name>',
  'member',
  extract(epoch from now()) * 1000
);
```

Bcrypt hashes can't be typed by hand — generate one locally with:
```
node -e "console.log(require('bcryptjs').hashSync('their-password', 12))"
```
(run this from the `backend` folder after `npm install`, so `bcryptjs` is available)

A proper "invite teammate" UI is a natural next feature to add if this
gets used by more than one person per company.

## 5. Custom domain (optional)

Render's free tier supports attaching your own domain — Render dashboard →
your service → **Settings → Custom Domains**, then point a CNAME at the
address Render gives you.

## Local development

To run it on your own machine against the same cloud database (useful for
testing changes before they go live):

```bash
cd backend
npm install
cp ../.env.example ../.env   # fill in DATABASE_URL and JWT_SECRET
node -r dotenv/config server.js dotenv_config_path=../.env
```

(or just `export` the two variables in your shell before `npm start`)

## What changed from the single-PC version

- Data lives in Postgres instead of a SQLite file — no more per-machine
  database, and Render/Neon both handle backups for you.
- Real login (email + password, one company per sign-up) replaces the old
  single shared "Materials tab password" — every tenant's data is isolated
  by `org_id` on every table and every query.
- New companies get a starter materials price catalog and standard
  automation rules on sign-up, but start with an empty pipeline — no demo
  leads/jobs/invoices, since this is meant for real customer data now.
