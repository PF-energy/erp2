// Cloud database layer. Talks to Postgres (Neon, Supabase, RDS, Railway,
// plain self-hosted Postgres — anything reachable via a connection string)
// instead of a local SQLite file, so the app has no per-machine state and
// can run from any host.

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error(
    '\nDATABASE_URL is not set. Point it at a Postgres connection string, e.g.\n' +
    '  DATABASE_URL=postgres://user:pass@host:5432/dbname npm start\n' +
    'See DEPLOY.md for how to get a free cloud Postgres instance (Neon).\n'
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most managed Postgres providers (Neon, Supabase, Render, RDS) require
  // TLS and present a cert that isn't in Node's default trust store from
  // the client's point of view in some setups — this keeps that working
  // without asking every deployer to import a CA bundle. Disable via
  // PGSSL=disable for a local/self-hosted Postgres that doesn't use TLS.
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

// ---- per-org id / quote-number counters, backed by the counters table ----
async function nextId(orgId, prefix) {
  const n = await bumpCounter(orgId, 'entity_id', 5000);
  return `${prefix}-${n}`;
}

async function nextQuoteNumber(orgId) {
  const n = await bumpCounter(orgId, 'quote_number', 1041);
  return `RLQ-${n}`;
}

async function bumpCounter(orgId, name, initial) {
  // Atomic upsert-and-increment in one round trip.
  const res = await pool.query(
    `INSERT INTO counters (org_id, name, value) VALUES ($1, $2, $3 + 1)
     ON CONFLICT (org_id, name) DO UPDATE SET value = counters.value + 1
     RETURNING value`,
    [orgId, name, initial]
  );
  return res.rows[0].value;
}

module.exports = { pool, query, initSchema, nextId, nextQuoteNumber };
