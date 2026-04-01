// Demo Mode - Preloaded realistic mock data
// This data is NEVER written to production tables


export interface DemoCustomer {
  id: string;
  company_name: string;
  contact_first: string;
  contact_last: string;
  name: string;
  email: string;
  phone: string;
  industry: string;
  payment_terms: string;
  avg_days_to_pay: number;
  risk_score: number;
  risk_tier: "low" | "moderate" | "at_risk" | "high";
  last_payment_date: string | null;
  total_lifetime_revenue: number;
  open_balance: number;
  notes: string;
}

export interface DemoInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  issue_date: string;
  status: "open" | "overdue" | "paid";
  customer_id: string;
  customer_name: string;
  contact_email: string;
  contact_name: string;
  days_past_due: number;
  aging_bucket: string;
  currency: string;
  line_items: { description: string; qty: number; rate: number; total: number }[];
  po_number: string | null;
  payment_method: string | null;
  collectability_score: number;
  ai_recommendation: string;
}

export interface DemoDraft {
  id: string;
  invoice_id: string;
  customer_name: string;
  subject: string;
  body: string;
  status: "pending_approval" | "approved" | "sent";
  persona: string;
  aging_bucket: string;
  created_at: string;
  channel: "email" | "sms";
  scheduled_date: string;
}

export interface DemoPaymentHistory {
  id: string;
  customer_id: string;
  invoice_number: string;
  amount: number;
  paid_date: string;
  days_late: number;
  method: string;
}

// ─── Raw seed data ──────────────────────────────────────────────

const COMPANIES: {
  name: string; industry: string; terms: string; avgDays: number;
  contactFirst: string; contactLast: string; risk: "low" | "moderate" | "at_risk" | "high";
  riskScore: number; ltv: number; notes: string;
}[] = [
  { name: "Apex SaaS Co", industry: "SaaS", terms: "Net 30", avgDays: 22, contactFirst: "Sarah", contactLast: "Mitchell", risk: "moderate", riskScore: 65, ltv: 84000, notes: "Paying slower since Q3 — monitor closely" },
  { name: "BrightPath Agency", industry: "Agency", terms: "Net 15", avgDays: 8, contactFirst: "David", contactLast: "Chen", risk: "low", riskScore: 92, ltv: 42000, notes: "Consistently fast payer" },
  { name: "CloudNine Solutions", industry: "SaaS", terms: "Net 30", avgDays: 35, contactFirst: "Maria", contactLast: "Rodriguez", risk: "at_risk", riskScore: 44, ltv: 115000, notes: "Missed last two payments — escalate" },
  { name: "DigitalEdge LLC", industry: "Agency", terms: "Net 30", avgDays: 28, contactFirst: "James", contactLast: "Park", risk: "moderate", riskScore: 61, ltv: 38000, notes: "Occasional disputes on line items" },
  { name: "Evergreen Landscaping", industry: "Home Services", terms: "Net 15", avgDays: 12, contactFirst: "Tom", contactLast: "Bradley", risk: "low", riskScore: 88, ltv: 25000, notes: "Reliable — seasonal billing pattern" },
  { name: "FreshCoat Painting", industry: "Home Services", terms: "Due on Receipt", avgDays: 45, contactFirst: "Linda", contactLast: "Nguyen", risk: "high", riskScore: 28, ltv: 18000, notes: "4 months since last payment — escalate to collections" },
  { name: "GrowthStack Inc", industry: "SaaS", terms: "Net 45", avgDays: 58, contactFirst: "Ryan", contactLast: "Foster", risk: "high", riskScore: 22, ltv: 156000, notes: "Dispute filed on 2 invoices — assign to dispute team" },
  { name: "Horizon Plumbing", industry: "Home Services", terms: "Net 15", avgDays: 18, contactFirst: "Kevin", contactLast: "O'Brien", risk: "low", riskScore: 85, ltv: 31000, notes: "Good relationship — pays on reminder" },
  { name: "InnovateTech Labs", industry: "SaaS", terms: "Net 30", avgDays: 32, contactFirst: "Emily", contactLast: "Zhao", risk: "moderate", riskScore: 58, ltv: 92000, notes: "Large account — some invoices consistently late" },
  { name: "JetStream Media", industry: "Agency", terms: "Net 30", avgDays: 25, contactFirst: "Alex", contactLast: "Turner", risk: "low", riskScore: 81, ltv: 47000, notes: "Reliable payer with occasional 5-day delay" },
  { name: "KeyStone Construction", industry: "Home Services", terms: "Net 30", avgDays: 42, contactFirst: "Mark", contactLast: "Sullivan", risk: "at_risk", riskScore: 39, ltv: 62000, notes: "Cash-flow issues reported — offer payment plan" },
  { name: "LuminAI Corp", industry: "SaaS", terms: "Net 30", avgDays: 15, contactFirst: "Priya", contactLast: "Sharma", risk: "low", riskScore: 95, ltv: 210000, notes: "Top account — auto-pay enabled" },
  { name: "MapleCrest Consulting", industry: "Agency", terms: "Net 30", avgDays: 30, contactFirst: "Rachel", contactLast: "Kim", risk: "moderate", riskScore: 68, ltv: 55000, notes: "Pays on time but occasionally needs a reminder" },
  { name: "NovaBridge Partners", industry: "Agency", terms: "Net 45", avgDays: 50, contactFirst: "Derek", contactLast: "Williams", risk: "at_risk", riskScore: 42, ltv: 78000, notes: "Stretching terms — trending toward escalation" },
  { name: "OmniFlow Systems", industry: "SaaS", terms: "Net 30", avgDays: 20, contactFirst: "Jessica", contactLast: "Martinez", risk: "low", riskScore: 87, ltv: 135000, notes: "Enterprise client — reliable" },
  { name: "PeakView Analytics", industry: "SaaS", terms: "Net 30", avgDays: 27, contactFirst: "Chris", contactLast: "Anderson", risk: "moderate", riskScore: 72, ltv: 68000, notes: "Occasional disputes but resolves quickly" },
  { name: "QuickServe HVAC", industry: "Home Services", terms: "Due on Receipt", avgDays: 38, contactFirst: "Steve", contactLast: "Jackson", risk: "at_risk", riskScore: 45, ltv: 22000, notes: "Multiple overdue — assign escalation agent" },
  { name: "RedOak Financial", industry: "Agency", terms: "Net 30", avgDays: 14, contactFirst: "Laura", contactLast: "Thompson", risk: "low", riskScore: 91, ltv: 94000, notes: "Fast payer — high-value relationship" },
  { name: "SkyLab Digital", industry: "Agency", terms: "Net 30", avgDays: 33, contactFirst: "Dan", contactLast: "Murphy", risk: "moderate", riskScore: 63, ltv: 41000, notes: "Slowing trend since March" },
  { name: "TrueNorth Marketing", industry: "Agency", terms: "Net 15", avgDays: 10, contactFirst: "Megan", contactLast: "Clark", risk: "low", riskScore: 89, ltv: 36000, notes: "Always pays early" },
  { name: "UrbanPulse Design", industry: "Agency", terms: "Net 30", avgDays: 40, contactFirst: "Jason", contactLast: "Lee", risk: "at_risk", riskScore: 47, ltv: 28000, notes: "Non-responsive to last 2 emails" },
  { name: "VeloCity Fitness", industry: "Home Services", terms: "Net 15", avgDays: 55, contactFirst: "Amanda", contactLast: "Davis", risk: "high", riskScore: 31, ltv: 15000, notes: "Ceased communication — consider collections agency" },
  { name: "WestEnd Catering", industry: "Home Services", terms: "Due on Receipt", avgDays: 20, contactFirst: "Mike", contactLast: "Brown", risk: "low", riskScore: 83, ltv: 19000, notes: "Pays promptly when reminded" },
  { name: "XcelPro Services", industry: "Agency", terms: "Net 30", avgDays: 36, contactFirst: "Katie", contactLast: "White", risk: "moderate", riskScore: 56, ltv: 52000, notes: "Seasonal cash-flow — offer flexible terms Q1/Q3" },
  { name: "ZenithWorks Studio", industry: "Agency", terms: "Net 30", avgDays: 24, contactFirst: "Brian", contactLast: "Taylor", risk: "low", riskScore: 82, ltv: 33000, notes: "Small but reliable account" },
];

const LINE_ITEM_TEMPLATES = [
  { description: "Monthly SaaS License", rate: 2500 },
  { description: "API Usage Overage", rate: 450 },
  { description: "Professional Services", rate: 3200 },
  { description: "Consulting Hours (20h)", rate: 4000 },
  { description: "Data Migration Package", rate: 1800 },
  { description: "Support Plan — Premium", rate: 1200 },
  { description: "Design Services", rate: 2800 },
  { description: "Email Campaign Setup", rate: 950 },
  { description: "Quarterly Retainer", rate: 6500 },
  { description: "Equipment Rental", rate: 750 },
  { description: "Website Maintenance", rate: 1100 },
  { description: "Annual License Renewal", rate: 7500 },
];

const PAYMENT_METHODS = ["ACH Transfer", "Credit Card", "Wire Transfer", "Check", "PayPal"];

const AI_RECOMMENDATIONS: Record<string, string[]> = {
  "current": ["No action needed — invoice is on track", "Monitor — due date approaching"],
  "1-30": ["Send friendly reminder via Sam agent", "Schedule follow-up in 5 days if no response"],
  "31-60": ["Escalate to James agent for professional follow-up", "Offer payment plan if customer requests", "Call to confirm invoice was received"],
  "61-90": ["Assign Katy agent — firm tone required", "Recommend 10% early-pay discount to accelerate", "Flag for weekly AR review"],
  "91-120": ["Assign Troy agent — final notice cadence", "Offer structured payment plan (3 installments)", "Prepare for potential write-off if no response"],
  "120+": ["Assign Rocco agent — escalation mode", "Consider third-party collections referral", "Last attempt: offer 15% settlement discount"],
};

// ─── Deterministic seeded random ─────────────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function generateDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function getBucket(dpd: number): string {
  if (dpd <= 0) return "current";
  if (dpd <= 30) return "1-30";
  if (dpd <= 60) return "31-60";
  if (dpd <= 90) return "61-90";
  if (dpd <= 120) return "91-120";
  return "120+";
}

function getPersonaForBucket(bucket: string): string {
  const map: Record<string, string> = {
    "current": "Sam", "1-30": "Sam", "31-60": "James",
    "61-90": "Katy", "91-120": "Troy", "120+": "Rocco",
  };
  return map[bucket] || "Sam";
}

function generatePhone(rand: () => number): string {
  const area = Math.floor(rand() * 800 + 200);
  const mid = Math.floor(rand() * 900 + 100);
  const end = Math.floor(rand() * 9000 + 1000);
  return `(${area}) ${mid}-${end}`;
}

// ─── Generators ──────────────────────────────────────────────────

export function generateDemoCustomers(): DemoCustomer[] {
  const rand = seededRandom(42);
  return COMPANIES.map((c, i) => {
    const daysAgo = Math.floor(rand() * 120) + 10;
    const lastPayment = c.risk === "high" ? null : generateDate(daysAgo);
    const openBal = Math.round((rand() * 15000 + 1000) * 100) / 100;
    return {
      id: `demo-customer-${i}`,
      company_name: c.name,
      contact_first: c.contactFirst,
      contact_last: c.contactLast,
      name: `${c.contactFirst} ${c.contactLast}`,
      email: `${c.contactFirst.toLowerCase()}.${c.contactLast.toLowerCase()}@${c.name.toLowerCase().replace(/\s+/g, "")}.com`,
      phone: generatePhone(rand),
      industry: c.industry,
      payment_terms: c.terms,
      avg_days_to_pay: c.avgDays,
      risk_score: c.riskScore,
      risk_tier: c.risk,
      last_payment_date: lastPayment,
      total_lifetime_revenue: c.ltv,
      open_balance: openBal,
      notes: c.notes,
    };
  });
}

export function generateDemoInvoices(customers: DemoCustomer[]): DemoInvoice[] {
  const rand = seededRandom(123);
  const invoices: DemoInvoice[] = [];

  const bucketDistribution = [
    { bucket: "current", count: 30, dpdRange: [-15, 0] as [number, number] },
    { bucket: "1-30", count: 12, dpdRange: [1, 30] as [number, number] },
    { bucket: "31-60", count: 10, dpdRange: [31, 60] as [number, number] },
    { bucket: "61-90", count: 10, dpdRange: [61, 90] as [number, number] },
    { bucket: "91-120", count: 7, dpdRange: [91, 120] as [number, number] },
    { bucket: "120+", count: 6, dpdRange: [121, 180] as [number, number] },
  ];

  let idx = 0;
  for (const { count, dpdRange } of bucketDistribution) {
    for (let i = 0; i < count; i++) {
      const customer = customers[idx % customers.length];
      const dpd = Math.floor(rand() * (dpdRange[1] - dpdRange[0] + 1)) + dpdRange[0];
      const numItems = Math.floor(rand() * 3) + 1;
      const items = Array.from({ length: numItems }, () => {
        const tmpl = LINE_ITEM_TEMPLATES[Math.floor(rand() * LINE_ITEM_TEMPLATES.length)];
        const qty = Math.floor(rand() * 3) + 1;
        return { description: tmpl.description, qty, rate: tmpl.rate, total: qty * tmpl.rate };
      });
      const amount = items.reduce((s, it) => s + it.total, 0);
      const bucket = getBucket(dpd);
      const recs = AI_RECOMMENDATIONS[bucket] || AI_RECOMMENDATIONS["current"];
      const collectScore = bucket === "current" ? Math.floor(rand() * 10 + 90)
        : bucket === "1-30" ? Math.floor(rand() * 15 + 70)
        : bucket === "31-60" ? Math.floor(rand() * 15 + 55)
        : bucket === "61-90" ? Math.floor(rand() * 15 + 35)
        : bucket === "91-120" ? Math.floor(rand() * 15 + 20)
        : Math.floor(rand() * 15 + 5);

      invoices.push({
        id: `demo-inv-${idx}`,
        invoice_number: `INV-${String(2024000 + idx).padStart(7, "0")}`,
        amount,
        due_date: generateDate(dpd),
        issue_date: generateDate(dpd + 30),
        status: dpd > 0 ? "overdue" : "open",
        customer_id: customer.id,
        customer_name: customer.company_name,
        contact_email: customer.email,
        contact_name: customer.name,
        days_past_due: Math.max(0, dpd),
        aging_bucket: bucket,
        currency: "USD",
        line_items: items,
        po_number: rand() > 0.5 ? `PO-${Math.floor(rand() * 90000 + 10000)}` : null,
        payment_method: rand() > 0.3 ? PAYMENT_METHODS[Math.floor(rand() * PAYMENT_METHODS.length)] : null,
        collectability_score: collectScore,
        ai_recommendation: recs[Math.floor(rand() * recs.length)],
      });
      idx++;
    }
  }
  return invoices;
}

export function generateDemoPaymentHistory(customers: DemoCustomer[]): DemoPaymentHistory[] {
  const rand = seededRandom(999);
  const history: DemoPaymentHistory[] = [];
  customers.forEach((c, ci) => {
    if (c.risk_tier === "high") return; // high-risk have no recent payments
    const numPayments = Math.floor(rand() * 4) + 1;
    for (let p = 0; p < numPayments; p++) {
      const daysAgo = Math.floor(rand() * 180) + 30;
      history.push({
        id: `demo-payment-${ci}-${p}`,
        customer_id: c.id,
        invoice_number: `INV-${String(2023000 + ci * 10 + p).padStart(7, "0")}`,
        amount: Math.round((rand() * 8000 + 500) * 100) / 100,
        paid_date: generateDate(daysAgo),
        days_late: Math.max(0, Math.floor(rand() * c.avg_days_to_pay * 1.5) - 30),
        method: PAYMENT_METHODS[Math.floor(rand() * PAYMENT_METHODS.length)],
      });
    }
  });
  return history;
}

export function generateDemoDrafts(invoices: DemoInvoice[]): DemoDraft[] {
  const rand = seededRandom(456);
  const overdueInvoices = invoices.filter(inv => inv.status === "overdue");
  return overdueInvoices.map((inv, i) => {
    const persona = getPersonaForBucket(inv.aging_bucket);
    const scheduleDaysFromNow = Math.floor(rand() * 7);
    const toneMap: Record<string, { subject: string; body: string }> = {
      "Sam": {
        subject: `Friendly reminder: Invoice ${inv.invoice_number} is outstanding`,
        body: `Hi ${inv.contact_name},\n\nJust a quick note — invoice ${inv.invoice_number} for $${inv.amount.toLocaleString()} is still open. If it's already been taken care of, please disregard this message!\n\nHappy to help if you have any questions.\n\nBest,\nSam`,
      },
      "James": {
        subject: `Follow-up: Invoice ${inv.invoice_number} — ${inv.days_past_due} days past due`,
        body: `Hello ${inv.contact_name},\n\nThis is a follow-up regarding invoice ${inv.invoice_number} for $${inv.amount.toLocaleString()}, which is now ${inv.days_past_due} days past the due date.\n\nPlease arrange payment at your earliest convenience. Let us know if there are any issues we can help resolve.\n\nRegards,\nJames`,
      },
      "Katy": {
        subject: `Action Required: Invoice ${inv.invoice_number} — ${inv.days_past_due} days overdue`,
        body: `Dear ${inv.contact_name},\n\nInvoice ${inv.invoice_number} ($${inv.amount.toLocaleString()}) is now ${inv.days_past_due} days past due. We need your immediate attention on this matter.\n\nPlease remit payment or contact us to discuss a resolution.\n\nSincerely,\nKaty`,
      },
      "Troy": {
        subject: `Final Notice: Invoice ${inv.invoice_number} — Immediate Payment Required`,
        body: `${inv.contact_name},\n\nThis is a final notice regarding invoice ${inv.invoice_number} for $${inv.amount.toLocaleString()}, now ${inv.days_past_due} days overdue.\n\nFailure to resolve this balance may result in escalation. Please contact us immediately.\n\nTroy`,
      },
      "Rocco": {
        subject: `URGENT: Invoice ${inv.invoice_number} — Account Escalation`,
        body: `${inv.contact_name},\n\nYour account has been flagged for escalation. Invoice ${inv.invoice_number} ($${inv.amount.toLocaleString()}) is ${inv.days_past_due} days past due.\n\nImmediate payment is required to avoid further action. Contact us today.\n\nRocco`,
      },
    };
    const template = toneMap[persona] || toneMap["Sam"];
    return {
      id: `demo-draft-${i}`,
      invoice_id: inv.id,
      customer_name: inv.customer_name,
      subject: template.subject,
      body: template.body,
      status: "pending_approval" as const,
      persona,
      aging_bucket: inv.aging_bucket,
      created_at: new Date().toISOString(),
      channel: rand() > 0.85 ? "sms" as const : "email" as const,
      scheduled_date: generateDate(-scheduleDaysFromNow),
    };
  });
}

export function getDemoAgingBuckets(invoices: DemoInvoice[]) {
  const buckets: Record<string, { invoices: DemoInvoice[]; count: number; total: number }> = {
    current: { invoices: [], count: 0, total: 0 },
    "1-30": { invoices: [], count: 0, total: 0 },
    "31-60": { invoices: [], count: 0, total: 0 },
    "61-90": { invoices: [], count: 0, total: 0 },
    "91-120": { invoices: [], count: 0, total: 0 },
    "120+": { invoices: [], count: 0, total: 0 },
  };
  for (const inv of invoices) {
    const b = buckets[inv.aging_bucket];
    if (b) {
      b.invoices.push(inv);
      b.count++;
      b.total += inv.amount;
    }
  }
  return buckets;
}

export function getDemoStats(invoices: DemoInvoice[]) {
  const overdue = invoices.filter(i => i.status === "overdue");
  const totalOverdue = overdue.reduce((s, i) => s + i.amount, 0);
  const totalAll = invoices.reduce((s, i) => s + i.amount, 0);
  return {
    totalInvoices: invoices.length,
    overdueCount: overdue.length,
    totalOverdue,
    totalAll,
    estimatedRecoverable: Math.round(totalOverdue * 0.25),
    estimatedRecoverableRange: {
      low: Math.round(totalOverdue * 0.15),
      high: Math.round(totalOverdue * 0.35),
    },
  };
}
