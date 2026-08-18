const express = require('express');
const { query, nextId } = require('../db');
const { rowJob, rowInvoice } = require('../utils');
const { isAutomationEnabled, logActivity } = require('../services/automationEngine');

const router = express.Router();
const TEAMS = ['R. Doyle roofing team', 'A. Kaur roofing team', 'S. Whitfield roofing team', 'Solar install team A'];

router.get('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const result = await query('SELECT * FROM jobs WHERE org_id = $1 ORDER BY created_at DESC', [org]);
    res.json(result.rows.map(rowJob));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { customer, type = 'roofing', value = 0, crew } = req.body;
    if (!customer || !customer.trim()) return res.status(400).json({ error: 'customer is required' });
    const id = await nextId(org, 'JOB');
    const chosenCrew = crew || TEAMS[Math.floor(Math.random() * TEAMS.length)];
    await query(
      'INSERT INTO jobs (id, org_id, customer, type, status, value, crew, materials_ordered, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, org, customer.trim(), type, 'scheduled', Number(value) || 0, chosenCrew, 0, Date.now()]
    );
    const jobRow = await query('SELECT * FROM jobs WHERE org_id = $1 AND id = $2', [org, id]);
    res.status(201).json(rowJob(jobRow.rows[0]));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { id } = req.params;
    const existingRes = await query('SELECT * FROM jobs WHERE org_id = $1 AND id = $2', [org, id]);
    const existing = existingRes.rows[0];
    if (!existing) return res.status(404).json({ error: 'job not found' });

    const { status, crew, materialsOrdered } = req.body;
    let nextStatus = status !== undefined ? status : existing.status;
    const nextCrew = crew !== undefined ? crew : existing.crew;
    const nextOrdered = materialsOrdered !== undefined ? (materialsOrdered ? 1 : 0) : existing.materials_ordered;

    let invoice = null;
    let activity = null;
    const statusChanged = status !== undefined && status !== existing.status;

    if (statusChanged && status === 'completed') {
      if (await isAutomationEnabled(org, 'Job Complete')) {
        const invId = await nextId(org, 'INV');
        await query(
          'INSERT INTO invoices (id, org_id, customer, amount, due_in_days, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [invId, org, existing.customer, existing.value, 14, 'sent', Date.now()]
        );
        const invRow = await query('SELECT * FROM invoices WHERE org_id = $1 AND id = $2', [org, invId]);
        invoice = rowInvoice(invRow.rows[0]);
        activity = await logActivity(org, 'Job Complete',
          `Invoice auto-generated for ${existing.customer} (£${Math.round(existing.value).toLocaleString('en-GB')}) and sent to customer.`, 'green');
        nextStatus = 'invoiced';
      }
    } else if (statusChanged) {
      activity = await logActivity(org, 'Job Update', `${existing.customer} status set to ${status}.`, 'copper');
    } else if (crew !== undefined && crew !== existing.crew) {
      activity = await logActivity(org, 'Team Reassigned', `${existing.customer} reassigned to ${crew}.`, 'copper');
    }

    await query('UPDATE jobs SET status = $1, crew = $2, materials_ordered = $3 WHERE org_id = $4 AND id = $5',
      [nextStatus, nextCrew, nextOrdered, org, id]);

    const jobRow = await query('SELECT * FROM jobs WHERE org_id = $1 AND id = $2', [org, id]);
    res.json({ job: rowJob(jobRow.rows[0]), invoice, activity });
  } catch (err) { next(err); }
});

module.exports = router;
