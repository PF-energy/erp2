const { query, nextId } = require('../db');

async function isAutomationEnabled(orgId, triggerTag) {
  const res = await query('SELECT enabled FROM automations WHERE org_id = $1 AND trigger_tag = $2', [orgId, triggerTag]);
  return res.rows[0] ? !!res.rows[0].enabled : false;
}

async function logActivity(orgId, tag, text, tone) {
  const id = await nextId(orgId, 'LOG');
  const ts = Date.now();
  await query(
    'INSERT INTO activity (id, org_id, tag, text, tone, ts) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, orgId, tag, text, tone || 'copper', ts]
  );
  return { id, tag, text, tone: tone || 'copper', ts };
}

module.exports = { isAutomationEnabled, logActivity };
