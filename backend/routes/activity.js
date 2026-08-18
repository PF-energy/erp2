const express = require('express');
const { query } = require('../db');
const { rowActivity } = require('../utils');
const { logActivity } = require('../services/automationEngine');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const result = await query('SELECT * FROM activity WHERE org_id = $1 ORDER BY ts DESC LIMIT $2', [org, limit]);
    res.json(result.rows.map(rowActivity));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { tag, text, tone } = req.body;
    if (!tag || !text) return res.status(400).json({ error: 'tag and text are required' });
    res.status(201).json(await logActivity(org, tag, text, tone));
  } catch (err) { next(err); }
});

module.exports = router;
