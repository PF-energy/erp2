const express = require('express');
const { query, nextId, nextQuoteNumber } = require('../db');
const { rowQuote, rowLead } = require('../utils');
const { isAutomationEnabled, logActivity } = require('../services/automationEngine');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const result = await query('SELECT * FROM quotes WHERE org_id = $1 ORDER BY created_at DESC', [org]);
    res.json(result.rows.map(rowQuote));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const {
      kind, customerName, address, validDays = 30, summary, lines,
      marginPct, marginAmt, netTotal, vatAmt, totalIncVat, notes,
      appendix, leadId,
    } = req.body;

    if (!kind || !lines) return res.status(400).json({ error: 'kind and lines are required' });

    const id = await nextId(org, 'QT');
    const number = await nextQuoteNumber(org);
    const now = Date.now();
    const dateLabel = new Date(now).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const validUntil = new Date(now + validDays * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const appendixList = Array.isArray(appendix) ? appendix : [];

    await query(
      `INSERT INTO quotes (
        id, org_id, number, kind, customer_name, address, date_label, valid_days, valid_until_label,
        summary, lines_json, margin_pct, margin_amt, net_total, vat_amt, total_inc_vat, notes,
        appendix_json, lead_id, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        id, org, number, kind, customerName || 'Prospective Customer', address || '', dateLabel, validDays, validUntil,
        summary || '', JSON.stringify(lines), marginPct ?? null, marginAmt ?? null, netTotal ?? null,
        vatAmt ?? null, totalIncVat ?? null, notes || '',
        appendixList.length ? JSON.stringify(appendixList) : null,
        leadId || null,
        now,
      ]
    );

    const activity = await logActivity(
      org, 'Quote PDF Generated',
      `${number} (£${Math.round(totalIncVat || 0).toLocaleString('en-GB')}) generated for ${customerName || 'Prospective Customer'}${appendixList.length ? ` with ${appendixList.length} branded appendix page${appendixList.length > 1 ? 's' : ''}` : ''}.`,
      'copper'
    );

    let lead = null;
    let leadActivity = null;
    if (leadId) {
      const existingLeadRes = await query('SELECT * FROM leads WHERE org_id = $1 AND id = $2', [org, leadId]);
      const existingLead = existingLeadRes.rows[0];
      if (existingLead) {
        const stageAdvances = ['new', 'contacted', 'estimateScheduled'].includes(existingLead.stage);
        const nextStage = stageAdvances ? 'estimateSent' : existingLead.stage;
        await query('UPDATE leads SET stage = $1, last_contact_days_ago = 0 WHERE org_id = $2 AND id = $3', [nextStage, org, leadId]);
        if (stageAdvances && await isAutomationEnabled(org, 'Estimate Sent')) {
          leadActivity = await logActivity(org, 'Estimate Sent', `Quote ${number} emailed to ${existingLead.name}. 3-day follow-up scheduled.`, 'copper');
        }
        const updatedLead = await query('SELECT * FROM leads WHERE org_id = $1 AND id = $2', [org, leadId]);
        lead = rowLead(updatedLead.rows[0]);
      }
    }

    const quoteRow = await query('SELECT * FROM quotes WHERE org_id = $1 AND id = $2', [org, id]);
    res.status(201).json({ quote: rowQuote(quoteRow.rows[0]), activity, lead, leadActivity });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const result = await query('DELETE FROM quotes WHERE org_id = $1 AND id = $2', [org, req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'quote not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
