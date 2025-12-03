import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ArrowRight, MessageCircle, Zap, Target } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const ComingSoon = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [hoveredPersona, setHoveredPersona] = useState<string | null>(null);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('waitlist_signups')
        .insert([{ email }]);
      
      if (error) {
        if (error.code === '23505') {
          toast.error("This email is already on the waitlist!");
        } else {
          throw error;
        }
      } else {
        // Send admin alert
        try {
          await supabase.functions.invoke('send-admin-alert', {
            body: { type: 'waitlist', email }
          });
        } catch (alertErr) {
          console.error('Failed to send admin alert:', alertErr);
        }
        
        toast.success("Thanks! We'll notify you when we launch.", {
          description: "You're now on the waitlist for early access."
        });
        setEmail("");
      }
    } catch (error) {
      console.error('Error saving to waitlist:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-2 shadow-xl">
        <CardContent className="pt-12 pb-12 px-8 text-center space-y-8">
          {/* Logo */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Recouply.ai
            </h1>
            <p className="text-2xl font-semibold text-foreground">
              AI-Powered Invoice Collection
            </p>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm font-medium text-primary">Private Beta</span>
          </div>

          {/* Main Message */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground">
              Coming Soon
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              The AI Collections Command Center is launching soon. Get early access and transform how you collect overdue invoices.
            </p>
          </div>

          {/* AI Personas Carousel */}
          <div className="space-y-4 pt-4">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-semibold text-foreground">Meet Your AI Collection Team</h3>
              <p className="text-sm text-muted-foreground">6 specialized agents that handle every stage of collections</p>
            </div>
            <Carousel className="w-full max-w-2xl mx-auto">
              <CarouselContent>
                {Object.values(personaConfig).map((persona) => (
                  <CarouselItem key={persona.name}>
                    <Card 
                      className="border-2 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 hover:border-primary/50"
                      onMouseEnter={() => setHoveredPersona(persona.name)}
                      onMouseLeave={() => setHoveredPersona(null)}
                      onClick={() => setSelectedPersona(selectedPersona === persona.name ? null : persona.name)}
                    >
                      <CardContent className="p-8 text-center space-y-6">
                        <div className="relative">
                          <div className={`transition-transform duration-300 ${hoveredPersona === persona.name ? 'scale-110' : ''}`}>
                            <PersonaAvatar persona={persona} size="xl" className="justify-center" />
                          </div>
                          {hoveredPersona === persona.name && (
                            <div className="absolute -top-2 -right-2 animate-pulse">
                              <Badge className="bg-primary shadow-lg">Click to learn more</Badge>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="text-2xl font-bold text-foreground">{persona.name}</h4>
                          <p className="text-sm text-muted-foreground">{persona.description}</p>
                          <Badge variant="outline" className="text-primary border-primary">
                            {persona.bucketMin}-{persona.bucketMax || "+"} Days Past Due
                          </Badge>
                        </div>

                        <div className={`space-y-4 transition-all duration-500 ${
                          selectedPersona === persona.name 
                            ? 'max-h-96 opacity-100' 
                            : 'max-h-0 opacity-0 overflow-hidden'
                        }`}>
                          <div className="h-px bg-border" />
                          
                          <div className="space-y-3 text-left">
                            <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                              <MessageCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-foreground mb-1">Communication Style</p>
                                <p className="text-sm text-muted-foreground italic">"{persona.tone}"</p>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                              <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-foreground mb-1">Automated Actions</p>
                                <p className="text-sm text-muted-foreground">Sends reminders, follows up, and adapts messaging automatically</p>
                              </div>
                            </div>
                            
                            <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                              <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-foreground mb-1">Success Rate</p>
                                <p className="text-sm text-muted-foreground">Optimized for maximum recovery at this collection stage</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPersona(selectedPersona === persona.name ? null : persona.name);
                          }}
                        >
                          {selectedPersona === persona.name ? 'Show Less' : 'Learn More'}
                          <ArrowRight className={`ml-2 h-4 w-4 transition-transform ${
                            selectedPersona === persona.name ? 'rotate-90' : ''
                          }`} />
                        </Button>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="font-semibold text-foreground">Automated Workflows</h3>
              <p className="text-sm text-muted-foreground">Set it and forget it collections</p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-semibold text-foreground">Analytics Dashboard</h3>
              <p className="text-sm text-muted-foreground">Track every response and outcome</p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="font-semibold text-foreground">Smart Targeting</h3>
              <p className="text-sm text-muted-foreground">Right message at the right time</p>
            </div>
          </div>

          {/* Waitlist Form */}
          <form onSubmit={handleWaitlistSubmit} className="max-w-md mx-auto space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={loading} size="lg">
                {loading ? "Joining..." : "Request Access"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Join the waitlist to get early access and exclusive launch benefits
            </p>
          </form>

        </CardContent>
      </Card>
    </div>
  );
};

export default ComingSoon;
