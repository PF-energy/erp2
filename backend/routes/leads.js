const express = require('express');
const { query, nextId } = require('../db');
const { rowLead, rowJob } = require('../utils');
const { isAutomationEnabled, logActivity } = require('../services/automationEngine');

const router = express.Router();
const TEAMS = ['R. Doyle roofing team', 'A. Kaur roofing team', 'S. Whitfield roofing team', 'Solar install team A'];

router.get('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const result = await query('SELECT * FROM leads WHERE org_id = $1 ORDER BY created_at DESC', [org]);
    res.json(result.rows.map(rowLead));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { name, type = 'roofing', value = 0 } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const id = await nextId(org, 'LD');
    const now = Date.now();
    await query(
      'INSERT INTO leads (id, org_id, name, type, stage, value, last_contact_days_ago, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, org, name.trim(), type, 'new', Number(value) || 0, 0, now]
    );

    const activity = (await isAutomationEnabled(org, 'New Lead'))
      ? await logActivity(org, 'New Lead', `${name.trim()} added — intro email queued, 2-day follow-up task created.`, 'copper')
      : null;

    const leadRow = await query('SELECT * FROM leads WHERE org_id = $1 AND id = $2', [org, id]);
    res.status(201).json({ lead: rowLead(leadRow.rows[0]), activity });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { id } = req.params;
    const existingRes = await query('SELECT * FROM leads WHERE org_id = $1 AND id = $2', [org, id]);
    const existing = existingRes.rows[0];
    if (!existing) return res.status(404).json({ error: 'lead not found' });

    const { stage, value, lastContactDaysAgo } = req.body;
    const nextStage = stage !== undefined ? stage : existing.stage;
    const nextValue = value !== undefined ? value : existing.value;
    const nextContact = lastContactDaysAgo !== undefined ? lastContactDaysAgo : existing.last_contact_days_ago;

    await query('UPDATE leads SET stage = $1, value = $2, last_contact_days_ago = $3 WHERE org_id = $4 AND id = $5',
      [nextStage, nextValue, nextContact, org, id]);

    let job = null;
    let activity = null;
    const stageChanged = stage !== undefined && stage !== existing.stage;

    if (stageChanged && nextStage === 'won') {
      if (await isAutomationEnabled(org, 'Lead Won')) {
        const jobId = await nextId(org, 'JOB');
        const crew = TEAMS[Math.floor(Math.random() * TEAMS.length)];
        const jobType = existing.type === 'both' ? 'roofing' : existing.type;
        await query(
          'INSERT INTO jobs (id, org_id, customer, type, status, value, crew, materials_ordered, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [jobId, org, existing.name, jobType, 'scheduled', nextValue, crew, 1, Date.now()]
        );
        const jobRow = await query('SELECT * FROM jobs WHERE org_id = $1 AND id = $2', [org, jobId]);
        job = rowJob(jobRow.rows[0]);
        activity = await logActivity(org, 'Lead Won', `Job created for ${existing.name}, team assigned, materials ordered, welcome pack sent.`, 'green');
      } else {
        activity = await logActivity(org, 'Lead Won', `${existing.name} marked Won.`, 'green');
      }
    } else if (stageChanged && nextStage === 'lost') {
      activity = await logActivity(org, 'Lead Lost', `${existing.name} marked Lost.`, 'red');
    } else if (stageChanged && nextStage === 'estimateSent') {
      if (await isAutomationEnabled(org, 'Estimate Sent')) {
        activity = await logActivity(org, 'Estimate Sent', `Quote emailed to ${existing.name}. 3-day follow-up scheduled.`, 'copper');
      }
    } else if (stageChanged) {
      activity = await logActivity(org, stage, `${existing.name} moved to ${stage}.`, 'copper');
    }

    const leadRow = await query('SELECT * FROM leads WHERE org_id = $1 AND id = $2', [org, id]);
    res.json({ lead: rowLead(leadRow.rows[0]), job, activity });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const result = await query('DELETE FROM leads WHERE org_id = $1 AND id = $2', [org, req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'lead not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
