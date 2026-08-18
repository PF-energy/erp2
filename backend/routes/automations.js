const express = require('express');
const { query } = require('../db');
const { rowAutomation } = require('../utils');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const result = await query('SELECT * FROM automations WHERE org_id = $1 ORDER BY sort_order ASC', [org]);
    res.json(result.rows.map(rowAutomation));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { id } = req.params;
    const existing = await query('SELECT * FROM automations WHERE org_id = $1 AND id = $2', [org, id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'automation not found' });
    const { enabled } = req.body;
    await query('UPDATE automations SET enabled = $1 WHERE org_id = $2 AND id = $3', [enabled ? 1 : 0, org, id]);
    const updated = await query('SELECT * FROM automations WHERE org_id = $1 AND id = $2', [org, id]);
    res.json(rowAutomation(updated.rows[0]));
  } catch (err) { next(err); }
});

module.exports = router;
