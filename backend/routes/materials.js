const express = require('express');
const { query } = require('../db');
const { rowMaterial, slugify } = require('../utils');
const MATERIALS_SEED = require('../db/materialsSeed');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const VALID_CATEGORIES = new Set(Object.keys(MATERIALS_SEED));

function assertCategory(category, res) {
  if (!VALID_CATEGORIES.has(category)) {
    res.status(400).json({ error: `unknown category "${category}"` });
    return false;
  }
  return true;
}

// Reads are available to any signed-in user in the org (the estimator
// needs them). Writes (create/update/delete/reset a material) require the
// admin role — this replaces the old shared-password gate now that real
// per-user accounts exist.
router.get('/', async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const result = await query('SELECT * FROM materials WHERE org_id = $1 ORDER BY category, label', [org]);
    const grouped = {};
    for (const cat of VALID_CATEGORIES) grouped[cat] = [];
    for (const r of result.rows) grouped[r.category].push(rowMaterial(r));
    res.json(grouped);
  } catch (err) { next(err); }
});

router.post('/:category', requireAdmin, async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { category } = req.params;
    if (!assertCategory(category, res)) return;
    const { label, unit = 'unit', price = 0, kwh } = req.body;
    if (!label || !label.trim()) return res.status(400).json({ error: 'label is required' });

    let key = slugify(label);
    let n = 1;
    while ((await query('SELECT 1 FROM materials WHERE org_id = $1 AND category = $2 AND key = $3', [org, category, key])).rows.length) {
      key = `${slugify(label)}-${++n}`;
    }
    await query(
      'INSERT INTO materials (org_id, category, key, label, unit, price, kwh) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [org, category, key, label.trim(), unit, Number(price) || 0, kwh !== undefined ? Number(kwh) : null]
    );
    const row = await query('SELECT * FROM materials WHERE org_id = $1 AND category = $2 AND key = $3', [org, category, key]);
    res.status(201).json(rowMaterial(row.rows[0]));
  } catch (err) { next(err); }
});

router.put('/:category/:key', requireAdmin, async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { category, key } = req.params;
    if (!assertCategory(category, res)) return;
    const existingRes = await query('SELECT * FROM materials WHERE org_id = $1 AND category = $2 AND key = $3', [org, category, key]);
    const existing = existingRes.rows[0];
    if (!existing) return res.status(404).json({ error: 'material not found' });

    const label = req.body.label !== undefined ? req.body.label : existing.label;
    const unit = req.body.unit !== undefined ? req.body.unit : existing.unit;
    const price = req.body.price !== undefined ? Number(req.body.price) : existing.price;
    const kwh = req.body.kwh !== undefined ? Number(req.body.kwh) : existing.kwh;

    await query('UPDATE materials SET label=$1, unit=$2, price=$3, kwh=$4 WHERE org_id=$5 AND category=$6 AND key=$7',
      [label, unit, price, kwh, org, category, key]);

    const row = await query('SELECT * FROM materials WHERE org_id = $1 AND category = $2 AND key = $3', [org, category, key]);
    res.json(rowMaterial(row.rows[0]));
  } catch (err) { next(err); }
});

router.delete('/:category/:key', requireAdmin, async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { category, key } = req.params;
    const result = await query('DELETE FROM materials WHERE org_id = $1 AND category = $2 AND key = $3', [org, category, key]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'material not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

router.post('/:category/reset', requireAdmin, async (req, res, next) => {
  try {
    const org = req.user.orgId;
    const { category } = req.params;
    if (!assertCategory(category, res)) return;
    await query('DELETE FROM materials WHERE org_id = $1 AND category = $2', [org, category]);
    for (const [key, label, unit, price, kwh] of MATERIALS_SEED[category]) {
      await query('INSERT INTO materials (org_id, category, key, label, unit, price, kwh) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [org, category, key, label, unit, price, kwh ?? null]);
    }
    const rows = await query('SELECT * FROM materials WHERE org_id = $1 AND category = $2 ORDER BY label', [org, category]);
    res.json(rows.rows.map(rowMaterial));
  } catch (err) { next(err); }
});

module.exports = router;
