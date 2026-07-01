import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export default function EnterpriseFinalCTA() {
  return (
    <section className="dark relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/25 blur-[160px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.06]" />
      </div>

      <div className="container relative mx-auto px-6 py-32 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-4xl text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02]"
        >
          Protect revenue from{" "}
          <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            contract to cash.
          </span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
        >
          Recouply transforms every commercial agreement into financial intelligence and every
          customer interaction into predictable cash flow.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-10 flex flex-wrap justify-center gap-3"
        >
          <Link
            to="/contact-us?topic=enterprise-demo"
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:shadow-primary/50"
          >
            Schedule Enterprise Demo
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/contact-us?topic=sales"
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-6 py-3.5 text-sm font-semibold backdrop-blur transition hover:bg-card/70"
          >
            <MessageSquare className="h-4 w-4" />
            Talk to Sales
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
