import { PersonaAvatar } from "@/components/PersonaAvatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MarketingLayout from "@/components/MarketingLayout";
import { personaConfig } from "@/lib/personaConfig";
import { MessageSquare, Target, Clock, TrendingUp } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const sampleMessages: Record<string, string[]> = {
  sam: [
    "Hi [Customer Name], just a friendly reminder that Invoice #[NUMBER] for $[AMOUNT] was due on [DATE]. We'd love to help you get this sorted! Let us know if you need a payment link or have any questions. 😊",
    "Hey [Customer Name], checking in on Invoice #[NUMBER]. We know things can get busy – is there anything we can do to make payment easier for you?",
    "Quick follow-up on Invoice #[NUMBER]. Would love to help resolve this! Reply or call us anytime."
  ],
  james: [
    "Hi [Customer Name], Invoice #[NUMBER] for $[AMOUNT] is now [X] days overdue. Please remit payment at your earliest convenience. We're here if you need assistance or payment arrangements.",
    "Following up on Invoice #[NUMBER] – we haven't received payment yet. Let's work together to resolve this. Reply to discuss payment options.",
    "[Customer Name], we need to address Invoice #[NUMBER] ($[AMOUNT]). Please contact us within 48 hours to arrange payment or discuss terms."
  ],
  katy: [
    "Urgent: Invoice #[NUMBER] for $[AMOUNT] is [X] days overdue. Immediate payment is required to avoid additional actions. Contact us today to resolve this matter.",
    "[Customer Name], this is a serious notice regarding Invoice #[NUMBER]. Payment is significantly overdue. We must resolve this within 24 hours or escalate next steps.",
    "Final courtesy notice for Invoice #[NUMBER] ($[AMOUNT]). We require immediate payment or contact to arrange settlement. Please respond urgently."
  ],
  troy: [
    "URGENT ACTION REQUIRED: Invoice #[NUMBER] for $[AMOUNT] is critically overdue ([X] days). Payment must be received immediately or we will proceed with formal collection proceedings. Contact us within 24 hours.",
    "[Customer Name], Invoice #[NUMBER] remains unpaid after multiple attempts. This is your final opportunity to settle before we pursue legal remedies. Immediate response required.",
    "FINAL NOTICE: Invoice #[NUMBER] ($[AMOUNT]) – Payment or contact required TODAY. Failure to respond will result in escalation to legal proceedings and additional fees."
  ],
  gotti: [
    "LEGAL NOTICE: Invoice #[NUMBER] for $[AMOUNT] is [X] days overdue. This matter will be referred to our legal team and collections attorneys within 48 hours unless full payment is received. Additional fees and legal costs will apply. Contact immediately: [PHONE]",
    "DEMAND FOR PAYMENT: Invoice #[NUMBER] ($[AMOUNT]) – Final notice before legal action. We are prepared to file suit and pursue all available remedies including liens, wage garnishment, and asset seizure. Pay in full within 24 hours or provide certified funds arrangement.",
    "[Customer Name] – FINAL LEGAL NOTICE: Invoice #[NUMBER] unpaid for [X] days. Legal proceedings commence [DATE]. All collection costs, attorney fees, court costs, and interest will be added to your obligation. This is your last opportunity to resolve without litigation."
  ]
};

const strategies: Record<string, { approach: string; tactics: string[]; goal: string }> = {
  sam: {
    approach: "Friendly and relationship-focused",
    tactics: [
      "Use warm, conversational language",
      "Assume good intent and simple oversight",
      "Offer help and assistance proactively",
      "Include easy payment options",
      "Maintain positive customer relationship"
    ],
    goal: "Gentle reminder that preserves goodwill and encourages quick payment"
  },
  james: {
    approach: "Professional and direct",
    tactics: [
      "Clear business communication tone",
      "State facts without emotion",
      "Provide deadline expectations",
      "Offer structured payment solutions",
      "Balance firmness with professionalism"
    ],
    goal: "Create urgency while maintaining professional relationship"
  },
  katy: {
    approach: "Assertive and serious",
    tactics: [
      "Emphasize severity of situation",
      "Use urgent language and deadlines",
      "Reference consequences clearly",
      "Require immediate response",
      "Escalation warnings included"
    ],
    goal: "Drive immediate action through serious but professional pressure"
  },
  troy: {
    approach: "Firm and consequential",
    tactics: [
      "Final notice language",
      "Legal terminology introduced",
      "Clear escalation timeline",
      "Emphasize additional costs coming",
      "Last chance positioning"
    ],
    goal: "Secure payment through formal pressure before legal action"
  },
  gotti: {
    approach: "Legal and uncompromising",
    tactics: [
      "Legal notice format and language",
      "Reference specific legal remedies",
      "Attorney involvement mentioned",
      "Precise deadlines with consequences",
      "Full compliance requirements stated"
    ],
    goal: "Final opportunity before litigation with maximum legal pressure"
  }
};

const Personas = () => {
  return (
    <MarketingLayout>
      <div className="py-20 px-4 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Meet Your AI Collections Team
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Five specialized AI agents that adapt their communication style based on how overdue an invoice is. 
              Each persona uses proven collections psychology while maintaining compliance and professionalism.
            </p>
          </div>

          {/* Personas */}
          <div className="space-y-16">
            {Object.entries(personaConfig).map(([key, persona], index) => {
              const strategy = strategies[key];
              const messages = sampleMessages[key];

              return (
                <Card 
                  key={key} 
                  className="overflow-hidden hover:shadow-lg transition-shadow animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader className="bg-gradient-to-r from-card to-muted/20">
                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                      <PersonaAvatar persona={persona} size="xl" />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <CardTitle className="text-3xl">{persona.name}</CardTitle>
                          <Badge 
                            variant="outline" 
                            className="text-sm"
                            style={{ borderColor: persona.color, color: persona.color }}
                          >
                            {persona.bucketMin}-{persona.bucketMax || "+"} Days Past Due
                          </Badge>
                        </div>
                        <CardDescription className="text-lg">
                          {persona.description}
                        </CardDescription>
                        <p className="text-sm text-muted-foreground mt-2">
                          <span className="font-semibold">Tone:</span> {persona.tone}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6 space-y-6">
                    {/* Strategy Overview */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="flex gap-3">
                        <div className="bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                          <Target className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">Approach</h4>
                          <p className="text-sm text-muted-foreground">{strategy.approach}</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">Timing</h4>
                          <p className="text-sm text-muted-foreground">
                            Days {persona.bucketMin}-{persona.bucketMax || "∞"}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">Goal</h4>
                          <p className="text-sm text-muted-foreground">{strategy.goal}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Tactics */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Key Tactics & Features
                      </h4>
                      <ul className="grid md:grid-cols-2 gap-2">
                        {strategy.tactics.map((tactic, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-1">•</span>
                            <span className="text-muted-foreground">{tactic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Separator />

                    {/* Sample Messages */}
                    <div>
                      <h4 className="font-semibold mb-3">Sample Collection Messages</h4>
                      <div className="space-y-3">
                        {messages.map((message, i) => (
                          <div 
                            key={i}
                            className="bg-muted/40 rounded-lg p-4 border border-border/50"
                          >
                            <div className="flex items-start gap-2">
                              <Badge variant="secondary" className="shrink-0">
                                Example {i + 1}
                              </Badge>
                              <p className="text-sm leading-relaxed flex-1">
                                {message}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* CTA Section */}
          <div className="mt-16 text-center bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-4">
              Let AI Handle Your Collections Strategy
            </h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Each persona is automatically assigned based on invoice age. No manual work required – 
              just intelligent, compliant collections that adapt to each situation.
            </p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default Personas;
