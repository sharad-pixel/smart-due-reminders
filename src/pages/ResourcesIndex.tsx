import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight, Sparkles, BookOpen, FileText, Layers, Presentation, GraduationCap } from "lucide-react";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEOHead from "@/components/seo/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AskRevenueAgent from "@/components/resources/AskRevenueAgent";
import ResourceCard from "@/components/resources/ResourceCard";
import {
  blogPosts,
  getAllCategories,
  getEditorsPicks,
  getSeriesPosts,
  REVENUE_INTELLIGENCE_SERIES,
  type BlogPost,
  type ResourceContentType,
} from "@/lib/blogConfig";
import { SITE_CONFIG } from "@/lib/seoConfig";
import { founderConfig } from "@/lib/founderConfig";

type SortMode = "newest" | "popular" | "picks";

const CONTENT_TYPES: { value: ResourceContentType | "all"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "all", label: "All", icon: Layers },
  { value: "article", label: "Articles", icon: FileText },
  { value: "guide", label: "Guides", icon: BookOpen },
  { value: "playbook", label: "Playbooks", icon: Presentation },
  { value: "case-study", label: "Case Studies", icon: GraduationCap },
  { value: "whitepaper", label: "Whitepapers", icon: FileText },
];

const ResourcesIndex = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [contentType, setContentType] = useState<ResourceContentType | "all">("all");
  const [sort, setSort] = useState<SortMode>("newest");

  const categories = getAllCategories();
  const seriesPosts = getSeriesPosts(REVENUE_INTELLIGENCE_SERIES);

  const filtered = useMemo(() => {
    let out: BlogPost[] = blogPosts;

    if (category) out = out.filter((p) => p.category === category);
    if (contentType !== "all") {
      out = out.filter((p) => (p.contentType ?? "article") === contentType);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.keywords.toLowerCase().includes(q) ||
          p.topics?.some((t) => t.toLowerCase().includes(q)),
      );
    }

    if (sort === "newest") {
      out = [...out].sort(
        (a, b) => new Date(b.publishDateISO).getTime() - new Date(a.publishDateISO).getTime(),
      );
    } else if (sort === "popular") {
      out = [...out].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    } else if (sort === "picks") {
      out = out.filter((p) => p.editorsPick);
    }

    return out;
  }, [category, contentType, search, sort]);

  const scrollToArticles = () => {
    document.getElementById("all-articles")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <MarketingLayout>
      <SEOHead
        title="Revenue Intelligence Hub — Contract Intelligence, ASC 606, Finance Automation"
        description="Enterprise resources on Revenue Intelligence, Contract Intelligence, Collections Intelligence, ASC 606, and finance automation. Read articles, guides, and playbooks from Recouply.ai."
        canonical="https://recouply.ai/resources"
        keywords="revenue intelligence, contract intelligence, collections intelligence, ASC 606, revenue operations, finance automation, contract to cash"
        breadcrumbs={[{ name: "Resources", url: `${SITE_CONFIG.siteUrl}/resources` }]}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-background to-background" aria-hidden />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, hsl(var(--primary)) 1px, transparent 1px), radial-gradient(circle at 80% 60%, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "48px 48px, 72px 72px",
          }}
          aria-hidden
        />

        <div className="container mx-auto px-4 relative pt-16 pb-14 md:pt-24 md:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Revenue Intelligence Hub
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.05]">
              Revenue Intelligence Starts With{" "}
              <span className="bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
                Better Contracts
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Every revenue outcome begins with a contract. Learn how AI-powered Contract
              Intelligence, Revenue Intelligence, and Collections Intelligence help finance teams
              reduce leakage, automate workflows, and gain complete visibility into commercial
              obligations.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" onClick={scrollToArticles}>
                Read Articles
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => window.open(founderConfig.calendly, "_blank", "noopener")}
              >
                Book a Demo
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Ask Revenue Agent */}
      <section className="container mx-auto px-4 -mt-8 md:-mt-10 relative z-10">
        <div className="max-w-4xl mx-auto">
          <AskRevenueAgent />
        </div>
      </section>

      {/* Featured Series */}
      {seriesPosts.length > 0 && (
        <section className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary mb-2">
                  Featured Series
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  {REVENUE_INTELLIGENCE_SERIES}
                </h2>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                  Five cornerstone essays on why revenue outcomes are decided in the contract — and
                  how to build an operating system around them.
                </p>
              </div>
            </div>

            <div className="grid gap-10">
              {seriesPosts[0] && <ResourceCard post={seriesPosts[0]} variant="featured" />}
              {seriesPosts.length > 1 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {seriesPosts.slice(1).map((p) => (
                    <ResourceCard key={p.slug} post={p} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Discovery: search + filters */}
      <section id="all-articles" className="container mx-auto px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">All Resources</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {filtered.length} {filtered.length === 1 ? "resource" : "resources"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search resources…"
                  className="pl-9 w-full sm:w-72"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-1">
                {(["newest", "popular", "picks"] as SortMode[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      sort === s
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "newest" ? "Newest" : s === "popular" ? "Most Popular" : "Editor's Picks"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content type tabs */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {CONTENT_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setContentType(value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  contentType === value
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border/60 hover:border-foreground/40"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Categories */}
          <div className="flex items-center gap-2 flex-wrap mb-10">
            <button
              onClick={() => setCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                category === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40"
              }`}
            >
              All Categories
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/60 hover:border-primary/40"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-border/60">
              <p className="text-muted-foreground">No resources match your filters yet.</p>
              <Button
                variant="link"
                onClick={() => {
                  setSearch("");
                  setCategory(null);
                  setContentType("all");
                  setSort("newest");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map((p) => (
                <ResourceCard key={p.slug} post={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA banner */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-accent/[0.06] border border-primary/20 p-10 md:p-14 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.15) 0px, transparent 40%), radial-gradient(circle at 70% 70%, hsl(var(--accent) / 0.15) 0px, transparent 40%)",
            }}
            aria-hidden
          />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Stop Revenue Leakage Before It Happens
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Upload your contracts and let Recouply.ai automatically identify financial
              obligations, renewal risks, payment terms, revenue metrics, and workflow
              opportunities.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => window.open(founderConfig.calendly, "_blank", "noopener")}
              >
                Book a Demo
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/signup")}>
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default ResourcesIndex;
