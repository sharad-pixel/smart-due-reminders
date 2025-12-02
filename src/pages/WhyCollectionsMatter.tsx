import MarketingLayout from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

export default function WhyCollectionsMatter() {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative py-20 px-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
          <div className="container mx-auto max-w-6xl text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Collections, Cash Flow, and Revenue Recognition — The Lifeblood of Your Business
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-4xl mx-auto">
              Strong collections and clean AR processes are not back-office tasks — they are critical revenue drivers. 
              Recouply.ai empowers businesses to collect faster, reduce financial risk, and unlock stronger cash flow through precision AI.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate('/signup')}>
                Try Recouply.ai
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/ai-command-center')}>
                See the AI Collections Command Center
              </Button>
            </div>
          </div>
        </section>

        {/* Why Collections Matter */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
              Why Collections Matter More Than Ever
            </h2>
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <Card>
                <CardContent className="p-6">
                  <AlertTriangle className="w-12 h-12 text-warning mb-4" />
                  <h3 className="text-xl font-semibold mb-4">The Reality Every Business Faces</h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>The longer an invoice remains unpaid, the less likely it will ever be collected</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>Poor collections drag down EBITDA</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>Unpredictable payments block accurate forecasting</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>Cash delays cause operational bottlenecks</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>Late payments distort revenue reporting and close cycles</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span>Manual collections are slow, inconsistent, and often neglected</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-destructive/10 to-warning/10">
                <CardContent className="p-6">
                  <TrendingDown className="w-12 h-12 text-destructive mb-4" />
                  <h3 className="text-xl font-semibold mb-4">Collectability Declines Over Time</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">0-30 Days</span>
                        <span className="text-sm font-bold text-success">95% Collectability</span>
                      </div>
                      <div className="h-3 bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-success" style={{ width: '95%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">31-60 Days</span>
                        <span className="text-sm font-bold text-warning">75% Collectability</span>
                      </div>
                      <div className="h-3 bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-warning" style={{ width: '75%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">61-90 Days</span>
                        <span className="text-sm font-bold text-warning">55% Collectability</span>
                      </div>
                      <div className="h-3 bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-warning" style={{ width: '55%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">120+ Days</span>
                        <span className="text-sm font-bold text-destructive">25% Collectability</span>
                      </div>
                      <div className="h-3 bg-background rounded-full overflow-hidden">
                        <div className="h-full bg-destructive" style={{ width: '25%' }}></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Revenue Recognition Impact */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
              Collections → Direct Impact on Revenue Recognition
            </h2>
            <p className="text-xl text-muted-foreground mb-12 text-center max-w-3xl mx-auto">
              Revenue recognition requires collectability assessment. Poor collections directly impact your financial statements.
            </p>
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-4">The Financial Reality</h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Revenue recognition requires <strong>collectability assessment</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>High DSO and aged AR can force businesses to record allowances</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>May delay revenue recognition or lower recognized revenue for the period</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Persistent bad debt → increased reserves and reduced net revenue</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <span>Clean collections = clean books</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-primary/10 to-secondary/10">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Benefits of Strong Collections</h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <TrendingUp className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                      <span>Faster cash collection reduces doubtful revenue</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <TrendingUp className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                      <span>Clean AR improves ASC 606 compliance</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <TrendingUp className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                      <span>AI-driven collections reduces the risk of misstatements</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <TrendingUp className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                      <span>Finance, RevOps, and Revenue Accounting rely on accurate AR timelines</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Cash Flow Drives Growth */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
              Cash Flow Drives Growth
            </h2>
            <Card className="bg-gradient-to-r from-success/10 to-primary/10 mb-8">
              <CardContent className="p-8 text-center">
                <p className="text-2xl md:text-3xl font-bold mb-2">
                  "Businesses with optimized collections have 30–60% faster cash cycles"
                </p>
                <p className="text-xl text-muted-foreground">
                  and up to 40% fewer bad-debt write-offs
                </p>
              </CardContent>
            </Card>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <TrendingUp className="w-10 h-10 text-success mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Reduces Financing Needs</h3>
                  <p className="text-muted-foreground">Strong cash flow reduces reliance on external financing</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <TrendingUp className="w-10 h-10 text-success mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Enables Reinvestment</h3>
                  <p className="text-muted-foreground">Fund product development, hiring, and growth initiatives</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <TrendingUp className="w-10 h-10 text-success mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Better Terms</h3>
                  <p className="text-muted-foreground">Negotiate better payment terms with vendors and suppliers</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <TrendingUp className="w-10 h-10 text-success mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Investor Confidence</h3>
                  <p className="text-muted-foreground">Improves valuation and strengthens investor relationships</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <TrendingUp className="w-10 h-10 text-success mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Risk Mitigation</h3>
                  <p className="text-muted-foreground">Weather economic downturns with stronger reserves</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <TrendingUp className="w-10 h-10 text-success mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Operational Stability</h3>
                  <p className="text-muted-foreground">Predictable cash enables consistent operations</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Business Problems */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
              Business Problems Caused by Weak Collections
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                "High Days Sales Outstanding (DSO)",
                "Delayed revenue close",
                "Dirty AR aging",
                "Unpredictable cash inflows",
                "Customer disputes escalating late in the cycle",
                "Broken service-to-payment workflows",
                "High operational costs chasing overdue invoices",
                "Overworked accounting & RevOps teams",
                "Inconsistent communication across teams"
              ].map((problem, index) => (
                <Card key={index} className="border-destructive/20">
                  <CardContent className="p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{problem}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How Recouply Solves This */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
              How Recouply.ai Solves This
            </h2>
            <div className="space-y-8">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-2">
                    <div className="p-8 bg-gradient-to-br from-primary/10 to-secondary/10">
                      <h3 className="text-2xl font-bold mb-4">AI-Powered Collections Engine</h3>
                      <ul className="space-y-3 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                          <span>Personalized messaging by aging bucket</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                          <span>6 AI personas: Rocco, Katy, Sam, James, Troy, and Gotti</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                          <span>Automated outreach + human-approved messaging</span>
                        </li>
                      </ul>
                    </div>
                    <div className="p-8">
                      <h3 className="text-2xl font-bold mb-4">Collections Command Center</h3>
                      <ul className="space-y-3 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                          <span>Full visibility into collections pipeline</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                          <span>Activity tracking and task extraction</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                          <span>AI-driven recommendations and debtor insights</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-8">
                <Card>
                  <CardContent className="p-8">
                    <h3 className="text-2xl font-bold mb-4">Revenue Recognition Support</h3>
                    <ul className="space-y-3 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                        <span>Clean AR data for accurate reporting</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                        <span>Fewer disputes through proactive communication</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                        <span>Faster cash application</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                        <span>Better reserve calculations</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-8">
                    <h3 className="text-2xl font-bold mb-4">Improved Cash Flow</h3>
                    <ul className="space-y-3 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                        <span>Shorter Days Sales Outstanding (DSO)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                        <span>Higher recovery rates</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                        <span>Automated reminders reduce manual workload</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                        <span>Predictable cash cycles</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
              The Cost of Doing Nothing
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-destructive/30">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-6 text-destructive">Without Recouply.ai</h3>
                  <ul className="space-y-4">
                    {[
                      "120+ day AR accumulation",
                      "Increased customer disputes",
                      "High write-offs and bad debt",
                      "Slow revenue close cycles",
                      "Cash shortages and unpredictability",
                      "Fire-drill collections approach",
                      "Overworked teams",
                      "Inconsistent customer communication"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-success/30">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-6 text-success">With Recouply.ai</h3>
                  <ul className="space-y-4">
                    {[
                      "Automated, on-time internal collections",
                      "Predictable cash cycles",
                      "Fewer escalations and disputes",
                      "Stronger financial controls",
                      "Better customer experience",
                      "Improved team efficiency",
                      "Clean AR and accurate reporting",
                      "Proactive collections strategy"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-4 bg-gradient-to-r from-primary/10 to-secondary/10">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Strengthen Your Cash Flow & Reduce Bad Debt?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join hundreds of businesses using AI to transform their collections process
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate('/signup')}>
                Try Recouply.ai
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/contact')}>
                Book a Demo
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/ai-command-center')}>
                See AI Command Center <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
