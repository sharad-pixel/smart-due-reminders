import BlogPostLayout from "@/components/blog/BlogPostLayout";
import { getBlogPostBySlug } from "@/lib/blogConfig";
import { Navigate } from "react-router-dom";

const FIELDS: { field: string; example: string }[] = [
  { field: "Customer", example: "Acme Corp, Inc." },
  { field: "Effective Date", example: "2026-04-01" },
  { field: "End Date", example: "2029-03-31" },
  { field: "Renewal Notice", example: "90 days prior" },
  { field: "ARR", example: "$480,000" },
  { field: "ACV", example: "$480,000" },
  { field: "TCV", example: "$1,512,000" },
  { field: "Professional Services", example: "$45,000 (milestone-billed)" },
  { field: "One-Time Fees", example: "$12,500 onboarding" },
  { field: "Payment Terms", example: "Net 30, quarterly in advance" },
  { field: "Discounts", example: "15% year-1 only" },
  { field: "Usage Commitments", example: "10M events / mo" },
  { field: "Price Escalators", example: "5% annual uplift" },
  { field: "Auto-Renewals", example: "12 mo, unless notice given" },
];

const OrderFormsAsStructuredData = () => {
  const post = getBlogPostBySlug("order-forms-as-structured-data");
  if (!post) return <Navigate to="/resources" replace />;

  return (
    <BlogPostLayout post={post}>
      <p>
        Order forms are the most operationally valuable document a finance team touches — and the
        one they treat with the least structure. They carry ARR, ACV, TCV, ramps, renewal notice
        terms, usage commitments, and payment cadence. And they sit in PDF form in a Salesforce
        attachment field no downstream system can read.
      </p>

      <h2>PDFs are not a system of record</h2>
      <p>
        A PDF is a rendered artifact. It cannot be queried, joined, watched, or reconciled. Every
        finance team that treats an order form as "the record" is really treating a copy of a
        rendering of a record — and paying the cost in manual re-entry and lost obligations.
      </p>

      <h2>The fields that actually matter</h2>
      <p>
        A properly extracted order form yields the following structured fields — each of which
        drives a downstream system:
      </p>

      <div className="not-prose my-8 overflow-hidden rounded-2xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-5 py-3 font-semibold">Field</th>
              <th className="text-left px-5 py-3 font-semibold">Example</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f, i) => (
              <tr key={f.field} className={i % 2 ? "bg-muted/20" : ""}>
                <td className="px-5 py-3 font-medium text-foreground">{f.field}</td>
                <td className="px-5 py-3 text-muted-foreground">{f.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Why structure changes the operating model</h2>
      <ul>
        <li>Renewals become monitored SLAs, not calendar entries.</li>
        <li>Ramps become billing rules that run themselves.</li>
        <li>Usage commitments become real-time overage signals.</li>
        <li>ASC 606 allocations become auditable, not reconstructed.</li>
        <li>Forecasts pull directly from contracts, not from CRM guesswork.</li>
      </ul>

      <blockquote>
        The moment an order form becomes structured, finance stops being a data-entry function and
        starts being an intelligence function.
      </blockquote>

      <h2>Summary</h2>
      <p>
        Order forms belong in a database, not a PDF viewer. Every finance team should extract them
        once, structure them properly, and let every downstream system consume them as data.
      </p>
    </BlogPostLayout>
  );
};

export default OrderFormsAsStructuredData;
