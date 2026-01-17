import { ArrowRight, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { BlogPost } from "@/lib/blogConfig";

interface BlogCardProps {
  post: BlogPost;
  featured?: boolean;
}

const BlogCard = ({ post, featured = false }: BlogCardProps) => {
  const navigate = useNavigate();

  if (featured) {
    return (
      <article
        onClick={() => navigate(`/blog/${post.slug}`)}
        className="group cursor-pointer grid md:grid-cols-2 gap-6 md:gap-10 items-center p-4 -m-4 rounded-2xl hover:bg-muted/50 transition-colors"
      >
        <div className="aspect-video rounded-xl overflow-hidden bg-muted shadow-lg">
          <img
            src={post.heroImage}
            alt={post.heroAlt}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
        <div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {post.category}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3 group-hover:text-primary transition-colors">
            {post.title}
          </h2>
          <p className="text-muted-foreground mb-4 line-clamp-2">
            {post.excerpt}
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-2">
              <img
                src={post.author.image}
                alt={post.author.name}
                className="w-8 h-8 rounded-full object-cover"
              />
              <span>{post.author.name}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{post.publishDate}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-primary font-medium group-hover:gap-3 transition-all">
            Read article
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={() => navigate(`/blog/${post.slug}`)}
      className="group cursor-pointer p-4 -m-4 rounded-xl hover:bg-muted/50 transition-colors"
    >
      <div className="aspect-video rounded-lg overflow-hidden bg-muted mb-4">
        <img
          src={post.heroImage}
          alt={post.heroAlt}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
        {post.category}
      </div>
      <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {post.title}
      </h3>
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
        {post.excerpt}
      </p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{post.author.name}</span>
        <span>•</span>
        <span>{post.readingTime}</span>
      </div>
    </article>
  );
};

export default BlogCard;
