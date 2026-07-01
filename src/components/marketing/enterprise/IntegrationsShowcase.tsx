import { motion } from "framer-motion";
import { CreditCard, Database, Cloud, Users, Boxes, FileSpreadsheet, Mail, Code2, Webhook, FileText, ScanLine, HardDrive } from "lucide-react";

const integrations = [
  { icon: CreditCard, name: "Stripe", body: "Real-time invoice sync, payment reconciliation, and refund control." },
  { icon: Database, name: "QuickBooks", body: "Bidirectional invoice, customer, and payment sync." },
  { icon: Cloud, name: "NetSuite", body: "Enterprise ERP sync with GL and multi-entity support." },
  { icon: Users, name: "Salesforce", body: "Contract → opportunity linkage with account context." },
  { icon: Boxes, name: "HubSpot", body: "Customer engagement signals feeding risk scoring." },
  { icon: HardDrive, name: "Google Drive", body: "AI OCR on any contract or invoice folder." },
  { icon: FileSpreadsheet, name: "Google Sheets", body: "Bidirectional source-of-truth spreadsheet sync." },
  { icon: Cloud, name: "Microsoft 365", body: "Outlook mail, calendar, and OneDrive ingestion." },
  { icon: Mail, name: "Email", body: "Inbound parsing, thread tracking, auto-categorization." },
  { icon: Code2, name: "REST API", body: "Programmatic access to every entity and event." },
  { icon: Webhook, name: "Webhooks", body: "Real-time event streams for downstream systems." },
  { icon: FileText, name: "CSV Import", body: "Structured bulk import with validation." },
];

export default function IntegrationsShowcase() {
  return (
    <section className="relative bg-secondary/40 py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Integrations</div>
          <h2 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Connected to your revenue stack.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Every contract, invoice, and customer signal — synchronized across the systems finance
            already runs on.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((it, i) => (
            <motion.div
              key={it.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-xl hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:scale-110">
                  <it.icon className="h-5 w-5" />
                </span>
                <div className="text-base font-semibold">{it.name}</div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{it.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
