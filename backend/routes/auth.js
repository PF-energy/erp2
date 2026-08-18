const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { seedOrgDefaults } = require('../db/seedOrgDefaults');
const { signToken, setSessionCookie, clearSessionCookie, requireAuth } = require('../middleware/auth');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/auth/register  { orgName, name, email, password }
// Creates a brand new tenant (organization) plus its first user, who is
// always the admin of that organization. This is the ONLY way a new
// organization gets created — there's no separate "create org" endpoint,
// so every org always has exactly one admin at creation time.
router.post('/register', async (req, res, next) => {
  try {
    const { orgName, name, email, password } = req.body || {};
    if (!orgName || !orgName.trim()) return res.status(400).json({ error: 'company name is required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'a valid email is required' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'an account with that email already exists' });

    const orgId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const now = Date.now();
    const passwordHash = await bcrypt.hash(password, 12);

    await query('INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, $3)', [orgId, orgName.trim(), now]);
    await query(
      'INSERT INTO users (id, org_id, email, password_hash, name, role, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, orgId, email.toLowerCase(), passwordHash, (name || '').trim(), 'admin', now]
    );

    await seedOrgDefaults(orgId);

    const user = { id: userId, org_id: orgId, email: email.toLowerCase(), role: 'admin' };
    setSessionCookie(res, signToken(user));
    res.status(201).json({ user: { id: userId, email: user.email, name: name || '', role: 'admin', orgName: orgName.trim() } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!isValidEmail(email) || !password) return res.status(400).json({ error: 'email and password are required' });

    const result = await query(
      `SELECT u.*, o.name AS org_name FROM users u
       JOIN organizations o ON o.id = u.org_id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );
    const row = result.rows[0];
    if (!row) return res.status(401).json({ error: 'incorrect email or password' });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'incorrect email or password' });

    setSessionCookie(res, signToken(row));
    res.json({ user: { id: row.id, email: row.email, name: row.name, role: row.role, orgName: row.org_name } });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

// GET /api/auth/me — used by the frontend on load to decide whether to
// show the login gate or the app.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.name, u.role, o.name AS org_name FROM users u
       JOIN organizations o ON o.id = u.org_id WHERE u.id = $1`,
      [req.user.id]
    );
    const row = result.rows[0];
    if (!row) return res.status(401).json({ error: 'not authenticated' });
    res.json({ user: { id: row.id, email: row.email, name: row.name, role: row.role, orgName: row.org_name } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
