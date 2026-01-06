import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { AlertTriangle, X, Brain } from "lucide-react";
import { personaConfig } from "@/lib/personaConfig";

const watchdogAgent = {
  name: "Watchdog",
  description: "Proactive Risk Intelligence & Early Detection",
  tone: "Analyzes payment patterns, communication sentiment, and account behavior to flag at-risk accounts before they become delinquent",
  dayRange: "Always Active",
};

const AIAgentsSection = () => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  return (
    <section className="py-24 px-4 bg-gradient-to-b from-muted/10 to-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            <Brain className="h-4 w-4" />
            Collection Intelligence Agents
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Six AI Agents Powering Your Intelligence
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Each agent analyzes accounts, communications, payments, and tasks to maximize recovery
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-xl mx-auto mt-3">
            AI-driven workflows ensure consistency without manual follow-ups — context preserved across every interaction
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(personaConfig).map(([key, persona]) => (
            <Card 
              key={key}
              className="bg-card hover:shadow-xl transition-all duration-300 cursor-pointer group border-border/50 hover:border-primary/30 animate-float"
              style={{ animationDelay: `${Object.keys(personaConfig).indexOf(key) * 0.2}s` }}
              onClick={() => setSelectedAgent(key)}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <PersonaAvatar persona={key} size="md" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{persona.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {persona.bucketMin}-{persona.bucketMax || "150+"} Days
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{persona.description}</p>
              </CardContent>
            </Card>
          ))}
          
          {/* Watchdog Agent */}
          <Card 
            className="bg-card hover:shadow-xl transition-all duration-300 cursor-pointer group border-primary/20 hover:border-primary/40"
            onClick={() => setSelectedAgent("watchdog")}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-lg">{watchdogAgent.name}</h4>
                  <p className="text-xs text-muted-foreground">{watchdogAgent.dayRange}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{watchdogAgent.description}</p>
            </CardContent>
          </Card>
        </div>
        
        {/* 24/7 Banner */}
        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-3 bg-accent/10 text-accent px-8 py-4 rounded-full">
            <span className="w-3 h-3 bg-accent rounded-full animate-pulse"></span>
            <span className="font-semibold text-lg">These agents work 24/7 so you don't have to</span>
          </div>
        </div>
        
        {/* AI Risk & Expansion Intelligence */}
        <div className="mt-16 max-w-3xl mx-auto text-center">
          <div className="bg-card rounded-2xl border border-border/50 p-8">
            <h3 className="text-xl font-semibold mb-4">Intelligence That Compounds</h3>
            <p className="text-muted-foreground mb-4">
              Recouply.ai uses historical collection behavior, payment patterns, and engagement data to assess risk — and to inform smarter future decisions with existing customers.
            </p>
            <p className="text-sm text-primary font-medium">
              Collection data doesn't just reduce risk; it becomes intelligence for renewals, upsells, and expansion.
            </p>
          </div>
        </div>

        {/* Agent Detail Modal */}
        {selectedAgent && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAgent(null)}
          >
            <div 
              className="bg-card rounded-2xl border border-border/50 shadow-2xl max-w-md w-full p-8 relative animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedAgent(null)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
              
              {selectedAgent === "watchdog" ? (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{watchdogAgent.name}</h3>
                      <p className="text-muted-foreground">{watchdogAgent.dayRange}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-4">{watchdogAgent.description}</p>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm italic">"{watchdogAgent.tone}"</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <PersonaAvatar persona={selectedAgent} size="lg" />
                    <div>
                      <h3 className="text-2xl font-bold">{personaConfig[selectedAgent]?.name}</h3>
                      <p className="text-muted-foreground">
                        {personaConfig[selectedAgent]?.bucketMin}-{personaConfig[selectedAgent]?.bucketMax || "150+"} Days Past Due
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-4">{personaConfig[selectedAgent]?.description}</p>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm italic">"{personaConfig[selectedAgent]?.tone}"</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AIAgentsSection;
