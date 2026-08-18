const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { initSchema } = require('./db');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Cloud hosts (Render, Railway, Fly, etc.) put the app behind a proxy that
// terminates TLS — this makes req.secure / secure cookies work correctly.
app.set('trust proxy', 1);

// Design-image data URLs can be a couple of MB — raise the JSON body limit.
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

// Auth routes are public (you need them to log in in the first place).
app.use('/api/auth', require('./routes/auth'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// Everything else requires a signed-in session and is scoped to that
// user's organization inside each route handler via req.user.orgId.
app.use('/api/bootstrap', requireAuth, require('./routes/bootstrap'));
app.use('/api/leads', requireAuth, require('./routes/leads'));
app.use('/api/jobs', requireAuth, require('./routes/jobs'));
app.use('/api/invoices', requireAuth, require('./routes/invoices'));
app.use('/api/materials', requireAuth, require('./routes/materials'));
app.use('/api/quotes', requireAuth, require('./routes/quotes'));
app.use('/api/automations', requireAuth, require('./routes/automations'));
app.use('/api/activity', requireAuth, require('./routes/activity'));

// Serve the frontend as static files, then fall through to index.html for
// any other route (simple single-page-app hosting).
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Pro-Fit Green Energy ERP (SaaS) running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database schema:', err);
    process.exit(1);
  });
