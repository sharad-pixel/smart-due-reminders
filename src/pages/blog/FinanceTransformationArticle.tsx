import { Link, Navigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import BlogPostLayout from "@/components/blog/BlogPostLayout";
import { getBlogPostBySlug } from "@/lib/blogConfig";
import {
  getFinanceTransformationArticle,
  PERSPECTIVE_TAGLINE,
  type ArticleBlock,
} from "@/lib/financeTransformationSeries";

const Block = ({ block }: { block: ArticleBlock }) => {
  if (typeof block === "string") return <p className="mb-4 leading-relaxed text-muted-foreground">{block}</p>;
  if ("list" in block)
    return (
      <ul className="my-4 list-disc space-y-2 pl-6">
        {block.list.map((i) => (
          <li key={i} className="leading-relaxed text-muted-foreground">{i}</li>
        ))}
      </ul>
    );
  if ("quote" in block) return <blockquote className="not-prose my-6 rounded-r-lg border-l-4 border-primary bg-muted/30 px-6 py-4"><p className="mb-0 text-lg text-foreground font-medium">{block.quote}</p></blockquote>;
  if ("flow" in block)
    return (
      <div className="not-prose my-6 flex flex-wrap items-center gap-2">
        {block.flow.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-foreground">
              {step}
            </span>
            {i < block.flow.length - 1 && <ArrowRight className="h-4 w-4 text-primary" />}
          </div>
        ))}
      </div>
    );
  if ("layers" in block)
    return (
      <div className="not-prose my-8 space-y-3">
        {block.layers.map((layer) => (
          <div key={layer.name} className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary mb-3">{layer.name}</div>
            <div className="flex flex-wrap gap-2">
              {layer.items.map((it) => (
                <span key={it} className="rounded-md bg-muted px-2.5 py-1 text-sm text-muted-foreground">
                  {it}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  if ("compare" in block)
    return (
      <div className="not-prose my-8 grid gap-4 sm:grid-cols-2">
        {[block.compare.left, block.compare.right].map((col, idx) => (
          <div
            key={col.title}
            className={`rounded-2xl border p-5 ${idx === 1 ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card"}`}
          >
            <div className="font-semibold text-foreground mb-3">{col.title}</div>
            <ul className="space-y-2">
              {col.items.map((it) => (
                <li key={it} className="text-sm text-muted-foreground">• {it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  return null;
};

const FinanceTransformationArticle = ({ slug }: { slug: string }) => {
  const post = getBlogPostBySlug(slug);
  const article = getFinanceTransformationArticle(slug);
  if (!post || !article) return <Navigate to="/resources" replace />;

  return (
    <BlogPostLayout post={post}>
      <p className="mb-6 text-xl leading-relaxed text-foreground/90">{article.subtitle}</p>
      {article.intro.map((b, i) => (
        <Block key={`intro-${i}`} block={b} />
      ))}

      {article.sections.map((s) => (
        <section key={s.heading}>
          <h2 className="mt-10 mb-4 border-b border-border/50 pb-3 text-2xl md:text-3xl font-bold tracking-tight text-foreground">{s.heading}</h2>
          {s.blocks.map((b, i) => (
            <Block key={`${s.heading}-${i}`} block={b} />
          ))}
        </section>
      ))}

      <div className="not-prose my-10 rounded-2xl border border-border/60 bg-muted/30 p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary mb-4">Key takeaways</div>
        <ul className="space-y-3">
          {article.keyTakeaways.map((t) => (
            <li key={t} className="flex gap-3 text-foreground">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <h2 className="mt-10 mb-4 border-b border-border/50 pb-3 text-2xl md:text-3xl font-bold tracking-tight text-foreground">The Recouply.ai Perspective</h2>
      {article.perspective.map((p) => (
        <p key={p} className="mb-4 leading-relaxed text-muted-foreground">{p}</p>
      ))}
      <p className="mb-4 leading-relaxed text-muted-foreground">
        Our focus is helping finance organizations connect collections, Order-to-Cash transformation, workflow
        automation, governance and custom business applications into practical operating solutions.
      </p>
      <p className="mb-4"><strong className="text-foreground">{PERSPECTIVE_TAGLINE}</strong></p>

      <div className="not-prose my-10 rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <p className="text-foreground mb-4">{article.cta.text}</p>
        <Link
          to={article.cta.href}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all"
        >
          {article.cta.label} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </BlogPostLayout>
  );
};

export default FinanceTransformationArticle;
