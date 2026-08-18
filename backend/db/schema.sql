-- Pro-Fit Green Energy ERP — multi-tenant Postgres schema.
-- Every business table carries org_id; every query in the app filters by
-- it, so one tenant can never see another tenant's rows.

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin',    -- admin | member
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'roofing',
  stage TEXT NOT NULL DEFAULT 'new',
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_contact_days_ago INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(org_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'roofing',
  status TEXT NOT NULL DEFAULT 'scheduled',
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  crew TEXT NOT NULL DEFAULT '',
  materials_ordered INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(org_id);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  due_in_days INTEGER NOT NULL DEFAULT 14,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  text TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'copper',
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_org ON activity(org_id);

CREATE TABLE IF NOT EXISTS automations (
  id TEXT NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  trigger_label TEXT NOT NULL,
  trigger_tag TEXT NOT NULL,
  action TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'copper',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, id)
);

CREATE TABLE IF NOT EXISTS materials (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  unit TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  kwh DOUBLE PRECISION,
  PRIMARY KEY (org_id, category, key)
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  kind TEXT NOT NULL,
  customer_name TEXT,
  address TEXT,
  date_label TEXT,
  valid_days INTEGER NOT NULL DEFAULT 30,
  valid_until_label TEXT,
  summary TEXT,
  lines_json TEXT NOT NULL,
  margin_pct DOUBLE PRECISION,
  margin_amt DOUBLE PRECISION,
  net_total DOUBLE PRECISION,
  vat_amt DOUBLE PRECISION,
  total_inc_vat DOUBLE PRECISION,
  notes TEXT,
  appendix_json TEXT,
  lead_id TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotes(org_id);

CREATE TABLE IF NOT EXISTS counters (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (org_id, name)
);
