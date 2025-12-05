import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ArrowRight, MessageCircle, Zap, Target, Sparkles, Bot, LogIn, AlertTriangle } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl, isRedirectUriMismatchError, SUPABASE_CALLBACK_URL } from "@/lib/appConfig";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const personas = Object.values(personaConfig);

const ComingSoon = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [hoveredPersona, setHoveredPersona] = useState<string | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visibleAgents, setVisibleAgents] = useState<number[]>([]);

  // Check for authenticated user and redirect to dashboard
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          navigate("/dashboard");
        }
      }
    );

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Staggered agent reveal animation
  useEffect(() => {
    const revealAgents = () => {
      personas.forEach((_, index) => {
        setTimeout(() => {
          setVisibleAgents(prev => [...prev, index]);
        }, index * 300);
      });
    };
    
    const timer = setTimeout(revealAgents, 500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-rotate carousel after all agents visible
  useEffect(() => {
    if (!carouselApi || visibleAgents.length < personas.length) return;

    const interval = setInterval(() => {
      carouselApi.scrollNext();
    }, 4000);

    return () => clearInterval(interval);
  }, [carouselApi, visibleAgents.length]);

  // Track current slide
  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase
        .from('waitlist_signups')
        .insert([{ email, name: name.trim() }]);
      
      if (error) {
        if (error.code === '23505') {
          toast.error("This email is already on the waitlist!");
        } else {
          throw error;
        }
      } else {
        // Send admin alert with name
        try {
          await supabase.functions.invoke('send-admin-alert', {
            body: { type: 'waitlist', email, name: name.trim() }
          });
        } catch (alertErr) {
          console.error('Failed to send admin alert:', alertErr);
        }
        
        toast.success("Thanks! We'll notify you when we launch.", {
          description: "You're now on the waitlist for early access."
        });
        setEmail("");
        setName("");
      }
    } catch (error) {
      console.error('Error saving to waitlist:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setOauthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl('/dashboard'),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        if (isRedirectUriMismatchError(error)) {
          setOauthError(`redirect_uri_mismatch: The Google OAuth redirect URI is not configured correctly. Admin: Add "${SUPABASE_CALLBACK_URL}" to Authorized redirect URIs in Google Cloud Console.`);
          toast.error('OAuth configuration error. Please contact the administrator.');
        } else if (error.message?.includes('provider') || error.message?.includes('not enabled')) {
          toast.error('Google sign-in is not yet configured. Please contact support.');
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      if (isRedirectUriMismatchError(error)) {
        setOauthError(`redirect_uri_mismatch: The Google OAuth redirect URI is not configured correctly. Admin: Add "${SUPABASE_CALLBACK_URL}" to Authorized redirect URIs in Google Cloud Console.`);
        toast.error('OAuth configuration error. Please contact the administrator.');
      } else {
        toast.error(error.message || "Google sign in failed");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/10" />
      
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/40 rounded-full animate-float-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${8 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Radial glow behind main card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/10 via-transparent to-transparent rounded-full blur-2xl" />

      <Card className="max-w-2xl w-full border-2 shadow-2xl relative z-10 backdrop-blur-sm bg-card/95">
        <CardContent className="pt-12 pb-12 px-8 text-center space-y-8">
          {/* Logo with glow effect */}
          <div className="space-y-4 relative">
            <div className="absolute inset-0 blur-3xl bg-primary/20 rounded-full" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent relative animate-fade-in">
              Recouply.ai
            </h1>
            <p className="text-2xl font-semibold text-foreground relative animate-fade-in" style={{ animationDelay: '0.1s' }}>
              AI-Powered Invoice Collection
            </p>
          </div>

          {/* Status Badge with pulse animation */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm font-medium text-primary">Private Beta</span>
          </div>

          {/* Main Message */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <h2 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
              <Sparkles className="h-6 w-6 text-primary animate-pulse" />
              Coming Soon
              <Sparkles className="h-6 w-6 text-primary animate-pulse" style={{ animationDelay: '0.5s' }} />
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              The AI Collections Command Center is launching soon. Get early access and transform how you collect overdue invoices.
            </p>
          </div>

          {/* AI Personas Carousel */}
          <div className="space-y-6 pt-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-semibold text-foreground flex items-center justify-center gap-2">
                <Bot className="h-6 w-6 text-primary animate-pulse" />
                Meet Your AI Collection Team
              </h3>
              
              {/* Animated Avatar Grid */}
              <div className="flex justify-center items-center gap-3 py-6">
                {personas.map((persona, index) => (
                  <div
                    key={persona.name}
                    className={`relative transition-all duration-500 ${
                      visibleAgents.includes(index)
                        ? 'opacity-100 scale-100 translate-y-0'
                        : 'opacity-0 scale-50 translate-y-8'
                    }`}
                    style={{ 
                      animationDelay: `${index * 0.15}s`,
                    }}
                  >
                    <div 
                      className={`relative cursor-pointer transition-all duration-300 hover:scale-125 ${
                        currentSlide === index ? 'scale-110 z-10' : 'hover:z-10'
                      }`}
                      onClick={() => carouselApi?.scrollTo(index)}
                      style={{
                        animation: visibleAgents.includes(index) ? `float ${3 + index * 0.5}s ease-in-out infinite` : 'none',
                        animationDelay: `${index * 0.3}s`,
                      }}
                    >
                      {/* Glow effect for active */}
                      {currentSlide === index && (
                        <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse" />
                      )}
                      <PersonaAvatar 
                        persona={persona} 
                        size="lg" 
                        className={`relative ${currentSlide === index ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      />
                      {/* Name tooltip on hover */}
                      <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium transition-opacity duration-200 ${
                        currentSlide === index ? 'opacity-100 text-primary' : 'opacity-0'
                      }`}>
                        {persona.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {visibleAgents.length === personas.length && (
                <p className="text-sm text-muted-foreground animate-fade-in">
                  6 specialized agents working 24/7 • Click an agent to learn more
                </p>
              )}

              {/* Slide indicators */}
              <div className="flex justify-center gap-2 pt-2">
                {personas.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => carouselApi?.scrollTo(i)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      currentSlide === i 
                        ? 'bg-primary w-6' 
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                  />
                ))}
              </div>
            </div>
            <Carousel 
              className="w-full max-w-2xl mx-auto"
              setApi={setCarouselApi}
            >
              <CarouselContent>
                {Object.values(personaConfig).map((persona) => (
                  <CarouselItem key={persona.name}>
                    <Card 
                      className="border-2 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 hover:border-primary/50 group"
                      onMouseEnter={() => setHoveredPersona(persona.name)}
                      onMouseLeave={() => setHoveredPersona(null)}
                      onClick={() => setSelectedPersona(selectedPersona === persona.name ? null : persona.name)}
                    >
                      <CardContent className="p-8 text-center space-y-6 relative overflow-hidden">
                        {/* Subtle gradient on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
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
                        
                        <div className="space-y-3 relative">
                          <h4 className="text-2xl font-bold text-foreground">{persona.name}</h4>
                          <p className="text-sm text-muted-foreground">{persona.description}</p>
                          <Badge variant="outline" className="text-primary border-primary">
                            {persona.bucketMin}-{persona.bucketMax || "+"} Days Past Due
                          </Badge>
                        </div>

                        <div className={`space-y-4 transition-all duration-500 relative ${
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
                          className="w-full mt-2 relative"
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

          {/* Features Preview with staggered animation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {[
              { icon: "⚡", title: "Automated Workflows", desc: "Set it and forget it collections", delay: "0.5s" },
              { icon: "📊", title: "Analytics Dashboard", desc: "Track every response and outcome", delay: "0.6s" },
              { icon: "🎯", title: "Smart Targeting", desc: "Right message at the right time", delay: "0.7s" },
            ].map((feature, i) => (
              <div 
                key={i} 
                className="space-y-2 animate-fade-in group hover:scale-105 transition-transform duration-300"
                style={{ animationDelay: feature.delay }}
              >
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors duration-300 group-hover:shadow-lg group-hover:shadow-primary/20">
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <h3 className="font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Early Access Login Section */}
          <div className="pt-6 space-y-4 animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <div className="relative">
              <Separator className="my-4" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-4 text-sm text-muted-foreground font-medium">
                Already have access?
              </span>
            </div>

            <div className="max-w-sm mx-auto space-y-3">
              {/* OAuth Error Alert - Admin Only */}
              {oauthError && (
                <Alert variant="destructive" className="text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>OAuth Configuration Error</AlertTitle>
                  <AlertDescription className="text-xs mt-2">
                    <p className="mb-2">{oauthError}</p>
                    <p className="font-medium">Required Redirect URI:</p>
                    <code className="block mt-1 p-2 bg-destructive/10 rounded text-xs break-all">
                      {SUPABASE_CALLBACK_URL}
                    </code>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {googleLoading ? "Signing in..." : "Sign in with Google"}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Early access members can sign in to access the platform
              </p>
            </div>
          </div>

          {/* Waitlist Form with glow effect */}
          <div className="pt-4">
            <div className="relative mb-4">
              <Separator className="my-4" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-4 text-sm text-muted-foreground font-medium">
                Not a member yet?
              </span>
            </div>
            
            <form onSubmit={handleWaitlistSubmit} className="max-w-md mx-auto space-y-4">
              <div className="space-y-3 relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-lg blur opacity-50 group-hover:opacity-100 transition duration-1000" />
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-background"
                    />
                  </div>
                  <Button type="submit" disabled={loading} size="lg" className="relative overflow-hidden group">
                    <span className="relative z-10">{loading ? "Joining..." : "Request Access"}</span>
                    <ArrowRight className="ml-2 h-4 w-4 relative z-10 group-hover:translate-x-1 transition-transform" />
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Join the waitlist to get early access and exclusive launch benefits
              </p>
            </form>
          </div>

        </CardContent>
      </Card>
    </div>
  );
};

export default ComingSoon;
