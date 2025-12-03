import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "Replaced 80% of our manual AR tasks",
    fullText: "Recouply.ai replaced 80% of our manual AR tasks in the first 30 days. Our DSO dropped from 58 days to 34 days, and we recovered an additional $127K in outstanding payments.",
    author: "Sarah Chen",
    role: "CFO, TechScale Inc.",
    rating: 5,
  },
  {
    quote: "Like having 6 AR specialists 24/7",
    fullText: "It's like having 6 AR specialists working around the clock. The AI agents handle everything from gentle reminders to firm escalations. We've seen a 40% improvement in payment velocity.",
    author: "Michael Torres",
    role: "Finance Director, GrowthBase",
    rating: 5,
  },
  {
    quote: "Best ROI on any SaaS we've purchased",
    fullText: "Best ROI on any SaaS we've purchased this year. Within 60 days, we collected $89K that was sitting in aging buckets. The automated follow-ups are perfectly timed and professional.",
    author: "Jennifer Wright",
    role: "VP Finance, CloudServe Pro",
    rating: 5,
  },
];

const TestimonialCards = () => {
  return (
    <section className="py-24 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Customer Stories
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Why Teams Love Recouply.ai
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Hear from finance leaders who've transformed their cash operations
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="group perspective-1000"
              style={{ perspective: "1000px" }}
            >
              <div className="relative h-72 transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                {/* Front of card */}
                <div className="absolute inset-0 bg-card rounded-2xl border border-border/50 shadow-lg p-6 [backface-visibility:hidden] flex flex-col">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-warning text-warning" />
                    ))}
                  </div>
                  <h3 className="text-xl font-bold mb-4 flex-1">"{testimonial.quote}"</h3>
                  <div className="mt-auto pt-4 border-t border-border/50">
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>

                {/* Back of card */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl border border-primary/30 shadow-lg p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col">
                  <p className="text-sm leading-relaxed flex-1">"{testimonial.fullText}"</p>
                  <div className="mt-auto pt-4 border-t border-primary/20">
                    <p className="font-semibold text-primary">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-6">Trusted by finance teams worldwide</p>
          <div className="flex justify-center items-center gap-8 flex-wrap opacity-50">
            {["SOC 2 Type II", "GDPR Compliant", "256-bit Encryption", "99.9% Uptime"].map((badge, i) => (
              <div key={i} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium">
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialCards;
