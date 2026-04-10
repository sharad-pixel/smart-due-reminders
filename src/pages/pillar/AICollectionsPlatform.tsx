import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Link } from "react-router-dom";

const AICollectionsPlatform = () => {
  return (
    <MarketingLayout>
      <SEOHead
        title="AI Collections Platform | Autonomous Revenue Recovery — Recouply.ai"
        description="Recouply.ai is the AI collections platform that deploys autonomous agents to manage outreach, assess risk, and recover revenue — with human oversight at every decision point. Replace manual follow-ups with intelligent, adaptive workflows."
        keywords="AI collections platform, AI accounts receivable, autonomous collections, AI debt collection software, AI-powered AR, agentic AI collections, AI invoice recovery, machine learning collections, automated collections platform, AI dunning software"
        canonical="https://recouply.ai/ai-collections-platform"
        breadcrumbs={[{ name: "AI Collections Platform", url: "https://recouply.ai/ai-collections-platform" }]}
      />

      <article className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
        <header>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6">
            AI Collections Platform: Autonomous Agents for Revenue Recovery
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-12">
            Recouply.ai deploys six specialized AI agents that independently manage the entire revenue
            recovery lifecycle — from personalized outreach and tone adaptation to dispute triage and
            escalation — all with human approval before any communication is sent.
          </p>
        </header>

        <section className="prose prose-lg max-w-none dark:prose-invert mb-12">
          <h2>What Makes Recouply's AI Collections Different</h2>
          <p>
            Most "AI" AR tools bolt a language model onto a template engine. Recouply takes a fundamentally
            different approach: our platform uses agentic AI — autonomous agents that reason about each
            account's context, payment history, risk profile, and engagement signals to determine the
            optimal outreach strategy, timing, tone, and channel.
          </p>

          <h2>The Six AI Agents Powering Recouply</h2>
          <ol>
            <li><strong>Outreach Agent</strong> — Generates personalized collection messages adapted to debtor context, invoice age, and payment behavior patterns.</li>
            <li><strong>Risk Scoring Agent</strong> — Calculates real-time Collectability Scores (0–100) and Expected Credit Loss using behavioral and transactional signals.</li>
            <li><strong>Email Triage Agent</strong> — Reads inbound debtor replies, classifies intent (payment promise, dispute, request for info), and routes to the appropriate workflow.</li>
            <li><strong>Escalation Agent</strong> — Monitors account trajectories and triggers multi-level escalation sequences when recovery probability drops below thresholds.</li>
            <li><strong>Persona Agent</strong> — Selects and adapts <Link to="/personas" className="text-primary hover:underline">communication personas</Link> based on debtor segment and outreach stage.</li>
            <li><strong>Scheduling Agent</strong> — Optimizes send timing based on historical engagement data and debtor timezone analysis.</li>
          </ol>

          <h2>Human-in-the-Loop by Design</h2>
          <p>
            Every AI-generated draft passes through a review queue before sending. Your team can edit tone,
            swap personas, approve individually or in bulk, and override any agent decision. This isn't
            autopilot — it's augmented intelligence that amplifies your team's capacity without sacrificing control.
          </p>

          <h2>Adaptive Workflows, Not Static Templates</h2>
          <p>
            Traditional dunning relies on fixed email sequences triggered by aging buckets. Recouply's AI
            platform dynamically adjusts outreach cadence, message content, and escalation timing based on
            real-time debtor behavior — opens, replies, partial payments, disputes, and silence all inform
            the next action. Learn more about our <Link to="/automation" className="text-primary hover:underline">automation engine</Link>.
          </p>

          <h2>Multi-Channel Intelligence</h2>
          <p>
            Recouply orchestrates outreach across email and SMS, with channel selection optimized per debtor
            based on historical response rates and engagement patterns.
          </p>

          <h2>Built on Real Data, Not Guesses</h2>
          <p>
            Every AI decision is grounded in your actual invoice data, payment history, and debtor
            interactions — synced from <Link to="/integrations" className="text-primary hover:underline">Stripe, QuickBooks, and other integrations</Link>.
            No training on generic datasets. Your data stays private and powers your specific recovery outcomes.
          </p>

          <h2>The Future of AI in Collections</h2>
          <p>
            Autonomous, adaptive, and accountable — that's where collections technology is heading. Read our
            analysis: <Link to="/blog/future-of-ai-in-collections" className="text-primary hover:underline">The Future of AI in Collections</Link>.
          </p>
        </section>

        <nav className="border-t border-border pt-10" aria-label="Related content">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Explore More</h2>
          <ul className="grid sm:grid-cols-2 gap-4 text-base">
            <li><Link to="/features" className="text-primary hover:underline">Platform Features →</Link></li>
            <li><Link to="/collections-crm" className="text-primary hover:underline">Collections CRM →</Link></li>
            <li><Link to="/revenue-risk-intelligence" className="text-primary hover:underline">Revenue Risk Intelligence →</Link></li>
            <li><Link to="/collection-intelligence" className="text-primary hover:underline">Collection Intelligence →</Link></li>
            <li><Link to="/personas" className="text-primary hover:underline">AI Agent Personas →</Link></li>
            <li><Link to="/ai-command-center" className="text-primary hover:underline">AI Command Center →</Link></li>
            <li><Link to="/pricing" className="text-primary hover:underline">Pricing Plans →</Link></li>
            <li><Link to="/blog/death-of-traditional-collections" className="text-primary hover:underline">Blog: Death of Traditional Collections →</Link></li>
            <li><Link to="/blog/rise-of-collections-intelligence" className="text-primary hover:underline">Blog: Rise of Collections Intelligence →</Link></li>
            <li><Link to="/blog/set-it-and-forget-it-automation" className="text-primary hover:underline">Blog: Set It and Forget It →</Link></li>
            <li><Link to="/solutions" className="text-primary hover:underline">Solutions by Company Size →</Link></li>
            <li><Link to="/integrations" className="text-primary hover:underline">Integrations →</Link></li>
          </ul>
        </nav>
      </article>
    </MarketingLayout>
  );
};

export default AICollectionsPlatform;
