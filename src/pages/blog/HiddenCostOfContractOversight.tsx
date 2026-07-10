import BlogPostLayout from "@/components/blog/BlogPostLayout";
import { getBlogPostBySlug } from "@/lib/blogConfig";
import { Navigate } from "react-router-dom";

const HiddenCostOfContractOversight = () => {
  const post = getBlogPostBySlug("hidden-cost-of-contract-oversight");
  if (!post) return <Navigate to="/resources" replace />;

  return (
    <BlogPostLayout post={post}>
      <p>
        Revenue leakage rarely announces itself. It doesn't show up as a missed deal or a churned
        logo. It shows up quietly — inside contracts that stopped being watched the moment they were
        signed. By the time finance notices, the money is already gone.
      </p>

      <h2>Where leakage actually begins</h2>
      <p>
        Every executive team debates collections, DSO, and forecast accuracy. Very few debate the
        contract itself. Yet almost every downstream revenue problem traces back to a term that
        existed on paper long before the first invoice was cut.
      </p>

      <h3>The six most common leakage sources</h3>
      <ul>
        <li>
          <strong>Missed renewal dates.</strong> A 60-day notice window quietly expires. Auto-renewal
          triggers at a discount that was only ever meant for year one.
        </li>
        <li>
          <strong>Incorrect billing terms.</strong> The order form says quarterly in advance. Billing
          books it monthly in arrears. Two months of revenue slide out of the quarter.
        </li>
        <li>
          <strong>Unnoticed pricing ramps.</strong> Year-two uplift of 12% is buried in an addendum.
          Billing bills flat. The ramp is never recognized.
        </li>
        <li>
          <strong>Overlooked implementation fees.</strong> A one-time services fee tied to a milestone
          that no one is tracking.
        </li>
        <li>
          <strong>Missing usage commitments.</strong> Customer committed to 10M events; consuming
          14M. Overage clause exists — no one billed it.
        </li>
        <li>
          <strong>Revenue recognition drift.</strong> Bundled SKUs allocated wrong under ASC 606.
          Restatement risk quietly accumulates.
        </li>
      </ul>

      <blockquote>
        The most expensive line item in most B2B companies is the one that was never invoiced.
      </blockquote>

      <h2>Why it compounds silently</h2>
      <p>
        A single missed ramp on a $500K ACV account is $60K in leaked ARR. Across a portfolio of
        400 accounts, even a 3% miss rate becomes an eight-figure annualized problem — and none of
        it shows up on a P&amp;L until the audit.
      </p>

      <h2>What AI actually changes</h2>
      <p>
        Contract Intelligence is not OCR. It's structured extraction plus continuous obligation
        tracking. Recouply reads every clause, indexes every dollar-carrying obligation, and turns
        the contract into a live operational asset:
      </p>
      <ul>
        <li>Every renewal date and notice window becomes a monitored deadline.</li>
        <li>Every ramp, discount, and escalator becomes a billing rule.</li>
        <li>Every usage commitment becomes a metered signal.</li>
        <li>Every ASC 606 allocation becomes an auditable trail.</li>
      </ul>

      <h2>What to do about it this quarter</h2>
      <ol>
        <li>Inventory every active contract in one system of record — not a spreadsheet.</li>
        <li>Extract every dollar-carrying obligation into structured fields.</li>
        <li>Wire alerts to the humans who own each obligation.</li>
        <li>Measure leakage as a first-class KPI alongside DSO and CEI.</li>
      </ol>

      <h2>Summary</h2>
      <p>
        Revenue leakage is a contract problem before it is a collections problem. Teams that treat
        contracts as living operational data — not archived PDFs — stop leaking revenue in the same
        quarter they start looking.
      </p>
    </BlogPostLayout>
  );
};

export default HiddenCostOfContractOversight;
