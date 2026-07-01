import { motion } from "framer-motion";
import { Lock, Workflow, ScrollText, Shield, Code2, Webhook, Key, Users, Building, Chrome, Boxes, FileSpreadsheet } from "lucide-react";

const items = [
  { icon: Lock, label: "Role-Based Access" },
  { icon: Workflow, label: "Approval Workflows" },
  { icon: ScrollText, label: "Audit Logs" },
  { icon: Shield, label: "SOC 2 Ready Architecture" },
  { icon: Code2, label: "API First" },
  { icon: Webhook, label: "Webhook Support" },
  { icon: Key, label: "SSO" },
  { icon: Users, label: "Custom Roles" },
  { icon: Building, label: "Multi Entity" },
  { icon: Chrome, label: "Google Workspace" },
  { icon: Boxes, label: "Microsoft 365" },
  { icon: FileSpreadsheet, label: "CSV & Sheets" },
];

export default function EnterpriseFeaturesSection() {
  return (
    <section className="relative bg-background py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Enterprise</div>
          <h2 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Built for finance teams that can't compromise.
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Security, governance, and interoperability engineered for enterprise from day one.
          </p>
        </div>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <motion.div
              key={it.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.03 }}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <it.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{it.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
