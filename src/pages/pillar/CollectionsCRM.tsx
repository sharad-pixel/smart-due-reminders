import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Link } from "react-router-dom";

const CollectionsCRM = () => {
  return (
    <MarketingLayout>
      <SEOHead
        title="Collections CRM | AI-Powered Collections & Risk Intelligence CRM — Recouply.ai"
        description="Recouply.ai is the Collections CRM built for finance teams. Centralize receivables, prioritize by risk, automate outreach, and maintain a full audit trail — replacing spreadsheets and legacy tools with an intelligent system of record."
        keywords="collections CRM, accounts receivable CRM, AI collections CRM, collections management software, AR CRM platform, collections system of record, receivables CRM, debt collection CRM, B2B collections CRM, collections workflow CRM"
        canonical="https://recouply.ai/collections-crm"
        breadcrumbs={[{ name: "Collections CRM", url: "https://recouply.ai/collections-crm" }]}
      />

      <article className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
        <header>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6">
            Collections CRM: The System of Record for Revenue Recovery
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-12">
            Recouply.ai is the first CRM purpose-built for collections and accounts receivable teams.
            Centralize every invoice, debtor interaction, risk signal, and outreach touchpoint in one
            intelligent platform — so nothing falls through the cracks and every dollar is accounted for.
          </p>
        </header>

        <section className="prose prose-lg max-w-none dark:prose-invert mb-12">
          <h2>Why Collections Needs Its Own CRM</h2>
          <p>
            Sales teams have Salesforce. Support teams have Zendesk. But collections teams — responsible
            for recovering billions in outstanding receivables — have been stuck with spreadsheets, shared
            inboxes, and disconnected billing tools. Recouply.ai changes that by delivering a dedicated
            Collections CRM with AI-powered workflows, risk-based prioritization, and a complete audit trail
            of every customer touchpoint.
          </p>
          <p>
            Unlike generic CRMs retrofitted for AR, Recouply is built from the ground up around the
            collections lifecycle: invoice aging, debtor segmentation, outreach cadences, payment tracking,
            dispute resolution, and compliance — all unified in a single workspace.
          </p>

          <h2>Core Capabilities of Recouply's Collections CRM</h2>
          <ul>
            <li><strong>Centralized Receivables Dashboard</strong> — View every invoice, debtor, and payment status in one place with real-time AR aging analysis.</li>
            <li><strong>Risk-Based Account Prioritization</strong> — AI-driven Collectability Scores (0–100) automatically rank accounts by recovery probability, so your team focuses where it matters most.</li>
            <li><strong>Full Outreach Audit Trail</strong> — Every email, SMS, call note, and debtor response is logged and time-stamped for compliance and team visibility.</li>
            <li><strong>AI-Powered Collection Workflows</strong> — Autonomous agents handle outreach cadences, tone adaptation, and escalation — with human approval at every step.</li>
            <li><strong>Debtor Intelligence Profiles</strong> — Unified profiles combining payment history, engagement signals, dispute records, and CRM data for 360° visibility.</li>
            <li><strong>Team Collaboration</strong> — Assign accounts, share notes, and manage workloads across your AR team with role-based access controls.</li>
          </ul>

          <h2>How Recouply Compares to Traditional AR Tools</h2>
          <p>
            Legacy AR tools focus on invoicing and payment processing. Recouply goes further by adding
            relationship management, behavioral analytics, and predictive intelligence — turning your AR
            department from a back-office function into a strategic revenue operation.
          </p>

          <h2>Built for Finance Teams, Not Salespeople</h2>
          <p>
            Recouply's Collections CRM speaks the language of AR professionals. Our data model understands
            invoices, aging buckets, payment terms, credit limits, and debtor hierarchies natively — no
            custom fields or workarounds required.
          </p>

          <h2>Integrations That Power Your Collections CRM</h2>
          <p>
            Connect your existing billing stack to sync invoices and payments automatically. Recouply
            integrates with <Link to="/integrations" className="text-primary hover:underline">Stripe, QuickBooks, Google Sheets, and more</Link> for
            seamless data flow.
          </p>

          <h2>From Spreadsheets to System of Record</h2>
          <p>
            The shift from spreadsheets to a purpose-built Collections CRM isn't just about efficiency — it's
            about creating an auditable, intelligent, and scalable foundation for revenue recovery. Read more
            in our deep dive: <Link to="/blog/spreadsheets-to-systems-of-record" className="text-primary hover:underline">From Spreadsheets to Systems of Record</Link>.
          </p>
        </section>

        <nav className="border-t border-border pt-10" aria-label="Related content">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Explore More</h2>
          <ul className="grid sm:grid-cols-2 gap-4 text-base">
            <li><Link to="/features" className="text-primary hover:underline">Platform Features →</Link></li>
            <li><Link to="/collection-intelligence" className="text-primary hover:underline">Collection Intelligence →</Link></li>
            <li><Link to="/ai-collections-platform" className="text-primary hover:underline">AI Collections Platform →</Link></li>
            <li><Link to="/revenue-risk-intelligence" className="text-primary hover:underline">Revenue Risk Intelligence →</Link></li>
            <li><Link to="/automation" className="text-primary hover:underline">Automation & Workflows →</Link></li>
            <li><Link to="/pricing" className="text-primary hover:underline">Pricing Plans →</Link></li>
            <li><Link to="/blog/why-collections-needs-a-crm" className="text-primary hover:underline">Blog: Why Collections Needs a CRM →</Link></li>
            <li><Link to="/blog/death-of-traditional-collections" className="text-primary hover:underline">Blog: Death of Traditional Collections →</Link></li>
            <li><Link to="/blog/set-it-and-forget-it-automation" className="text-primary hover:underline">Blog: Set It and Forget It →</Link></li>
            <li><Link to="/blog/risk-as-a-real-time-operational-system" className="text-primary hover:underline">Blog: Risk as a Real-Time System →</Link></li>
            <li><Link to="/solutions" className="text-primary hover:underline">Solutions by Company Size →</Link></li>
            <li><Link to="/integrations" className="text-primary hover:underline">Integrations →</Link></li>
          </ul>
        </nav>
      </article>
    </MarketingLayout>
  );
};

export default CollectionsCRM;
