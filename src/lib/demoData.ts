// Demo Mode - Preloaded realistic mock data
// This data is NEVER written to production tables

import { personaConfig } from "@/lib/personaConfig";

export interface DemoCustomer {
  id: string;
  company_name: string;
  name: string;
  email: string;
  industry: string;
}

export interface DemoInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: "open" | "overdue" | "paid";
  customer_id: string;
  customer_name: string;
  contact_email: string;
  days_past_due: number;
  aging_bucket: string;
  currency: string;
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
}

const COMPANY_NAMES = [
  "Apex SaaS Co", "BrightPath Agency", "CloudNine Solutions", "DigitalEdge LLC",
  "Evergreen Landscaping", "FreshCoat Painting", "GrowthStack Inc", "Horizon Plumbing",
  "InnovateTech Labs", "JetStream Media", "KeyStone Construction", "LuminAI Corp",
  "MapleCrest Consulting", "NovaBridge Partners", "OmniFlow Systems", "PeakView Analytics",
  "QuickServe HVAC", "RedOak Financial", "SkyLab Digital", "TrueNorth Marketing",
  "UrbanPulse Design", "VeloCity Fitness", "WestEnd Catering", "XcelPro Services",
  "ZenithWorks Studio"
];

const INDUSTRIES = [
  "SaaS", "Agency", "Home Services", "SaaS", "Home Services",
  "Home Services", "SaaS", "Home Services", "SaaS", "Agency",
  "Home Services", "SaaS", "Agency", "Agency", "SaaS",
  "SaaS", "Home Services", "Agency", "Agency", "Agency",
  "Agency", "Home Services", "Home Services", "Agency", "Agency"
];

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
    "61-90": "Katy", "91-120": "Troy", "120+": "Rocco"
  };
  return map[bucket] || "Sam";
}

export function generateDemoCustomers(): DemoCustomer[] {
  return COMPANY_NAMES.map((name, i) => ({
    id: `demo-customer-${i}`,
    company_name: name,
    name: `Contact at ${name}`,
    email: `billing@${name.toLowerCase().replace(/\s+/g, "")}.com`,
    industry: INDUSTRIES[i],
  }));
}

export function generateDemoInvoices(customers: DemoCustomer[]): DemoInvoice[] {
  const invoices: DemoInvoice[] = [];
  // Distribution: ~30 current, ~45 overdue across buckets
  const bucketDistribution = [
    { bucket: "current", count: 30, dpdRange: [-15, 0] },
    { bucket: "1-30", count: 12, dpdRange: [1, 30] },
    { bucket: "31-60", count: 10, dpdRange: [31, 60] },
    { bucket: "61-90", count: 10, dpdRange: [61, 90] },
    { bucket: "91-120", count: 7, dpdRange: [91, 120] },
    { bucket: "120+", count: 6, dpdRange: [121, 180] },
  ];

  let idx = 0;
  for (const { count, dpdRange } of bucketDistribution) {
    for (let i = 0; i < count; i++) {
      const customer = customers[idx % customers.length];
      const dpd = Math.floor(Math.random() * (dpdRange[1] - dpdRange[0] + 1)) + dpdRange[0];
      const amount = Math.round((Math.random() * 8000 + 500) * 100) / 100;
      const bucket = getBucket(dpd);
      invoices.push({
        id: `demo-inv-${idx}`,
        invoice_number: `INV-${String(2024000 + idx).padStart(7, "0")}`,
        amount,
        due_date: generateDate(dpd),
        status: dpd > 0 ? "overdue" : "open",
        customer_id: customer.id,
        customer_name: customer.company_name,
        contact_email: customer.email,
        days_past_due: Math.max(0, dpd),
        aging_bucket: bucket,
        currency: "USD",
      });
      idx++;
    }
  }
  return invoices;
}

export function generateDemoDrafts(invoices: DemoInvoice[]): DemoDraft[] {
  const overdueInvoices = invoices.filter(inv => inv.status === "overdue");
  return overdueInvoices.map((inv, i) => {
    const persona = getPersonaForBucket(inv.aging_bucket);
    const toneMap: Record<string, { subject: string; body: string }> = {
      "Sam": {
        subject: `Friendly reminder: Invoice ${inv.invoice_number} is outstanding`,
        body: `Hi ${inv.customer_name},\n\nJust a quick note — invoice ${inv.invoice_number} for $${inv.amount.toLocaleString()} is still open. If it's already been taken care of, please disregard this message!\n\nHappy to help if you have any questions.\n\nBest,\nSam`
      },
      "James": {
        subject: `Follow-up: Invoice ${inv.invoice_number} — ${inv.days_past_due} days past due`,
        body: `Hello ${inv.customer_name},\n\nThis is a follow-up regarding invoice ${inv.invoice_number} for $${inv.amount.toLocaleString()}, which is now ${inv.days_past_due} days past the due date.\n\nPlease arrange payment at your earliest convenience. Let us know if there are any issues we can help resolve.\n\nRegards,\nJames`
      },
      "Katy": {
        subject: `Action Required: Invoice ${inv.invoice_number} — ${inv.days_past_due} days overdue`,
        body: `Dear ${inv.customer_name},\n\nInvoice ${inv.invoice_number} ($${inv.amount.toLocaleString()}) is now ${inv.days_past_due} days past due. We need your immediate attention on this matter.\n\nPlease remit payment or contact us to discuss a resolution.\n\nSincerely,\nKaty`
      },
      "Troy": {
        subject: `Final Notice: Invoice ${inv.invoice_number} — Immediate Payment Required`,
        body: `${inv.customer_name},\n\nThis is a final notice regarding invoice ${inv.invoice_number} for $${inv.amount.toLocaleString()}, now ${inv.days_past_due} days overdue.\n\nFailure to resolve this balance may result in escalation. Please contact us immediately.\n\nTroy`
      },
      "Rocco": {
        subject: `URGENT: Invoice ${inv.invoice_number} — Account Escalation`,
        body: `${inv.customer_name},\n\nYour account has been flagged for escalation. Invoice ${inv.invoice_number} ($${inv.amount.toLocaleString()}) is ${inv.days_past_due} days past due.\n\nImmediate payment is required to avoid further action. Contact us today.\n\nRocco`
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
