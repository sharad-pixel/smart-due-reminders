import { ArrowRight, Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { BlogPost } from "@/lib/blogConfig";

interface ResourceCardProps {
  post: BlogPost;
  variant?: "featured" | "default" | "compact";
}

const ResourceCard = ({ post, variant = "default" }: ResourceCardProps) => {
  const navigate = useNavigate();
  const to = `/blog/${post.slug}`;

  if (variant === "featured") {
    return (
      <article
        onClick={() => navigate(to)}
        className="group cursor-pointer grid md:grid-cols-2 gap-6 md:gap-10 items-center p-5 -m-5 rounded-3xl hover:bg-muted/40 transition-colors"
      >
        <div className="aspect-video rounded-2xl overflow-hidden bg-muted shadow-lg">
          <img
            src={post.heroImage}
            alt={post.heroAlt}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            loading="lazy"
          />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {post.category}
            </span>
            {post.series && (
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                {post.series}
              </span>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3 group-hover:text-primary transition-colors leading-tight">
            {post.title}
          </h2>
          <p className="text-muted-foreground mb-5 line-clamp-3">{post.excerpt}</p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-2">
              <img
                src={post.author.image}
                alt={post.author.name}
                className="w-8 h-8 rounded-full object-cover"
              />
              <span>{post.author.name}</span>
            </div>
            <span aria-hidden>•</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {post.publishDate}
            </div>
            <span aria-hidden>•</span>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {post.readingTime}
            </div>
          </div>
          <div className="inline-flex items-center gap-2 text-primary font-semibold group-hover:gap-3 transition-all">
            Continue reading
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article
        onClick={() => navigate(to)}
        className="group cursor-pointer flex gap-4 p-3 -m-3 rounded-xl hover:bg-muted/40 transition-colors"
      >
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          <img src={post.heroImage} alt={post.heroAlt} className="w-full h-full object-cover" loading="lazy" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-primary font-semibold mb-1">{post.category}</div>
          <h3 className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h3>
          <div className="mt-2 text-xs text-muted-foreground">{post.readingTime}</div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={() => navigate(to)}
      className="group cursor-pointer flex flex-col p-4 -m-4 rounded-2xl hover:bg-muted/40 transition-colors h-full"
    >
      <div className="aspect-video rounded-xl overflow-hidden bg-muted mb-4">
        <img
          src={post.heroImage}
          alt={post.heroAlt}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          loading="lazy"
        />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
          {post.category}
        </span>
        {post.editorsPick && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-accent-foreground/70 font-semibold">
            Editor's Pick
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
        {post.title}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">{post.excerpt}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{post.author.name}</span>
        <span aria-hidden>•</span>
        <span>{post.readingTime}</span>
      </div>
    </article>
  );
};

export default ResourceCard;
