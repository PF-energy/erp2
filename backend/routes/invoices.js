const express = require('express');
const { query } = require('../db');
const { rowInvoice } = require('../utils');
const { logActivity } = require('../services/automationEngine');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const result = await query('SELECT * FROM invoices WHERE org_id = $1 ORDER BY created_at DESC', [org]);
    res.json(result.rows.map(rowInvoice));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { id } = req.params;
    const existingRes = await query('SELECT * FROM invoices WHERE org_id = $1 AND id = $2', [org, id]);
    const existing = existingRes.rows[0];
    if (!existing) return res.status(404).json({ error: 'invoice not found' });

    const { status } = req.body;
    const nextStatus = status !== undefined ? status : existing.status;
    await query('UPDATE invoices SET status = $1 WHERE org_id = $2 AND id = $3', [nextStatus, org, id]);

    let activity = null;
    if (status === 'paid' && existing.status !== 'paid') {
      activity = await logActivity(org, 'Payment Received',
        `${existing.customer} paid invoice ${id} (£${Math.round(existing.amount).toLocaleString('en-GB')}).`, 'green');
    }

    const invRow = await query('SELECT * FROM invoices WHERE org_id = $1 AND id = $2', [org, id]);
    res.json({ invoice: rowInvoice(invRow.rows[0]), activity });
  } catch (err) { next(err); }
});

module.exports = router;
