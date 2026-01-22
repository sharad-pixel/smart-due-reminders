import celebrateCashHero from "@/assets/blog/celebrate-cash-hero.png";
import powerOfOutreachHero from "@/assets/blog/power-of-outreach-hero.png";
import cashLeakageHero from "@/assets/blog/cash-leakage-hero.png";
import founderImage from "@/assets/founder-sharad.jpg";

export interface BlogAuthor {
  name: string;
  title: string;
  image: string;
  bio: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  category: string;
  author: BlogAuthor;
  publishDate: string;
  publishDateISO: string;
  readingTime: string;
  heroImage: string;
  heroAlt: string;
  keywords: string;
  featured?: boolean;
}

// Define authors
export const authors: Record<string, BlogAuthor> = {
  sharad: {
    name: "Sharad Chanana",
    title: "Founder & CEO, Recouply.ai",
    image: founderImage,
    bio: "Sharad has spent over a decade in B2B SaaS and fintech, building and scaling revenue operations at high-growth companies. He founded Recouply.ai to bring enterprise-grade Collection Intelligence to businesses of all sizes.",
  },
};

// All blog posts - add new posts here
export const blogPosts: BlogPost[] = [
  {
    slug: "celebrate-cash",
    title: "We Ring the Gong for Bookings. Why Don't We Celebrate Cash?",
    metaTitle: "Why Cash Collection Deserves a Gong | Recouply.ai",
    metaDescription: "Bookings are a promise — cash completes the deal. Learn why cash collection deserves the same celebration as bookings and how automation drives growth.",
    excerpt: "Bookings are a promise — cash completes the deal. Learn why cash collection deserves the same celebration.",
    category: "Collection Intelligence",
    author: authors.sharad,
    publishDate: "January 17, 2026",
    publishDateISO: "2026-01-17",
    readingTime: "5 min read",
    heroImage: celebrateCashHero,
    heroAlt: "Illustration showing sales teams celebrating bookings with a gong while finance teams celebrate cash collection with a digital dashboard",
    keywords: "cash collection, bookings, revenue, accounts receivable, collection intelligence, cash flow, SaaS finance",
    featured: true,
  },
  {
    slug: "power-of-outreach",
    title: "The Power of Outreach: Why Timely Payment Reminders Drive Cash Collection",
    metaTitle: "Why Automated Payment Reminders Improve Collections | Recouply.ai",
    metaDescription: "Timely outreach and automated payment reminders significantly increase collectability rates and reduce days to pay. Learn why early engagement matters.",
    excerpt: "Timely outreach and automated payment reminders significantly increase collectability rates and reduce days to pay.",
    category: "Collection Intelligence",
    author: authors.sharad,
    publishDate: "January 17, 2026",
    publishDateISO: "2026-01-17",
    readingTime: "6 min read",
    heroImage: powerOfOutreachHero,
    heroAlt: "Illustration showing automated digital outreach for payments with timeline, reminders, and dashboard",
    keywords: "payment reminders, collections outreach, automated collections, accounts receivable, cash flow, collection intelligence",
    featured: false,
  },
  {
    slug: "cash-leakage",
    title: "How Finance Teams Lose Cash Without Realizing It",
    metaTitle: "How Finance Teams Lose Cash Without Realizing It | Recouply.ai",
    metaDescription: "Finance teams lose cash quietly through delayed outreach and reactive AR processes. Learn how collections intelligence prevents silent cash leakage.",
    excerpt: "Finance teams don't lose cash dramatically — they lose it quietly through delayed outreach, lack of visibility, and reactive AR processes.",
    category: "Collection Intelligence",
    author: authors.sharad,
    publishDate: "January 22, 2026",
    publishDateISO: "2026-01-22",
    readingTime: "8 min read",
    heroImage: cashLeakageHero,
    heroAlt: "Visualization of invoices fading and dissolving representing silent cash leakage in accounts receivable",
    keywords: "collections intelligence, accounts receivable automation, invoice collectibility, early invoice follow-up, AR cash leakage",
    featured: true,
  },
];

// Helper functions
export const getBlogPostBySlug = (slug: string): BlogPost | undefined => {
  return blogPosts.find((post) => post.slug === slug);
};

export const getFeaturedPosts = (): BlogPost[] => {
  return blogPosts.filter((post) => post.featured);
};

export const getRecentPosts = (limit: number = 5): BlogPost[] => {
  return [...blogPosts]
    .sort((a, b) => new Date(b.publishDateISO).getTime() - new Date(a.publishDateISO).getTime())
    .slice(0, limit);
};

export const getPostsByCategory = (category: string): BlogPost[] => {
  return blogPosts.filter((post) => post.category === category);
};

export const getAllCategories = (): string[] => {
  return [...new Set(blogPosts.map((post) => post.category))];
};
