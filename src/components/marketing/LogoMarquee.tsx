const logos = [
  "TechScale", "GrowthBase", "CloudServe", "DataFlow", "SmartOps", 
  "FinanceHub", "PaymentPro", "InvoiceAI", "CashFlow+", "RevenuePro"
];

const LogoMarquee = () => {
  return (
    <section className="py-16 px-4 bg-muted/20 overflow-hidden">
      <div className="container mx-auto max-w-6xl">
        <p className="text-center text-sm text-muted-foreground mb-8">
          Trusted by growing companies worldwide
        </p>
        
        <div className="relative">
          {/* Gradient masks */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-muted/20 to-transparent z-10"></div>
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-muted/20 to-transparent z-10"></div>
          
          {/* Scrolling container */}
          <div className="flex gap-12 animate-marquee hover:pause-animation">
            {[...logos, ...logos].map((logo, index) => (
              <div
                key={index}
                className="flex-shrink-0 px-6 py-3 bg-card rounded-lg border border-border/30 text-muted-foreground font-semibold text-lg hover:text-foreground hover:border-primary/30 transition-colors"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LogoMarquee;
