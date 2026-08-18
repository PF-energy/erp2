const express = require('express');
const { query } = require('../db');
const { rowLead, rowJob, rowInvoice, rowActivity, rowAutomation, rowMaterial, rowQuote } = require('../utils');

const router = express.Router();

// Single combined payload for first page load, to avoid a waterfall of
// requests before the UI can render anything. Everything scoped to the
// signed-in user's organization.
router.get('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const [leads, jobs, invoices, activity, automations, quotes, materialRows] = await Promise.all([
      query('SELECT * FROM leads WHERE org_id = $1 ORDER BY created_at DESC', [org]),
      query('SELECT * FROM jobs WHERE org_id = $1 ORDER BY created_at DESC', [org]),
      query('SELECT * FROM invoices WHERE org_id = $1 ORDER BY created_at DESC', [org]),
      query('SELECT * FROM activity WHERE org_id = $1 ORDER BY ts DESC LIMIT 50', [org]),
      query('SELECT * FROM automations WHERE org_id = $1 ORDER BY sort_order ASC', [org]),
      query('SELECT * FROM quotes WHERE org_id = $1 ORDER BY created_at DESC', [org]),
      query('SELECT * FROM materials WHERE org_id = $1 ORDER BY category, label', [org]),
    ]);

    const materials = {};
    for (const r of materialRows.rows) {
      if (!materials[r.category]) materials[r.category] = [];
      materials[r.category].push(rowMaterial(r));
    }

    res.json({
      leads: leads.rows.map(rowLead),
      jobs: jobs.rows.map(rowJob),
      invoices: invoices.rows.map(rowInvoice),
      activity: activity.rows.map(rowActivity),
      automations: automations.rows.map(rowAutomation),
      materials,
      quotes: quotes.rows.map(rowQuote),
    });
  } catch (err) { next(err); }
});

module.exports = router;
