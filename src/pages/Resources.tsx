import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Resources = () => {
  const navigate = useNavigate();

  const resources = [
    {
      title: "How Home Services Can Reduce Late Payments",
      description: "A comprehensive guide for plumbing, HVAC, electrical, and contractor businesses to improve cash flow and reduce days sales outstanding.",
      category: "Home Services",
      pages: "12 pages"
    },
    {
      title: "The Auto Service Invoice Recovery Playbook",
      description: "Best practices for auto dealerships and repair shops to recover unpaid service invoices while maintaining customer relationships.",
      category: "Auto Industry",
      pages: "15 pages"
    },
    {
      title: "The SMB Guide to AI-Assisted Collections",
      description: "Learn how small and medium businesses across all industries can leverage AI to automate invoice collection without using collection agencies.",
      category: "General",
      pages: "20 pages"
    },
    {
      title: "Professional Services Cash Flow Optimization",
      description: "Strategies for agencies, consultants, and professional service firms to accelerate payments without uncomfortable conversations.",
      category: "Professional Services",
      pages: "10 pages"
    }
  ];

  return (
    <MarketingLayout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Marketing Resource Library
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Free guides and resources to help your business improve invoice collection, 
              accelerate cash flow, and maintain strong customer relationships.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {resources.map((resource, idx) => (
              <Card key={idx} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">{resource.pages}</span>
                  </div>
                  <CardTitle className="text-xl">{resource.title}</CardTitle>
                  <CardDescription className="text-sm">
                    <span className="inline-block bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium mb-2">
                      {resource.category}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {resource.description}
                  </p>
                  <Button variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download Guide
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center bg-card border rounded-lg p-12">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Put These Strategies Into Action?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Start automating your invoice collection process today with Recouply.ai's 
              AI-powered platform.
            </p>
            <Button 
              onClick={() => navigate("/signup")}
              size="lg"
            >
              Start Free Trial
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Resources;