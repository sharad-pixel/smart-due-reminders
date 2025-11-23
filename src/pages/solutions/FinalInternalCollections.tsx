import { PersonaAvatar } from "@/components/PersonaAvatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MarketingLayout from "@/components/MarketingLayout";
import { personaConfig } from "@/lib/personaConfig";
import { Shield, Clock, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FinalInternalCollections = () => {
  const navigate = useNavigate();
  const rocco = personaConfig.rocco;

  return (
    <MarketingLayout>
      <div className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="outline">
              Final Internal Collections
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Final Internal Collections
              <br />
              Powered by Rocco
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Your last-resort internal recovery engine — before involving a 3rd-party agency.
            </p>
            
            <div className="flex justify-center mb-12">
              <PersonaAvatar persona={rocco} size="xl" showName />
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/signup")}>
                Try Recouply.ai
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/personas")}>
                See How Rocco Works
              </Button>
            </div>
          </div>

          {/* What is FIC Section */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="text-3xl">What is Final Internal Collections?</CardTitle>
              <CardDescription className="text-lg">
                The critical stage between regular collections and external agency referral
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground leading-relaxed">
                Final Internal Collections (FIC) is triggered when an account reaches a critical threshold—typically 
                after service has been revoked and all standard collection attempts have failed. Rocco steps in as your 
                firm, compliance-focused agent to make one final internal push before considering external options.
              </p>
              
              <div className="grid md:grid-cols-3 gap-6 mt-8">
                <div className="flex flex-col items-center text-center p-6 bg-muted/50 rounded-lg">
                  <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">When It Triggers</h3>
                  <p className="text-sm text-muted-foreground">
                    151+ days past due or when manually escalated to FIC status
                  </p>
                </div>

                <div className="flex flex-col items-center text-center p-6 bg-muted/50 rounded-lg">
                  <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Service Status</h3>
                  <p className="text-sm text-muted-foreground">
                    Service access already revoked, account in final internal stage
                  </p>
                </div>

                <div className="flex flex-col items-center text-center p-6 bg-muted/50 rounded-lg">
                  <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Compliance First</h3>
                  <p className="text-sm text-muted-foreground">
                    Firm but compliant—no threats, no legal language, fully white-labeled
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rocco Features */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Why Rocco is Different</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    <CardTitle>Firm, Not Threatening</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Rocco communicates with authority and urgency but never crosses compliance lines. 
                    No legal threats, no credit bureau mentions, no intimidation tactics.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    <CardTitle>White-Labeled Communications</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    All messages are sent as your business, never as Recouply.ai. Maintains your brand 
                    relationship while delivering critical payment requests.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    <CardTitle>Internal Recovery Focus</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Designed to maximize internal recovery before considering external agency referral. 
                    Helps businesses retain control and avoid agency fees.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    <CardTitle>Automated Escalation</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Automatically activates when invoices reach FIC threshold. Creates tasks for review 
                    and tracks all final internal collection attempts.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* FIC Process Timeline */}
          <Card className="mb-16">
            <CardHeader>
              <CardTitle className="text-3xl">The FIC Process with Rocco</CardTitle>
              <CardDescription className="text-lg">
                A structured, compliant approach to final internal recovery
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold">
                      1
                    </div>
                    <div className="w-0.5 h-full bg-border mt-2"></div>
                  </div>
                  <div className="flex-1 pb-8">
                    <h3 className="font-semibold text-lg mb-2">Day 0: Final Notice Email</h3>
                    <p className="text-muted-foreground mb-3">
                      Rocco sends a firm but professional final notice stating the account status, 
                      outstanding balance, and immediate action required. Service revocation is acknowledged.
                    </p>
                    <Badge variant="outline">Email</Badge>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold">
                      2
                    </div>
                    <div className="w-0.5 h-full bg-border mt-2"></div>
                  </div>
                  <div className="flex-1 pb-8">
                    <h3 className="font-semibold text-lg mb-2">Day 3: Reminder Follow-Up</h3>
                    <p className="text-muted-foreground mb-3">
                      Brief, serious reminder via email or SMS. Emphasizes urgency and requests immediate 
                      payment or response to arrange resolution.
                    </p>
                    <Badge variant="outline">Email / SMS</Badge>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold">
                      3
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Day 7: Account Review Task</h3>
                    <p className="text-muted-foreground mb-3">
                      Creates internal task for manual review. Team evaluates next steps: continue internal 
                      efforts, negotiate settlement, or consider external referral (if applicable).
                    </p>
                    <Badge variant="outline">Task</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Section */}
          <Card className="mb-16 bg-gradient-to-br from-muted/50 to-muted/20">
            <CardHeader>
              <CardTitle className="text-3xl">Early Buckets vs. Rocco (FIC)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Early Collection Personas (0-150 Days)
                  </h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Friendly to firm escalation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Service typically still active</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Focuses on relationship preservation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Multiple touchpoints over time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Automated workflow execution</span>
                    </li>
                  </ul>
                </div>

                <div className="border-l-2 border-primary/30 pl-8">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Rocco - Final Internal Collections (151+ Days)
                  </h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>Firm, authoritative communication</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>Service access already revoked</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>Last internal recovery attempt</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>Immediate action required</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>Requires human review before sending</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-4">
              Recover More Debt Internally with Rocco
            </h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Stop losing revenue to uncollectible accounts. Rocco helps you make one final, 
              professional push before considering external options.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/signup")}>
                Start Free Trial
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/contact")}>
                Talk to Collections Expert
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default FinalInternalCollections;