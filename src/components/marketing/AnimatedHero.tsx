 import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
 import { ArrowRight, Play, Sparkles } from "lucide-react";

import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import RollingAgentIntro from "./RollingAgentIntro";

const headlines = [
  "Collect Your Money. Intelligently.",
  "Act Earlier. Recover Smarter.",
  "Revenue Intelligence That Compounds",
  "Visibility Into Cash Outcomes, Before They Happen",
  "Risk-Aware Collections, Human-Controlled",
  "Predictable Cash Flow Starts With Better Signals",
  "Turn Payment Behavior Into Actionable Insight",
  "Collections Intelligence That Learns With You",
  "Healthy Cash Flow Is Built on Foresight",
  "Informed Decisions Drive Sustainable Growth",
  "Protect Cash Flow With Context-Aware Outreach",
  "Revenue Recognized Faster, Relationships Preserved",
  "From Aging Invoices to Actionable Intelligence",
  "Your AR, Guided by Real-Time Signals",
  "Financial Health Through Proactive Intelligence",
  "AI-Assisted Collections, Human-Approved Outcomes",
  "Build Resilience With Risk-Aware Automation",
  "Better Signals. Faster Recovery. Stronger Cash Position.",
  "Collections That Inform Your Next Move",
];

const subheadlines = [
  "Six AI agents learn from payment behavior to guide your next action—before risk compounds.",
  "AI-assisted outreach, reviewed before sending. You stay in control while intelligence scales.",
  "From friendly reminders to firm follow-ups—agents adapt tone based on real-time signals.",
  "Turn payment patterns into foresight. Act earlier, recover smarter, protect cash flow.",
  "Risk-aware automation designed to support predictable cash outcomes.",
  "Collections that preserve relationships—guided by context, approved by you.",
  "Intelligence that compounds with every touchpoint. Better signals, faster recovery.",
  "Let AI handle the follow-ups while you focus on decisions that matter.",
  "Enterprise-grade signals at a fraction of the cost of traditional AR teams.",
  "Context-aware outreach that knows when to be gentle and when to escalate—human-approved.",
];

const AnimatedHero = () => {
  const navigate = useNavigate();
   const containerRef = useRef<HTMLElement>(null);
  const [displayText, setDisplayText] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [currentSubheadline, setCurrentSubheadline] = useState(() => 
    Math.floor(Math.random() * subheadlines.length)
  );
 
   // Mouse parallax
   const mouseX = useMotionValue(0);
   const mouseY = useMotionValue(0);
   const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
   const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });
   
   const orbX1 = useTransform(springX, [-500, 500], [-30, 30]);
   const orbY1 = useTransform(springY, [-500, 500], [-30, 30]);
   const orbX2 = useTransform(springX, [-500, 500], [20, -20]);
   const orbY2 = useTransform(springY, [-500, 500], [20, -20]);
 
   useEffect(() => {
     const handleMouseMove = (e: MouseEvent) => {
       const rect = containerRef.current?.getBoundingClientRect();
       if (rect) {
         mouseX.set(e.clientX - rect.left - rect.width / 2);
         mouseY.set(e.clientY - rect.top - rect.height / 2);
       }
     };
     window.addEventListener('mousemove', handleMouseMove);
     return () => window.removeEventListener('mousemove', handleMouseMove);
   }, [mouseX, mouseY]);

  // Rotate headlines every 5 seconds
  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % headlines.length);
      setCurrentSubheadline(Math.floor(Math.random() * subheadlines.length));
      setDisplayText("");
      setIsTypingComplete(false);
    }, 5000);

    return () => clearInterval(rotationInterval);
  }, []);

  // Typewriter effect
  useEffect(() => {
    const currentHeadline = headlines[headlineIndex];
    let currentIndex = 0;
    
    const typingInterval = setInterval(() => {
      if (currentIndex <= currentHeadline.length) {
        setDisplayText(currentHeadline.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTypingComplete(true);
      }
    }, 40);

    return () => clearInterval(typingInterval);
  }, [headlineIndex]);

  return (
     <section ref={containerRef} className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-accent/5">
        <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
        
        {/* Animated gradient orbs */}
         <motion.div 
           className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
           style={{ x: orbX1, y: orbY1 }}
           animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.3, 0.2] }}
           transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
         />
         <motion.div 
           className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent/15 rounded-full blur-3xl"
           style={{ x: orbX2, y: orbY2 }}
           animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
           transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
         />
         <motion.div 
           className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px]"
           animate={{ rotate: 360 }}
           transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
         />
         
         {/* Floating particles */}
         {[...Array(15)].map((_, i) => (
           <motion.div
             key={`particle-${i}`}
             className="absolute w-1 h-1 bg-primary/40 rounded-full"
             style={{
               left: `${10 + Math.random() * 80}%`,
               top: `${10 + Math.random() * 80}%`,
             }}
             animate={{
               y: [0, -30, 0],
               opacity: [0.2, 0.6, 0.2],
               scale: [1, 1.5, 1],
             }}
             transition={{
               duration: 3 + Math.random() * 2,
               repeat: Infinity,
               delay: Math.random() * 2,
               ease: "easeInOut",
             }}
           />
         ))}
      </div>

      {/* Floating invoice cards */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
           <motion.div
            key={i}
             className="absolute opacity-20"
             initial={{ y: "100vh", rotate: -5 + Math.random() * 10 }}
             animate={{ 
               y: "-100vh",
               rotate: [-5, 5, -5],
            }}
             transition={{
               y: { duration: 12 + i * 2, repeat: Infinity, ease: "linear", delay: i * 1.5 },
               rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" }
             }}
             style={{ left: `${8 + i * 15}%` }}
          >
            <div className="w-24 h-32 bg-card/50 backdrop-blur-sm rounded-lg border border-border/30 shadow-lg p-3">
              <div className="w-full h-2 bg-primary/30 rounded mb-2"></div>
              <div className="w-3/4 h-2 bg-muted-foreground/20 rounded mb-2"></div>
              <div className="w-1/2 h-2 bg-muted-foreground/20 rounded"></div>
              <div className="mt-4 text-xs text-primary/50 font-mono">$1,250</div>
            </div>
           </motion.div>
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-5xl mx-auto">
          {/* Badge */}
           <motion.div 
             className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-8"
             initial={{ opacity: 0, y: 20, scale: 0.9 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             transition={{ duration: 0.6, ease: "easeOut" }}
           >
             <Sparkles className="w-4 h-4 animate-pulse" />
            Accounts Receivable Intelligence Platform
           </motion.div>
          
          {/* Supporting tagline */}
           <motion.p 
             className="text-sm text-muted-foreground mb-4"
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.3, duration: 0.6 }}
           >
            All AR and collection activities in one place — AI-powered, audit-ready, built for seamless handoffs
           </motion.p>

          {/* Typewriter Headline */}
           <AnimatePresence mode="wait">
             <motion.h1 
               key={headlineIndex}
               className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 leading-tight min-h-[1.2em]"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               transition={{ duration: 0.3 }}
             >
               <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                 {displayText}
               </span>
               <motion.span 
                 className="inline-block w-1 h-[0.9em] bg-primary ml-1 align-middle"
                 animate={{ 
                   opacity: isTypingComplete ? [1, 0, 1] : 1,
                   scaleY: isTypingComplete ? 1 : [1, 0.8, 1]
                 }}
                 transition={{ 
                   duration: isTypingComplete ? 0.8 : 0.15,
                   repeat: Infinity,
                   ease: "easeInOut"
                 }}
               />
             </motion.h1>
           </AnimatePresence>

          {/* Glow effect behind headline */}
           <motion.div 
             className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-primary/20 blur-[80px] -z-10"
             animate={{ opacity: [0.2, 0.4, 0.2] }}
             transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
           />

          {/* Subheadline - Randomized */}
           <AnimatePresence mode="wait">
             <motion.p 
               key={currentSubheadline}
               className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: isTypingComplete ? 1 : 0, y: isTypingComplete ? 0 : 20 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.5, ease: "easeOut" }}
             >
               {subheadlines[currentSubheadline]}
             </motion.p>
           </AnimatePresence>

          {/* Rolling AI Agent Introductions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isTypingComplete ? 1 : 0, y: isTypingComplete ? 0 : 20 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="my-8"
          >
            <RollingAgentIntro />
          </motion.div>

          {/* 24/7 Badge */}
           <motion.p 
             className="text-sm text-muted-foreground mb-10"
             initial={{ opacity: 0, scale: 0.9 }}
             animate={{ opacity: isTypingComplete ? 1 : 0, scale: isTypingComplete ? 1 : 0.9 }}
             transition={{ delay: 0.3, duration: 0.5 }}
           >
             <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/20">
               <motion.span 
                 className="w-2 h-2 bg-accent rounded-full"
                 animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                 transition={{ duration: 1.5, repeat: Infinity }}
               />
              These agents work 24/7 so you don't have to
            </span>
           </motion.p>

          {/* CTA Buttons */}
           <motion.div 
             className="flex gap-4 justify-center flex-wrap"
             initial={{ opacity: 0, y: 30 }}
             animate={{ opacity: isTypingComplete ? 1 : 0, y: isTypingComplete ? 0 : 30 }}
             transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
           >
             <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
               <Button 
                 size="lg" 
                 onClick={() => navigate("/signup")} 
                 className="text-lg px-8 py-6 relative group overflow-hidden shadow-lg shadow-primary/20"
               >
                 <motion.span 
                   className="absolute inset-0 bg-gradient-to-r from-primary to-accent"
                   initial={{ opacity: 0 }}
                   whileHover={{ opacity: 1 }}
                   transition={{ duration: 0.3 }}
                 />
                 <span className="relative flex items-center gap-2">
                    Start Collecting
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                 </span>
               </Button>
             </motion.div>
             <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
               <Button 
                 size="lg" 
                 variant="outline" 
                 onClick={() => navigate("/features")} 
                 className="text-lg px-8 py-6 group border-2"
               >
                 <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                 See Recouply.ai in Action
               </Button>
             </motion.div>
           </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
       <motion.div 
         className="absolute bottom-8 left-1/2 -translate-x-1/2"
         animate={{ y: [0, 10, 0] }}
         transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
       >
        <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center pt-2">
           <motion.div 
             className="w-1 h-3 bg-muted-foreground/50 rounded-full"
             animate={{ y: [0, 8, 0], opacity: [1, 0.3, 1] }}
             transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
           />
        </div>
       </motion.div>
    </section>
  );
};

export default AnimatedHero;
