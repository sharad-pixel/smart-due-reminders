import { motion } from "framer-motion";
import { Mail, Code2, Webhook, FileText } from "lucide-react";

type Integration = {
  name: string;
  body: string;
  logoSlug?: string;
  logoColor?: string; // hex without #
  icon?: typeof Mail;
};

const integrations: Integration[] = [
  { name: "Stripe", body: "Real-time invoice sync, payment reconciliation, and refund control.", logoSlug: "stripe", logoColor: "635BFF" },
  { name: "QuickBooks", body: "Bidirectional invoice, customer, and payment sync.", logoSlug: "quickbooks", logoColor: "2CA01C" },
  { name: "NetSuite", body: "Enterprise ERP sync with GL and multi-entity support.", logoSlug: "oracle", logoColor: "F80000" },
  { name: "Salesforce", body: "Contract → opportunity linkage with account context.", logoSlug: "salesforce", logoColor: "00A1E0" },
  { name: "HubSpot", body: "Customer engagement signals feeding risk scoring.", logoSlug: "hubspot", logoColor: "FF7A59" },
  { name: "Google Drive", body: "AI OCR on any contract or invoice folder.", logoSlug: "googledrive", logoColor: "4285F4" },
  { name: "Google Sheets", body: "Bidirectional source-of-truth spreadsheet sync.", logoSlug: "googlesheets", logoColor: "34A853" },
  { name: "Microsoft 365", body: "Outlook mail, calendar, and OneDrive ingestion.", logoSlug: "microsoft365", logoColor: "D83B01" },
  { name: "Email", body: "Inbound parsing, thread tracking, auto-categorization.", icon: Mail },
  { name: "REST API", body: "Programmatic access to every entity and event.", icon: Code2 },
  { name: "Webhooks", body: "Real-time event streams for downstream systems.", icon: Webhook },
  { name: "CSV Import", body: "Structured bulk import with validation.", icon: FileText },
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
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-background border border-border/60 transition group-hover:scale-110">
                  {it.logoSlug ? (
                    <img
                      src={`https://cdn.simpleicons.org/${it.logoSlug}/${it.logoColor ?? "000000"}`}
                      alt={`${it.name} logo`}
                      loading="lazy"
                      className="h-6 w-6 object-contain"
                    />
                  ) : it.icon ? (
                    <it.icon className="h-5 w-5 text-primary" />
                  ) : null}
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
