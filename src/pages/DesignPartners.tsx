import { Link } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Rocket, 
  Users, 
  Lightbulb, 
  MessageSquare, 
  Gift, 
  CheckCircle2,
  ArrowRight,
  Star
} from "lucide-react";

const DesignPartners = () => {
  const benefits = [
    {
      icon: Gift,
      title: "Lifetime Discount",
      description: "Lock in exclusive founding member pricing that stays with you forever."
    },
    {
      icon: MessageSquare,
      title: "Direct Access",
      description: "Weekly calls with our product team to share feedback and shape the roadmap."
    },
    {
      icon: Lightbulb,
      title: "Early Features",
      description: "Be the first to try new Collection Intelligence capabilities before public release."
    },
    {
      icon: Users,
      title: "Community",
      description: "Join a private community of forward-thinking finance leaders."
    }
  ];

  const idealPartners = [
    "Finance teams with 50+ monthly invoices",
    "Currently using manual collection processes",
    "Open to providing regular feedback",
    "Willing to participate in case studies"
  ];

  return (
    <MarketingLayout>
      <SEOHead
        title="Design Partner Program | Recouply"
        description="Join Recouply's Design Partner Program. Help shape the future of Collection Intelligence and get exclusive benefits as a founding partner."
        keywords="design partner, early access, collection intelligence, AR automation, founding member"
        canonical="https://recouply.ai/design-partners"
      />
      
      {/* Hero Section */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 text-primary">
            <Star className="w-3 h-3 mr-1" />
            Limited Spots Available
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 max-w-4xl mx-auto">
            Help Build the Future of{" "}
            <span className="text-primary">Collection Intelligence</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Join our Design Partner Program and work directly with our team to shape 
            the next generation of AI-powered accounts receivable automation.
          </p>
          <Button size="lg" className="gap-2" asChild>
            <Link to="/contact">
              Apply Now
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Partner Benefits</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              As a Design Partner, you'll receive exclusive perks while helping us 
              build the perfect solution for your team.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => (
              <Card key={index} className="border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground text-sm">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Ideal Partners Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Who We're Looking For
                </h2>
                <p className="text-muted-foreground mb-6">
                  We're seeking finance teams who are passionate about transforming 
                  their AR processes and willing to collaborate closely with our team.
                </p>
                <ul className="space-y-3">
                  {idealPartners.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <Card className="bg-card border-primary/20">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Rocket className="w-8 h-8 text-primary" />
                    <h3 className="text-xl font-semibold">Ready to Join?</h3>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    We're accepting a limited number of design partners to ensure 
                    we can provide personalized attention to each team.
                  </p>
                  <Button className="w-full gap-2" asChild>
                    <Link to="/contact">
                      Contact Us
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default DesignPartners;
