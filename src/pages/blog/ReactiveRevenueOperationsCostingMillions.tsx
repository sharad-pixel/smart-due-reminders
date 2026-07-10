import BlogPostLayout from "@/components/blog/BlogPostLayout";
import { getBlogPostBySlug } from "@/lib/blogConfig";
import { Navigate } from "react-router-dom";

const ReactiveRevenueOperationsCostingMillions = () => {
  const post = getBlogPostBySlug("reactive-revenue-operations-costing-millions");
  if (!post) return <Navigate to="/resources" replace />;

  return (
    <BlogPostLayout post={post}>
      <p>
        Most RevOps teams don't have a strategy problem — they have a reaction problem. They spend
        the month reconciling last month, and the quarter explaining last quarter. Meanwhile,
        revenue leaks in ways nobody has the bandwidth to catch.
      </p>

      <h2>The reactive tax</h2>
      <p>The visible symptoms are familiar. Each one has a hidden dollar cost:</p>

      <div className="not-prose my-8 grid sm:grid-cols-2 gap-4">
        {[
          ["Manual spreadsheets", "Every hand-touch is a chance to drift from truth."],
          ["Missed renewals", "Notice windows expire in silence."],
          ["Late invoicing", "Cash sits in an inbox for 30+ days."],
          ["Revenue leakage", "Ramps, overages, and one-time fees go unbilled."],
          ["Underbilling", "Discounts persist after their term expires."],
          ["Delayed collections", "Aging tips into risk while nobody watches."],
          ["Forecast inaccuracies", "Board decks reflect CRM guesses, not obligations."],
        ].map(([title, body]) => (
          <div
            key={title}
            className="rounded-2xl border border-border/60 bg-card p-5"
          >
            <div className="font-semibold text-foreground mb-1">{title}</div>
            <p className="text-sm text-muted-foreground mb-0">{body}</p>
          </div>
        ))}
      </div>

      <blockquote>
        A reactive RevOps org is a rounding error away from an eight-figure miss every quarter.
      </blockquote>

      <h2>Proactive Revenue Intelligence, plainly</h2>
      <p>Proactive means three things — and only three:</p>
      <ol>
        <li>
          <strong>Every obligation is known.</strong> Contracts are structured. Nothing lives only
          in a PDF.
        </li>
        <li>
          <strong>Every deviation is caught early.</strong> Ramps, renewals, overages, and payment
          timing surface as signals — not month-end surprises.
        </li>
        <li>
          <strong>Every action is orchestrated.</strong> Reminders, escalations, and workflows fire
          on their own; humans handle exceptions.
        </li>
      </ol>

      <h2>What changes in the numbers</h2>
      <ul>
        <li>DSO drops 8–15 days as outreach starts earlier and never lapses.</li>
        <li>Forecast variance narrows because ARR is tied to contracts, not CRM opportunities.</li>
        <li>Leakage recovery pays for the platform in the first quarter.</li>
      </ul>

      <h2>Summary</h2>
      <p>
        Reactive RevOps costs more than any tool. Proactive Revenue Intelligence isn't a
        productivity upgrade — it's a P&amp;L intervention.
      </p>
    </BlogPostLayout>
  );
};

export default ReactiveRevenueOperationsCostingMillions;
