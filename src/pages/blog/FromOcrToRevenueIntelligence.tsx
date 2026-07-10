import BlogPostLayout from "@/components/blog/BlogPostLayout";
import { getBlogPostBySlug } from "@/lib/blogConfig";
import { Navigate } from "react-router-dom";

const PIPELINE = [
  { step: "Upload Contract", detail: "PDF, DOCX, scan — from anywhere." },
  { step: "OCR", detail: "Every page rendered into machine-readable text." },
  { step: "AI Extraction", detail: "Structured fields: dates, parties, ARR, ramps, obligations." },
  { step: "Revenue Classification", detail: "SSP, allocation, ASC 606 treatment inferred and reviewed." },
  { step: "Risk Detection", detail: "Renewal exposure, non-standard terms, usage cliffs flagged." },
  { step: "Workflow Creation", detail: "Deadlines, owners, and escalations auto-provisioned." },
  { step: "Financial Exposure Analysis", detail: "ARR at risk, ramps at risk, cash at risk quantified." },
  { step: "Revenue Intelligence Dashboard", detail: "Live signal for finance, sales, and CS." },
];

const FromOcrToRevenueIntelligence = () => {
  const post = getBlogPostBySlug("from-ocr-to-revenue-intelligence");
  if (!post) return <Navigate to="/resources" replace />;

  return (
    <BlogPostLayout post={post}>
      <p>
        Most "AI for contracts" pitches stop at extraction. A model reads the PDF, spits out fields,
        drops them into a spreadsheet, and calls it intelligence. It isn't. Extraction is the
        starting line, not the finish.
      </p>

      <h2>OCR is step one, not the product</h2>
      <p>
        Real Revenue Intelligence begins after the text comes off the page. The value is in what
        gets built on top: classification, risk detection, workflow, exposure — and a dashboard
        that turns all of it into a real-time operating signal.
      </p>

      <h2>The full pipeline</h2>

      <div className="not-prose my-8 space-y-3">
        {PIPELINE.map((p, i) => (
          <div key={p.step} className="flex items-start gap-4">
            <div className="flex-shrink-0 grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary font-bold text-sm">
              {i + 1}
            </div>
            <div className="flex-1 rounded-xl border border-border/60 bg-card p-4">
              <div className="font-semibold text-foreground">{p.step}</div>
              <p className="text-sm text-muted-foreground mb-0 mt-1">{p.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <blockquote>
        Extraction gives you data. Intelligence gives you actions. Only one changes revenue.
      </blockquote>

      <h2>Why the layers matter</h2>
      <ul>
        <li>
          <strong>Classification</strong> is what makes ASC 606 auditable, not reconstructed.
        </li>
        <li>
          <strong>Risk detection</strong> is what turns a 900-page portfolio into a short list of
          contracts that need attention.
        </li>
        <li>
          <strong>Workflow</strong> is what closes the loop — because an alert without an owner is
          just noise.
        </li>
        <li>
          <strong>Financial exposure</strong> is what earns the CFO's attention. Not "what does the
          contract say" — <em>"how much is it worth if we act."</em>
        </li>
      </ul>

      <h2>Summary</h2>
      <p>
        OCR is table stakes. Revenue Intelligence is the operating layer on top: classification,
        risk, workflow, and exposure — turning contracts from static documents into live financial
        signal.
      </p>
    </BlogPostLayout>
  );
};

export default FromOcrToRevenueIntelligence;
