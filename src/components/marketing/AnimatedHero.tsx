import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const AnimatedHero = () => {
  const navigate = useNavigate();
  const [displayText, setDisplayText] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const fullText = "AI-Powered Cash Operations That Collect Payments Automatically";

  useEffect(() => {
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setDisplayText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTypingComplete(true);
      }
    }, 40);

    return () => clearInterval(typingInterval);
  }, []);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-accent/5">
        <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] animate-spin-slow"></div>
      </div>

      {/* Floating invoice cards */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float-up opacity-20"
            style={{
              left: `${10 + i * 15}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${8 + i * 2}s`,
            }}
          >
            <div className="w-24 h-32 bg-card/50 backdrop-blur-sm rounded-lg border border-border/30 shadow-lg p-3">
              <div className="w-full h-2 bg-primary/30 rounded mb-2"></div>
              <div className="w-3/4 h-2 bg-muted-foreground/20 rounded mb-2"></div>
              <div className="w-1/2 h-2 bg-muted-foreground/20 rounded"></div>
              <div className="mt-4 text-xs text-primary/50 font-mono">$1,250</div>
            </div>
          </div>
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-8 animate-fade-in">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
            AI-Powered Cash Operations Platform
          </div>

          {/* Typewriter Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 leading-tight min-h-[1.2em]">
            <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
              {displayText}
            </span>
            <span className={`inline-block w-1 h-[1em] bg-primary ml-1 ${isTypingComplete ? 'animate-blink' : 'animate-pulse'}`}></span>
          </h1>

          {/* Glow effect behind headline */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-primary/20 blur-[80px] -z-10"></div>

          {/* Subheadline */}
          <p className={`text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto transition-all duration-700 ${isTypingComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Six AI Agents working 24/7 to recover payments, reduce DSO, and keep your cashflow healthy—without needing a big AR team.
          </p>

          {/* AI Agent Avatars */}
          <TooltipProvider delayDuration={100}>
            <div className={`flex justify-center items-center gap-3 md:gap-5 flex-wrap my-10 transition-all duration-700 delay-300 ${isTypingComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {Object.values(personaConfig).map((persona, index) => (
                <Tooltip key={persona.name}>
                  <TooltipTrigger asChild>
                    <div 
                      className="relative group cursor-pointer"
                      style={{ animationDelay: `${index * 150}ms` }}
                    >
                      <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative p-3 rounded-2xl bg-card/80 backdrop-blur-sm border-2 border-transparent hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 hover:scale-110 animate-float" style={{ animationDelay: `${index * 0.5}s` }}>
                        <PersonaAvatar persona={persona} size="lg" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs p-4 bg-card/95 backdrop-blur-sm border-2 border-primary/20">
                    <div className="space-y-2">
                      <h4 className="font-bold text-lg">{persona.name}</h4>
                      <p className="text-sm font-medium" style={{ color: persona.color }}>{persona.description}</p>
                      <p className="text-xs text-muted-foreground italic">"{persona.tone}"</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>

          {/* 24/7 Badge */}
          <p className={`text-sm text-muted-foreground mb-10 transition-all duration-700 delay-500 ${isTypingComplete ? 'opacity-100' : 'opacity-0'}`}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
              These agents work 24/7 so you don't have to
            </span>
          </p>

          {/* CTA Buttons */}
          <div className={`flex gap-4 justify-center flex-wrap transition-all duration-700 delay-700 ${isTypingComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <Button 
              size="lg" 
              onClick={() => navigate("/signup")} 
              className="text-lg px-8 py-6 relative group overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <span className="relative flex items-center gap-2">
                Get Started
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate("/features")} 
              className="text-lg px-8 py-6 group border-2"
            >
              <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
              See Recouply.ai in Action
            </Button>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center pt-2">
          <div className="w-1 h-3 bg-muted-foreground/50 rounded-full animate-scroll-down"></div>
        </div>
      </div>
    </section>
  );
};

export default AnimatedHero;
