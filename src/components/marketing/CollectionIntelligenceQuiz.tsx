 import { useState } from "react";
 import { motion, AnimatePresence } from "framer-motion";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent } from "@/components/ui/card";
 import { useNavigate } from "react-router-dom";
 import { 
   Brain, 
   TrendingUp, 
   Clock, 
   DollarSign, 
   AlertTriangle, 
   CheckCircle2, 
   ArrowRight,
   Sparkles,
   Loader2,
   BarChart3
 } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 
 interface Question {
   id: string;
   question: string;
   icon: React.ElementType;
   options: { label: string; value: string; emoji?: string }[];
 }
 
 const questions: Question[] = [
   {
     id: "dso",
     question: "What's your current Days Sales Outstanding (DSO)?",
     icon: Clock,
     options: [
       { label: "Under 30 days", value: "under_30", emoji: "✅" },
       { label: "30-45 days", value: "30_45", emoji: "⚡" },
       { label: "45-60 days", value: "45_60", emoji: "⚠️" },
       { label: "Over 60 days", value: "over_60", emoji: "🚨" },
     ],
   },
   {
     id: "avg_receivable",
     question: "What's your average invoice/receivable value?",
     icon: DollarSign,
     options: [
       { label: "Under $500", value: "under_500", emoji: "💵" },
       { label: "$500 - $2,500", value: "500_2500", emoji: "💰" },
       { label: "$2,500 - $10,000", value: "2500_10000", emoji: "💎" },
       { label: "Over $10,000", value: "over_10000", emoji: "🏦" },
     ],
   },
   {
     id: "monthly_invoices",
     question: "How many invoices do you send monthly?",
     icon: BarChart3,
     options: [
       { label: "1-50 invoices", value: "1_50", emoji: "📄" },
       { label: "51-200 invoices", value: "51_200", emoji: "📊" },
       { label: "201-500 invoices", value: "201_500", emoji: "📈" },
       { label: "500+ invoices", value: "500_plus", emoji: "🏢" },
     ],
   },
   {
     id: "overdue_percentage",
     question: "What percentage of invoices go overdue?",
     icon: AlertTriangle,
     options: [
       { label: "Less than 10%", value: "under_10", emoji: "🎯" },
       { label: "10-25%", value: "10_25", emoji: "📉" },
       { label: "25-40%", value: "25_40", emoji: "⚠️" },
       { label: "Over 40%", value: "over_40", emoji: "🔥" },
     ],
   },
   {
     id: "collection_method",
     question: "How do you currently follow up on late payments?",
     icon: TrendingUp,
     options: [
       { label: "Manual emails/calls", value: "manual", emoji: "📞" },
       { label: "Basic email reminders", value: "basic_auto", emoji: "📧" },
       { label: "Spreadsheet tracking", value: "spreadsheet", emoji: "📋" },
       { label: "No systematic process", value: "none", emoji: "🤷" },
     ],
   },
   {
     id: "ar_team_size",
     question: "How many people handle your AR?",
     icon: DollarSign,
     options: [
       { label: "Just me", value: "solo", emoji: "👤" },
       { label: "1-2 people", value: "small", emoji: "👥" },
       { label: "3-5 people", value: "medium", emoji: "👨‍👩‍👧‍👦" },
       { label: "6+ people", value: "large", emoji: "🏢" },
     ],
   },
 ];
 
 interface Summary {
   headline: string;
   riskLevel: "low" | "medium" | "high";
   estimatedRecovery: string;
   keyInsights: string[];
   recommendation: string;
   dsoImpact: number;
 }
 
 const CollectionIntelligenceQuiz = () => {
   const navigate = useNavigate();
   const [isOpen, setIsOpen] = useState(false);
   const [currentQuestion, setCurrentQuestion] = useState(0);
   const [answers, setAnswers] = useState<Record<string, string>>({});
   const [isLoading, setIsLoading] = useState(false);
   const [summary, setSummary] = useState<Summary | null>(null);
 
   const handleAnswer = (questionId: string, value: string) => {
     setAnswers((prev) => ({ ...prev, [questionId]: value }));
     
     if (currentQuestion < questions.length - 1) {
       setTimeout(() => setCurrentQuestion((prev) => prev + 1), 300);
     } else {
       generateSummary({ ...answers, [questionId]: value });
     }
   };
 
   const generateSummary = async (finalAnswers: Record<string, string>) => {
     setIsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke("collection-intelligence-quiz", {
         body: { answers: finalAnswers },
       });
 
       if (error) throw error;
       setSummary(data);
     } catch (err) {
       console.error("Error generating summary:", err);
       toast.error("Could not generate your personalized report. Please try again.");
       setSummary({
         headline: "Your Cash Flow Deserves Better",
         riskLevel: "medium",
         estimatedRecovery: "$5,000 - $20,000/month",
         keyInsights: [
           "AI-powered follow-ups recover 35% more revenue",
           "Automated outreach reduces DSO by 15-25 days",
           "24/7 collection agents never miss a payment window"
         ],
         recommendation: "Start your free trial to unlock your full Collection Intelligence report.",
         dsoImpact: 18
       });
     } finally {
       setIsLoading(false);
     }
   };
 
   const resetQuiz = () => {
     setCurrentQuestion(0);
     setAnswers({});
     setSummary(null);
     setIsOpen(false);
   };
 
   const riskColors = {
     low: "text-green-500 bg-green-500/10 border-green-500/30",
     medium: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
     high: "text-red-500 bg-red-500/10 border-red-500/30",
   };
 
   const question = questions[currentQuestion];
   const progress = ((currentQuestion + 1) / questions.length) * 100;
 
   if (!isOpen) {
     return (
       <motion.div
         initial={{ opacity: 0, scale: 0.9 }}
         animate={{ opacity: 1, scale: 1 }}
         className="fixed bottom-6 right-6 z-50"
       >
         <motion.button
           onClick={() => setIsOpen(true)}
           className="group relative flex items-center gap-3 px-5 py-3 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all"
           whileHover={{ scale: 1.05 }}
           whileTap={{ scale: 0.98 }}
         >
           <motion.div
             animate={{ rotate: [0, 10, -10, 0] }}
             transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
           >
             <Brain className="h-5 w-5" />
           </motion.div>
           <span className="font-semibold">Get Your Collection Intelligence Score</span>
           <Sparkles className="h-4 w-4 opacity-70" />
           
           {/* Pulse ring */}
           <motion.div
             className="absolute inset-0 rounded-full border-2 border-primary"
             animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
             transition={{ duration: 2, repeat: Infinity }}
           />
         </motion.button>
       </motion.div>
     );
   }
 
   return (
     <AnimatePresence>
       <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
         onClick={(e) => e.target === e.currentTarget && resetQuiz()}
       >
         <motion.div
           initial={{ opacity: 0, scale: 0.9, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.9, y: 20 }}
           className="w-full max-w-lg"
         >
           <Card className="border-2 border-primary/20 shadow-2xl shadow-primary/10 overflow-hidden">
             {/* Header */}
             <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 p-4 border-b border-border">
               <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2">
                   <Brain className="h-5 w-5 text-primary" />
                   <span className="font-semibold text-sm">Collection Intelligence Quiz</span>
                 </div>
                 <button 
                   onClick={resetQuiz}
                   className="text-muted-foreground hover:text-foreground text-xl leading-none"
                 >
                   ×
                 </button>
               </div>
               {!summary && !isLoading && (
                 <div className="h-2 bg-muted rounded-full overflow-hidden">
                   <motion.div
                     className="h-full bg-primary"
                     initial={{ width: 0 }}
                     animate={{ width: `${progress}%` }}
                     transition={{ duration: 0.3 }}
                   />
                 </div>
               )}
             </div>
 
             <CardContent className="p-6">
               <AnimatePresence mode="wait">
                 {isLoading ? (
                   <motion.div
                     key="loading"
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="flex flex-col items-center justify-center py-12 text-center"
                   >
                     <motion.div
                       animate={{ rotate: 360 }}
                       transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                     >
                       <Brain className="h-12 w-12 text-primary mb-4" />
                     </motion.div>
                     <p className="text-lg font-medium mb-2">Analyzing Your Collection Profile...</p>
                     <p className="text-sm text-muted-foreground">AI is generating your personalized insights</p>
                   </motion.div>
                 ) : summary ? (
                   <motion.div
                     key="summary"
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="space-y-5"
                   >
                     {/* Headline */}
                     <div className="text-center">
                       <motion.div
                         initial={{ scale: 0 }}
                         animate={{ scale: 1 }}
                         transition={{ type: "spring", delay: 0.2 }}
                         className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${riskColors[summary.riskLevel]} mb-3`}
                       >
                         {summary.riskLevel === "low" && <CheckCircle2 className="h-4 w-4" />}
                         {summary.riskLevel === "medium" && <AlertTriangle className="h-4 w-4" />}
                         {summary.riskLevel === "high" && <AlertTriangle className="h-4 w-4" />}
                         <span className="font-semibold capitalize">{summary.riskLevel} Risk Profile</span>
                       </motion.div>
                       <h3 className="text-xl font-bold">{summary.headline}</h3>
                     </div>
 
                     {/* Stats */}
                     <div className="grid grid-cols-2 gap-3">
                       <div className="bg-accent/10 rounded-lg p-3 text-center">
                         <DollarSign className="h-5 w-5 text-accent mx-auto mb-1" />
                         <p className="text-sm text-muted-foreground">Est. Recovery</p>
                         <p className="font-bold text-accent">{summary.estimatedRecovery}</p>
                       </div>
                       <div className="bg-primary/10 rounded-lg p-3 text-center">
                         <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
                         <p className="text-sm text-muted-foreground">DSO Reduction</p>
                         <p className="font-bold text-primary">-{summary.dsoImpact} days</p>
                       </div>
                     </div>
 
                     {/* Insights */}
                     <div className="space-y-2">
                       <p className="text-sm font-semibold text-muted-foreground">Key Insights:</p>
                       {summary.keyInsights.map((insight, i) => (
                         <motion.div
                           key={i}
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           transition={{ delay: 0.3 + i * 0.1 }}
                           className="flex items-start gap-2 text-sm"
                         >
                           <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                           <span>{insight}</span>
                         </motion.div>
                       ))}
                     </div>
 
                     {/* CTA */}
                     <motion.div
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: 0.6 }}
                     >
                       <p className="text-sm text-muted-foreground mb-3 text-center">{summary.recommendation}</p>
                       <Button 
                         onClick={() => navigate("/signup")} 
                         className="w-full group"
                         size="lg"
                       >
                         Start Free Trial
                         <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                       </Button>
                     </motion.div>
                   </motion.div>
                 ) : (
                   <motion.div
                     key={question.id}
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     className="space-y-5"
                   >
                     <div className="flex items-center gap-3">
                       <div className="p-2 rounded-lg bg-primary/10">
                         <question.icon className="h-5 w-5 text-primary" />
                       </div>
                       <h3 className="text-lg font-semibold">{question.question}</h3>
                     </div>
 
                     <div className="grid gap-2">
                       {question.options.map((option) => (
                         <motion.button
                           key={option.value}
                           onClick={() => handleAnswer(question.id, option.value)}
                           className="flex items-center gap-3 p-3 rounded-lg border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                           whileHover={{ scale: 1.02 }}
                           whileTap={{ scale: 0.98 }}
                         >
                           <span className="text-xl">{option.emoji}</span>
                           <span className="font-medium group-hover:text-primary transition-colors">{option.label}</span>
                         </motion.button>
                       ))}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </CardContent>
           </Card>
         </motion.div>
       </motion.div>
     </AnimatePresence>
   );
 };
 
 export default CollectionIntelligenceQuiz;