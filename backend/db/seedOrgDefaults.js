// Runs once, right after a new organization signs up. Seeds the starter
// materials price catalog and the standard automation rules so a brand
// new tenant has a working estimator on day one — but deliberately does
// NOT seed any demo leads/jobs/invoices/activity, since those would be
// fake data sitting in a real customer's account.

const { query } = require('./index');
const MATERIALS_SEED = require('./materialsSeed');

async function seedAutomations(orgId) {
  const rows = [
    ['auto-1', 1, 'Lead created', 'New Lead', 'Send intro email + schedule 2-day follow-up task', 'copper'],
    ['auto-2', 1, 'No contact for 3+ days', 'Idle Lead', 'Flag lead as stale + notify assigned rep', 'red'],
    ['auto-3', 1, 'Estimate sent to customer', 'Estimate Sent', 'Auto follow-up email after 3 days if no response', 'copper'],
    ['auto-4', 1, 'Lead marked Won', 'Lead Won', 'Create job, assign team, generate material order, send welcome pack', 'green'],
    ['auto-5', 1, 'Job marked Completed', 'Job Complete', 'Auto-generate invoice + send to customer + request review', 'green'],
    ['auto-6', 0, 'Invoice overdue 7+ days', 'Overdue', 'Send payment reminder + notify office manager', 'red'],
  ];
  for (let i = 0; i < rows.length; i++) {
    const [id, enabled, triggerLabel, triggerTag, action, tone] = rows[i];
    await query(
      `INSERT INTO automations (id, org_id, enabled, trigger_label, trigger_tag, action, tone, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (org_id, id) DO NOTHING`,
      [id, orgId, enabled, triggerLabel, triggerTag, action, tone, i]
    );
  }
}

async function seedMaterials(orgId) {
  for (const [category, items] of Object.entries(MATERIALS_SEED)) {
    for (const item of items) {
      const [key, label, unit, price, kwh] = item;
      await query(
        `INSERT INTO materials (org_id, category, key, label, unit, price, kwh)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (org_id, category, key) DO NOTHING`,
        [orgId, category, key, label, unit, price, kwh ?? null]
      );
    }
  }
}

async function seedOrgDefaults(orgId) {
  await seedAutomations(orgId);
  await seedMaterials(orgId);
}

module.exports = { seedOrgDefaults };
