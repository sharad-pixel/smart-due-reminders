import MarketingLayout from "@/components/MarketingLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, User, Linkedin, Twitter, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import heroImage from "@/assets/blog/celebrate-cash-hero.png";
import founderImage from "@/assets/founder-sharad.jpg";

const CelebrateCash = () => {
  const navigate = useNavigate();
  const publishDate = "January 17, 2026";
  const readingTime = "5 min read";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  const handleShareLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent("We Ring the Gong for Bookings. Why Don't We Celebrate Cash?");
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
  };

  const handleShareTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent("Bookings are a promise — cash completes the deal. Great read from @RecouplyAI");
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  };

  return (
    <MarketingLayout>
      <SEO
        title="Why Cash Collection Deserves a Gong | Recouply.ai"
        description="Bookings are a promise — cash completes the deal. Learn why cash collection deserves the same celebration as bookings and how automation drives growth."
        canonical="https://recouply.ai/blog/celebrate-cash"
        keywords="cash collection, bookings, revenue, accounts receivable, collection intelligence, cash flow, SaaS finance"
        ogType="article"
        ogImage={heroImage}
      />

      <article className="py-8 md:py-12 lg:py-16">
        <div className="container mx-auto px-4">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          {/* Article Header */}
          <header className="max-w-4xl mx-auto text-center mb-10">
            {/* Category Badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              Collection Intelligence
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              We Ring the Gong for Bookings. Why Don't We Celebrate Cash?
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Bookings are a promise — cash completes the deal. Learn why cash collection deserves the same celebration.
            </p>

            {/* Author & Meta */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <div className="flex items-center gap-3">
                <img
                  src={founderImage}
                  alt="Sharad Chanana"
                  className="w-12 h-12 rounded-full object-cover border-2 border-background shadow-md"
                />
                <div className="text-left">
                  <div className="font-semibold text-sm">Sharad Chanana</div>
                  <div className="text-xs text-muted-foreground">Founder, Recouply.ai</div>
                </div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-border" />
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <time dateTime="2026-01-17">{publishDate}</time>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{readingTime}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Hero Image */}
          <div className="max-w-5xl mx-auto mb-12 md:mb-16">
            <div className="aspect-video rounded-2xl overflow-hidden bg-muted shadow-2xl">
              <img
                src={heroImage}
                alt="Illustration showing sales teams celebrating bookings with a gong while finance teams celebrate cash collection with a digital dashboard"
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          </div>

          {/* Article Content */}
          <div className="max-w-3xl mx-auto">
            {/* Share Bar - Sticky on Desktop */}
            <div className="hidden lg:flex flex-col gap-3 fixed left-8 top-1/2 -translate-y-1/2 z-40">
              <span className="text-xs font-medium text-muted-foreground mb-1">Share</span>
              <button
                onClick={handleShareLinkedIn}
                className="p-2.5 rounded-full bg-card border border-border hover:bg-muted hover:border-primary/50 transition-all shadow-sm"
                title="Share on LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </button>
              <button
                onClick={handleShareTwitter}
                className="p-2.5 rounded-full bg-card border border-border hover:bg-muted hover:border-primary/50 transition-all shadow-sm"
                title="Share on Twitter"
              >
                <Twitter className="h-4 w-4" />
              </button>
              <button
                onClick={handleCopyLink}
                className="p-2.5 rounded-full bg-card border border-border hover:bg-muted hover:border-primary/50 transition-all shadow-sm"
                title="Copy link"
              >
                <Link2 className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h2:text-2xl prose-h2:md:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-p:text-muted-foreground prose-p:leading-relaxed prose-li:text-muted-foreground prose-strong:text-foreground">
              
              <h2>Bookings Are Celebrated. Cash Is Quietly Chased.</h2>

              <p>
                Early in my career, I worked at companies where closing a deal was an event.
                A gong would ring. Slack would light up. Teams would celebrate.
              </p>

              <p>And they should — a booking represents momentum, trust, and growth.</p>

              <p>
                But over time, I noticed something uncomfortable: <strong>the celebration stopped at the promise.</strong>
              </p>

              {/* Callout Box */}
              <blockquote className="not-prose my-8 p-6 md:p-8 bg-muted/50 border-l-4 border-primary rounded-r-xl">
                <p className="text-lg md:text-xl font-medium text-foreground leading-relaxed mb-0">
                  A booking is not revenue.<br />
                  A booking is not cash.<br />
                  A booking is a promise to use a service in the future.
                </p>
              </blockquote>

              <p>That promise is only fulfilled when the cash is collected.</p>

              <p>
                Yet in most businesses, collections happen quietly in the background — with little visibility, limited ownership, and almost no celebration.
              </p>

              <h2>The Cost of Treating Cash as a Back-Office Function</h2>

              <p>
                Sales teams are built, trained, and incentivized around bookings.
                Finance and operations teams are left to manage collections reactively.
              </p>

              <p className="font-medium text-foreground">This disconnect leads to:</p>

              <ul className="space-y-2">
                <li>Strong bookings but inconsistent cash flow</li>
                <li>Revenue growth on paper with increasing financial risk</li>
                <li>Manual follow-ups, scattered emails, and fragmented systems</li>
                <li>Limited insight into customer payment behavior</li>
              </ul>

              <p>
                When cash isn't collected efficiently, growth becomes fragile — regardless of how strong bookings look.
              </p>

              <h2>Cash Collection Completes the Deal</h2>

              <p>
                Collecting cash isn't an administrative task.
                It's the final milestone of the deal lifecycle.
              </p>

              <p className="font-medium text-foreground">A customer only becomes a true customer when:</p>

              <ul className="space-y-2">
                <li>They receive value, and</li>
                <li>They pay for it</li>
              </ul>

              <p>Until then, the deal is incomplete.</p>

              {/* Highlight Box */}
              <div className="not-prose my-8 p-6 md:p-8 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl">
                <p className="text-lg md:text-xl font-semibold text-foreground leading-relaxed">
                  If bookings deserve a gong, cash collection deserves one too — because that's when value is fully realized for both the business and the customer.
                </p>
              </div>

              <h2>Why We Built Recouply.ai</h2>

              <p>This belief is why we built Recouply.ai.</p>

              <p>
                Recouply.ai is a <strong>Collection Intelligence Platform</strong> designed to give cash the same level of focus, automation, and visibility that businesses apply to bookings.
              </p>

              <p className="font-medium text-foreground">Traditional collections are often:</p>

              <ul className="space-y-2">
                <li>Manual and reactive</li>
                <li>Dependent on individuals and inboxes</li>
                <li>Lacking real-time insight and accountability</li>
              </ul>

              <p className="font-medium text-foreground">Recouply.ai helps businesses:</p>

              <ul className="space-y-2">
                <li><strong>Automate</strong> and orchestrate collection workflows</li>
                <li><strong>Engage</strong> customers consistently and professionally</li>
                <li><strong>Gain visibility</strong> into payment behavior and risk in real-time</li>
                <li><strong>Reduce</strong> days to pay and prevent bad debt before it happens</li>
              </ul>

              <p>
                Collections shouldn't be a last-mile scramble. They should be a strategic, intelligence-driven process.
              </p>

              <h2>Cash Flow Is a Growth Strategy</h2>

              <p>Cash flow isn't just a finance metric — it's a growth enabler.</p>

              <p className="font-medium text-foreground">When businesses have full engagement and insight into how cash is collected:</p>

              <ul className="space-y-2">
                <li>Forecasting improves</li>
                <li>Risk is identified earlier</li>
                <li>Teams operate proactively instead of reactively</li>
                <li>Growth becomes durable, not fragile</li>
              </ul>

              <p><strong>This is what Collection Intelligence enables.</strong></p>

              <h2>It's Time to Celebrate the Right Outcome</h2>

              <p>
                Bookings start the journey.<br />
                Cash completes it.
              </p>

              <p>
                If your business celebrates promises but not fulfillment, you're leaving value — and resilience — on the table.
              </p>

              {/* Final Callout */}
              <div className="not-prose my-10 p-8 bg-card border-2 border-primary/30 rounded-2xl text-center">
                <p className="text-xl md:text-2xl font-bold text-foreground mb-0">
                  Maybe it's time we start ringing the gong when the cash hits the bank.
                </p>
              </div>
            </div>

            {/* Mobile Share Bar */}
            <div className="lg:hidden flex items-center justify-center gap-3 my-10 py-4 border-y">
              <span className="text-sm font-medium text-muted-foreground">Share this article:</span>
              <button
                onClick={handleShareLinkedIn}
                className="p-2 rounded-full bg-muted hover:bg-primary/10 transition-colors"
                title="Share on LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </button>
              <button
                onClick={handleShareTwitter}
                className="p-2 rounded-full bg-muted hover:bg-primary/10 transition-colors"
                title="Share on Twitter"
              >
                <Twitter className="h-5 w-5" />
              </button>
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-full bg-muted hover:bg-primary/10 transition-colors"
                title="Copy link"
              >
                <Link2 className="h-5 w-5" />
              </button>
            </div>

            {/* Author Bio */}
            <div className="flex flex-col sm:flex-row gap-6 items-start p-6 md:p-8 bg-muted/30 border rounded-2xl my-12">
              <img
                src={founderImage}
                alt="Sharad Chanana"
                className="w-20 h-20 rounded-full object-cover border-2 border-background shadow-lg flex-shrink-0"
              />
              <div>
                <h3 className="font-bold text-lg mb-1">Sharad Chanana</h3>
                <p className="text-sm text-primary font-medium mb-3">Founder & CEO, Recouply.ai</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sharad has spent over a decade in B2B SaaS and fintech, building and scaling revenue operations 
                  at high-growth companies. He founded Recouply.ai to bring enterprise-grade Collection Intelligence 
                  to businesses of all sizes.
                </p>
              </div>
            </div>

            {/* Footer CTA */}
            <aside className="p-8 md:p-10 rounded-2xl bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 border border-primary/20 text-center">
              <h3 className="text-2xl font-bold mb-3">About Recouply.ai</h3>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Recouply.ai is a Collection Intelligence Platform that helps businesses automate, centralize, 
                and optimize accounts receivable and collections. By combining AI-driven workflows, 
                customer-centric engagement, and real-time insights, Recouply.ai enables faster cash collection, 
                reduced risk, and stronger cash flow.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate("/features")} size="lg">
                  Explore Features
                </Button>
                <Button onClick={() => navigate("/signup")} variant="outline" size="lg">
                  Start Free Trial
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </article>
    </MarketingLayout>
  );
};

export default CelebrateCash;
