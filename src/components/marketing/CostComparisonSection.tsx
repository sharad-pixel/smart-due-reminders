import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Zap, TrendingDown, Users } from "lucide-react";
import { PLAN_CONFIGS, formatPrice } from "@/lib/subscriptionConfig";

interface CostComparisonSectionProps {
  onCTAClick: () => void;
}

// Hook for intersection observer with reduced motion support
const useInViewAnimation = (threshold = 0.2) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView, prefersReducedMotion };
};

// Animated counter component
const AnimatedCounter = ({ 
  end, 
  duration = 1200, 
  prefix = "", 
  suffix = "",
  isInView,
  prefersReducedMotion
}: { 
  end: number; 
  duration?: number; 
  prefix?: string; 
  suffix?: string;
  isInView: boolean;
  prefersReducedMotion: boolean;
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    if (prefersReducedMotion) {
      setCount(end);
      return;
    }

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isInView, end, duration, prefersReducedMotion]);

  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
};

const comparisonData = [
  { category: "Coverage", traditional: "Business hours", recouply: "24/7 / 365" },
  { category: "Scale", traditional: "Linear (hire more)", recouply: "Instant (software)" },
  { category: "Cost Model", traditional: "$75k–$95k+ per hire", recouply: "Transparent subscription" },
  { category: "Reaction Time", traditional: "Often late", recouply: "Proactive" },
  { category: "Visibility", traditional: "Limited", recouply: "Full real-time dashboards" },
];

export const CostComparisonSection = ({ onCTAClick }: CostComparisonSectionProps) => {
  const { ref: sectionRef, isInView, prefersReducedMotion } = useInViewAnimation(0.15);
  const [tableVisible, setTableVisible] = useState(false);
  const [sourcesVisible, setSourcesVisible] = useState(false);

  useEffect(() => {
    if (isInView && !prefersReducedMotion) {
      // Stagger table appearance after main stats
      const tableTimer = setTimeout(() => setTableVisible(true), 800);
      const sourcesTimer = setTimeout(() => setSourcesVisible(true), 1400);
      return () => {
        clearTimeout(tableTimer);
        clearTimeout(sourcesTimer);
      };
    } else if (isInView && prefersReducedMotion) {
      setTableVisible(true);
      setSourcesVisible(true);
    }
  }, [isInView, prefersReducedMotion]);

  const animationClass = (delay: number) => 
    prefersReducedMotion 
      ? "opacity-100" 
      : isInView 
        ? `animate-fade-in opacity-100` 
        : "opacity-0 translate-y-3";

  return (
    <section ref={sectionRef} className="py-20 px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        <div className={`text-center mb-12 transition-all duration-700 ${animationClass(0)}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            <TrendingDown className="h-4 w-4" />
            Staffing Efficiency
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Reduce Collections Headcount Costs by <span className="text-primary">60–80%</span> with Automation
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-2">
            Based on publicly available U.S. compensation benchmarks for credit and collections roles.
          </p>
          <p className="text-base text-foreground/80 max-w-3xl mx-auto">
            Recouply.ai delivers the equivalent output of multiple always-on agents for less than the fully loaded cost of a single hire.
          </p>
        </div>

        {/* Animated Savings Callouts */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Human Cost Callout */}
          <div 
            className={`bg-card border-2 border-muted rounded-2xl p-8 text-center transition-all duration-700 ${
              prefersReducedMotion ? "" : isInView ? "animate-fade-in" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: prefersReducedMotion ? "0ms" : "200ms" }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Per Collector</span>
            </div>
            <div className="text-5xl md:text-6xl font-bold text-foreground mb-2">
              $<AnimatedCounter 
                end={95} 
                duration={1200} 
                suffix="k+" 
                isInView={isInView}
                prefersReducedMotion={prefersReducedMotion}
              />
            </div>
            <p className="text-muted-foreground">
              Estimated fully loaded annual cost of one collections hire
            </p>
          </div>

          {/* AI Agents Callout */}
          <div 
            className={`bg-primary/5 border-2 border-primary/20 rounded-2xl p-8 text-center transition-all duration-700 ${
              prefersReducedMotion ? "" : isInView ? "animate-fade-in" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: prefersReducedMotion ? "0ms" : "400ms" }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Zap className="h-6 w-6 text-primary" />
              <span className="text-sm font-semibold text-primary uppercase tracking-wide">Recouply.ai</span>
            </div>
            <div className="text-5xl md:text-6xl font-bold text-primary mb-2">
              6 AI Agents
            </div>
            <p className="text-muted-foreground">
              24/7 / 365 automation starting at <span className="font-semibold text-primary">{formatPrice(PLAN_CONFIGS.starter.monthlyPrice)}/mo</span>
            </p>
          </div>
        </div>

        {/* Comparison Cards */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Human Collectors Card */}
          <Card 
            className={`border-2 border-muted transition-all duration-700 ${
              prefersReducedMotion ? "" : tableVisible ? "animate-fade-in" : "opacity-0 translate-y-4"
            }`}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xl">👤</span>
                </div>
                <h3 className="text-xl font-bold">Traditional Collections Team</h3>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Average AR/Collections Analyst Salary (U.S.)</p>
                  <p className="text-2xl font-bold">$55,000 – $75,000</p>
                  <p className="text-xs text-muted-foreground">Base salary per year</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Fully Loaded Cost</p>
                  <p className="text-2xl font-bold text-destructive">$75,000 – $95,000+</p>
                  <p className="text-xs text-muted-foreground">Salary + benefits + payroll taxes + tools</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-3">2–3 Full-Time Collectors</p>
                <p className="text-3xl font-bold text-destructive mb-2">$150,000 – $250,000+</p>
                <p className="text-sm text-muted-foreground mb-4">Approximate annual cost</p>
                
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="text-destructive">✗</span> Business-hours only coverage
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-destructive">✗</span> Manual follow-ups
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-destructive">✗</span> Reactive outreach
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-destructive">✗</span> Limited visibility until delinquency escalates
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Recouply AI Card */}
          <Card 
            className={`border-2 border-primary relative overflow-hidden transition-all duration-700 ${
              prefersReducedMotion ? "" : tableVisible ? "animate-fade-in" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: prefersReducedMotion ? "0ms" : "100ms" }}
          >
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-bl-lg">
              Recommended
            </div>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Recouply.ai – 6 AI Agents</h3>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Starting At</p>
                  <p className="text-2xl font-bold text-primary">{formatPrice(PLAN_CONFIGS.starter.monthlyPrice)}/month</p>
                  <p className="text-xs text-muted-foreground">Full platform + 6 AI agents</p>
                </div>
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Annual Equivalent</p>
                  <p className="text-2xl font-bold text-primary">{formatPrice(PLAN_CONFIGS.starter.monthlyPrice * 12)}/year</p>
                  <p className="text-xs text-muted-foreground">Less than 1/6th the cost of a single hire</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-semibold mb-3">Always-On AI Coverage</p>
                <p className="text-lg font-medium text-primary mb-4">
                  Reduce dependence on incremental headcount
                </p>
                
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Operates 24/7 / 365
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Always-on monitoring of receivables
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Automated follow-ups and task creation
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Risk signals before delinquency escalates
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> No hiring, onboarding, PTO, or turnover
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Table */}
        <div 
          className={`bg-card border rounded-xl overflow-hidden mb-8 transition-all duration-700 ${
            prefersReducedMotion ? "" : tableVisible ? "animate-fade-in" : "opacity-0"
          }`}
          style={{ transitionDelay: prefersReducedMotion ? "0ms" : "200ms" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-semibold">Category</th>
                  <th className="text-left p-4 font-semibold">Traditional Collectors</th>
                  <th className="text-left p-4 font-semibold text-primary">Recouply.ai AI Agents</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {comparisonData.map((row, index) => (
                  <tr 
                    key={row.category}
                    className={`transition-all duration-500 ${
                      prefersReducedMotion ? "" : tableVisible ? "animate-fade-in" : "opacity-0"
                    }`}
                    style={{ 
                      transitionDelay: prefersReducedMotion ? "0ms" : `${300 + index * 80}ms`
                    }}
                  >
                    <td className="p-4 font-medium">{row.category}</td>
                    <td className="p-4 text-muted-foreground">{row.traditional}</td>
                    <td className="p-4 text-primary font-medium">{row.recouply}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trust Note */}
        <div 
          className={`bg-muted/30 rounded-xl p-6 mb-8 text-center transition-all duration-700 ${
            prefersReducedMotion ? "" : sourcesVisible ? "animate-fade-in" : "opacity-0"
          }`}
        >
          <p className="text-muted-foreground max-w-3xl mx-auto">
            Recouply.ai is designed to support internal AR and finance teams — not replace judgment, 
            but eliminate manual overhead and late-stage fire drills. Think of it as a 
            <strong className="text-foreground"> force-multiplier for your finance team</strong>, 
            shifting from reactive to proactive collections operations.
          </p>
        </div>

        {/* Salary Benchmark Sources */}
        <div 
          className={`text-center transition-all duration-700 ${
            prefersReducedMotion ? "" : sourcesVisible ? "animate-fade-in" : "opacity-0"
          }`}
          style={{ transitionDelay: prefersReducedMotion ? "0ms" : "100ms" }}
        >
          <p className="text-xs text-muted-foreground mb-3">
            Based on publicly available compensation benchmarks from leading salary and finance research firms.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <a 
              href="https://www.bls.gov/ooh/office-and-administrative-support/bill-and-account-collectors.htm" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              U.S. Bureau of Labor Statistics
            </a>
            <span className="text-muted-foreground">•</span>
            <a 
              href="https://www.roberthalf.com/us/en/job-details/credit-and-collections-analyst/san-francisco-ca" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Robert Half Salary Guide
            </a>
            <span className="text-muted-foreground">•</span>
            <a 
              href="https://www.glassdoor.com/Salaries/accounts-receivable-analyst-salary-SRCH_KO0,27.htm" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Glassdoor Salary Data
            </a>
          </div>
        </div>

        {/* CTAs */}
        <div 
          className={`mt-12 text-center space-y-4 transition-all duration-700 ${
            prefersReducedMotion ? "" : sourcesVisible ? "animate-fade-in" : "opacity-0"
          }`}
          style={{ transitionDelay: prefersReducedMotion ? "0ms" : "200ms" }}
        >
          <Button size="lg" onClick={onCTAClick}>
            Model Your Collections Cost vs. Automation
          </Button>
          <p className="text-sm text-muted-foreground">
            or <a href="/features" className="text-primary hover:underline">see how Recouply.ai supports finance teams</a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default CostComparisonSection;
