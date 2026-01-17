import MarketingLayout from "@/components/MarketingLayout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, Linkedin, Twitter, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { BlogPost } from "@/lib/blogConfig";

interface BlogPostLayoutProps {
  post: BlogPost;
  children: React.ReactNode;
}

const BlogPostLayout = ({ post, children }: BlogPostLayoutProps) => {
  const navigate = useNavigate();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  const handleShareLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
  };

  const handleShareTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`${post.title} - Great read from @RecouplyAI`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  };

  return (
    <MarketingLayout>
      <SEO
        title={post.metaTitle}
        description={post.metaDescription}
        canonical={`https://recouply.ai/blog/${post.slug}`}
        keywords={post.keywords}
        ogType="article"
        ogImage={post.heroImage}
      />

      <article className="py-8 md:py-12 lg:py-16">
        <div className="container mx-auto px-4">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate("/blog")}
            className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Articles
          </Button>

          {/* Article Header */}
          <header className="max-w-4xl mx-auto text-center mb-10">
            {/* Category Badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              {post.category}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              {post.title}
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              {post.excerpt}
            </p>

            {/* Author & Meta */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <div className="flex items-center gap-3">
                <img
                  src={post.author.image}
                  alt={post.author.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-background shadow-md"
                />
                <div className="text-left">
                  <div className="font-semibold text-sm">{post.author.name}</div>
                  <div className="text-xs text-muted-foreground">{post.author.title}</div>
                </div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-border" />
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <time dateTime={post.publishDateISO}>{post.publishDate}</time>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{post.readingTime}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Hero Image */}
          <div className="max-w-5xl mx-auto mb-12 md:mb-16">
            <div className="aspect-video rounded-2xl overflow-hidden bg-muted shadow-2xl">
              <img
                src={post.heroImage}
                alt={post.heroAlt}
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
            <div className="
              prose prose-lg dark:prose-invert max-w-none
              prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground
              prose-h2:text-2xl prose-h2:md:text-3xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-3
              prose-h3:text-xl prose-h3:md:text-2xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
              prose-ul:my-4 prose-ul:pl-6 prose-ul:space-y-2
              prose-ol:my-4 prose-ol:pl-6 prose-ol:space-y-2
              prose-li:text-muted-foreground prose-li:leading-relaxed
              prose-strong:text-foreground prose-strong:font-semibold
              prose-em:text-foreground/90
              prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:not-italic
              [&>p]:mb-4
              [&>ul]:list-disc [&>ol]:list-decimal
            ">
              {children}
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
                src={post.author.image}
                alt={post.author.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-background shadow-lg flex-shrink-0"
              />
              <div>
                <h3 className="font-bold text-lg mb-1">{post.author.name}</h3>
                <p className="text-sm text-primary font-medium mb-3">{post.author.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {post.author.bio}
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

export default BlogPostLayout;
