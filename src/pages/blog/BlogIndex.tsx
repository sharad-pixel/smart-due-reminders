import MarketingLayout from "@/components/MarketingLayout";
import SEO from "@/components/SEO";
import BlogCard from "@/components/blog/BlogCard";
import { blogPosts, getFeaturedPosts, getAllCategories } from "@/lib/blogConfig";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const BlogIndex = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = getAllCategories();
  const featuredPosts = getFeaturedPosts();

  const filteredPosts = selectedCategory
    ? blogPosts.filter((post) => post.category === selectedCategory)
    : blogPosts;

  const nonFeaturedPosts = filteredPosts.filter((post) => !post.featured);
  const featuredToShow = selectedCategory ? [] : featuredPosts;

  return (
    <MarketingLayout>
      <SEO
        title="Blog | Recouply.ai"
        description="Insights on Collection Intelligence, accounts receivable automation, and cash flow optimization from the Recouply.ai team."
        canonical="https://recouply.ai/blog"
        keywords="collection intelligence, accounts receivable, cash flow, AR automation, fintech blog"
      />

      <div className="py-12 md:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <header className="text-center mb-12 md:mb-16">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              The RecouplyAI Inc. Blog
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Insights on Collection Intelligence, accounts receivable automation, and building durable growth.
            </p>
          </header>

          {/* Category Filter */}
          {categories.length > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          )}

          {/* Featured Post */}
          {featuredToShow.length > 0 && (
            <section className="mb-16">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
                Featured
              </h2>
              {featuredToShow.map((post) => (
                <BlogCard key={post.slug} post={post} featured />
              ))}
            </section>
          )}

          {/* All Posts Grid */}
          {nonFeaturedPosts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
                {selectedCategory || "All Articles"}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {nonFeaturedPosts.map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {filteredPosts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No articles found in this category.</p>
              <Button
                variant="link"
                onClick={() => setSelectedCategory(null)}
                className="mt-2"
              >
                View all articles
              </Button>
            </div>
          )}

          {/* Only featured, no other posts message */}
          {featuredToShow.length > 0 && nonFeaturedPosts.length === 0 && !selectedCategory && (
            <div className="text-center py-12 border-t mt-12">
              <p className="text-muted-foreground">More articles coming soon!</p>
            </div>
          )}
        </div>
      </div>
    </MarketingLayout>
  );
};

export default BlogIndex;
