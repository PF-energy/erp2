function slugify(s) {
  return (s || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
}

function rowLead(r) {
  return {
    id: r.id, name: r.name, type: r.type, stage: r.stage,
    value: r.value, lastContactDaysAgo: r.last_contact_days_ago, createdAt: r.created_at,
  };
}
function rowJob(r) {
  return {
    id: r.id, customer: r.customer, type: r.type, status: r.status,
    value: r.value, crew: r.crew, materialsOrdered: !!r.materials_ordered, createdAt: r.created_at,
  };
}
function rowInvoice(r) {
  return {
    id: r.id, customer: r.customer, amount: r.amount,
    dueInDays: r.due_in_days, status: r.status, createdAt: r.created_at,
  };
}
function rowActivity(r) {
  return { id: r.id, tag: r.tag, text: r.text, tone: r.tone, ts: r.ts };
}
function rowAutomation(r) {
  return {
    id: r.id, enabled: !!r.enabled, trigger: r.trigger_label,
    triggerTag: r.trigger_tag, action: r.action, tone: r.tone,
  };
}
function rowMaterial(r) {
  return { key: r.key, label: r.label, unit: r.unit, price: r.price, kwh: r.kwh ?? undefined };
}
function rowQuote(r) {
  return {
    id: r.id, number: r.number, kind: r.kind, customerName: r.customer_name, address: r.address,
    dateLabel: r.date_label, validDays: r.valid_days, validUntilLabel: r.valid_until_label,
    summary: r.summary, lines: JSON.parse(r.lines_json), marginPct: r.margin_pct, marginAmt: r.margin_amt,
    netTotal: r.net_total, vatAmt: r.vat_amt, totalIncVat: r.total_inc_vat, notes: r.notes,
    appendix: r.appendix_json ? JSON.parse(r.appendix_json) : [],
    leadId: r.lead_id || null,
    createdAt: r.created_at,
  };
}

module.exports = { slugify, rowLead, rowJob, rowInvoice, rowActivity, rowAutomation, rowMaterial, rowQuote };
