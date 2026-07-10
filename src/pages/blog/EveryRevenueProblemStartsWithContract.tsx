import BlogPostLayout from "@/components/blog/BlogPostLayout";
import { getBlogPostBySlug } from "@/lib/blogConfig";
import { Navigate } from "react-router-dom";

const EveryRevenueProblemStartsWithContract = () => {
  const post = getBlogPostBySlug("every-revenue-problem-starts-with-a-contract");
  if (!post) return <Navigate to="/resources" replace />;

  const chain = [
    "Contract",
    "Order Form",
    "Revenue Obligations",
    "Invoice",
    "Collections",
    "Revenue Recognition",
    "Renewal",
    "Expansion",
  ];

  return (
    <BlogPostLayout post={post}>
      <p>
        Ask any finance leader where their revenue problems come from. You'll hear about billing,
        collections, or forecast accuracy. Push one layer deeper and the trail always ends in the
        same place: <strong>the contract</strong>.
      </p>

      <h2>The full contract-to-cash chain</h2>
      <p>Revenue doesn't move in silos. It moves in a chain — and every link is load-bearing:</p>

      <div className="not-prose my-8">
        <div className="flex flex-col items-stretch gap-2">
          {chain.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div className="flex-1 rounded-xl border border-border/60 bg-card px-5 py-4 flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {i + 1}
                </span>
                <span className="font-semibold text-foreground">{step}</span>
              </div>
              {i < chain.length - 1 && (
                <div className="text-muted-foreground text-lg" aria-hidden>
                  ↓
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <h2>Where the chain breaks</h2>
      <p>
        Most companies operate this chain across five to seven disconnected systems: CLM in one
        tool, order forms in email, billing in Zuora or Stripe, collections in spreadsheets, revenue
        in NetSuite. Every handoff is a translation, and every translation is where obligations get
        lost.
      </p>

      <h3>Common failure modes</h3>
      <ul>
        <li>Order form terms never propagate to billing.</li>
        <li>Renewal dates live only in the CSM's calendar.</li>
        <li>ASC 606 allocations depend on a quarterly manual reconciliation.</li>
        <li>Expansion opportunities die because usage data never reaches the CS team.</li>
      </ul>

      <blockquote>
        A revenue system is only as accurate as its slowest, most manual translation.
      </blockquote>

      <h2>What a connected chain looks like</h2>
      <p>
        Revenue Intelligence treats the contract as the source of truth and pushes structured
        obligations into every downstream system — billing, collections, recognition, renewal
        planning, expansion. One record. Many consumers. Real-time signal.
      </p>

      <h2>Summary</h2>
      <p>
        Every revenue problem starts with a contract. Companies that connect the chain from
        signature to expansion don't just plug leakage — they earn a forecast their board can trust.
      </p>
    </BlogPostLayout>
  );
};

export default EveryRevenueProblemStartsWithContract;
