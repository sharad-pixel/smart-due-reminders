import BlogPostLayout from "@/components/blog/BlogPostLayout";
import { getBlogPostBySlug } from "@/lib/blogConfig";
import { Navigate } from "react-router-dom";

const CelebrateCash = () => {
  const post = getBlogPostBySlug("celebrate-cash");

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <BlogPostLayout post={post}>
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
    </BlogPostLayout>
  );
};

export default CelebrateCash;
