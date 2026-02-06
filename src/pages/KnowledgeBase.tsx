import { useState } from "react";
import { ChevronDown, Search, Book, Zap, Users, Mail, CreditCard, Shield, BarChart3, HelpCircle, Bot, FileText, Building2, Sparkles } from "lucide-react";
import MarketingLayout from "@/components/MarketingLayout";
import SEO from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { knowledgeBaseData, FAQCategory as DataFAQCategory } from "@/lib/knowledgeBaseData";

interface FAQCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  faqs: { question: string; answer: string }[];
}

// Map icons to category IDs
const categoryIcons: Record<string, React.ReactNode> = {
  "getting-started": <Zap className="h-5 w-5" />,
  "ai-agents": <Bot className="h-5 w-5" />,
  "invoices-debtors": <FileText className="h-5 w-5" />,
  "outreach-workflows": <Mail className="h-5 w-5" />,
  "payment-plans": <CreditCard className="h-5 w-5" />,
  "inbound-communications": <HelpCircle className="h-5 w-5" />,
  "tasks": <BarChart3 className="h-5 w-5" />,
  "branding-emails": <Sparkles className="h-5 w-5" />,
  "team-collaboration": <Users className="h-5 w-5" />,
  "integrations": <Building2 className="h-5 w-5" />,
  "billing-plans": <CreditCard className="h-5 w-5" />,
  "security-privacy": <Shield className="h-5 w-5" />,
  "knowledge-help": <Book className="h-5 w-5" />
};

// Transform centralized data to include icons
const knowledgeBase: FAQCategory[] = knowledgeBaseData.map((category: DataFAQCategory) => ({
  id: category.id,
  title: category.title,
  icon: categoryIcons[category.id] || <HelpCircle className="h-5 w-5" />,
  description: category.description,
  faqs: category.faqs.map(faq => ({
    question: faq.question,
    answer: faq.answer
  }))
}));

 const KnowledgeBase = () => {
   const [searchQuery, setSearchQuery] = useState("");
   const [activeCategory, setActiveCategory] = useState<string | null>(null);
   const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());
 
   const toggleQuestion = (categoryId: string, questionIndex: number) => {
     const key = `${categoryId}-${questionIndex}`;
     setOpenQuestions(prev => {
       const newSet = new Set(prev);
       if (newSet.has(key)) {
         newSet.delete(key);
       } else {
         newSet.add(key);
       }
       return newSet;
     });
   };
 
   const filteredCategories = knowledgeBase.map(category => ({
     ...category,
     faqs: category.faqs.filter(faq =>
       faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
       faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
     )
   })).filter(category => category.faqs.length > 0);
 
   const totalResults = filteredCategories.reduce((sum, cat) => sum + cat.faqs.length, 0);
 
   return (
     <MarketingLayout>
       <SEO
         title="Knowledge Base & FAQ | Recouply.ai Help Center"
         description="Complete documentation for Recouply.ai - learn about AI collection agents, invoice management, payment plans, workflows, integrations, and more."
         canonical="https://recouply.ai/knowledge-base"
         keywords="Recouply help, FAQ, knowledge base, collection software documentation, AR automation guide"
       />
       
       {/* Hero Section */}
       <section className="py-16 px-4 bg-gradient-to-b from-primary/5 to-background">
         <div className="container mx-auto max-w-4xl text-center">
           <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
             <Book className="h-4 w-4" />
             Knowledge Base
           </div>
           <h1 className="text-4xl md:text-5xl font-bold mb-4">
             How can we help you?
           </h1>
           <p className="text-xl text-muted-foreground mb-8">
             Everything you need to know about using Recouply.ai for smarter collections
           </p>
           
           {/* Search Bar */}
           <div className="relative max-w-xl mx-auto">
             <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
             <Input
               type="text"
               placeholder="Search for answers..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="pl-12 pr-4 py-6 text-lg rounded-xl border-2 focus:border-primary"
             />
           </div>
           {searchQuery && (
             <p className="text-sm text-muted-foreground mt-3">
               Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{searchQuery}"
             </p>
           )}
         </div>
       </section>
 
       {/* Category Navigation */}
       <section className="py-8 px-4 border-b bg-muted/30">
         <div className="container mx-auto max-w-6xl">
           <div className="flex flex-wrap gap-2 justify-center">
             <button
               onClick={() => setActiveCategory(null)}
               className={cn(
                 "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                 activeCategory === null
                   ? "bg-primary text-primary-foreground"
                   : "bg-card border hover:bg-muted"
               )}
             >
               All Topics
             </button>
             {knowledgeBase.map(category => (
               <button
                 key={category.id}
                 onClick={() => setActiveCategory(category.id)}
                 className={cn(
                   "px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2",
                   activeCategory === category.id
                     ? "bg-primary text-primary-foreground"
                     : "bg-card border hover:bg-muted"
                 )}
               >
                 {category.icon}
                 {category.title}
               </button>
             ))}
           </div>
         </div>
       </section>
 
       {/* FAQ Content */}
       <section className="py-12 px-4">
         <div className="container mx-auto max-w-4xl">
           {filteredCategories
             .filter(category => !activeCategory || category.id === activeCategory)
             .map(category => (
               <div key={category.id} className="mb-12">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="bg-primary/10 p-3 rounded-lg text-primary">
                     {category.icon}
                   </div>
                   <div>
                     <h2 className="text-2xl font-bold">{category.title}</h2>
                     <p className="text-muted-foreground">{category.description}</p>
                   </div>
                 </div>
                 
                 <div className="space-y-3">
                   {category.faqs.map((faq, index) => {
                     const isOpen = openQuestions.has(`${category.id}-${index}`);
                     return (
                       <div
                         key={index}
                         className="bg-card rounded-xl border border-border/50 overflow-hidden transition-all duration-300 hover:border-primary/30"
                       >
                         <button
                           onClick={() => toggleQuestion(category.id, index)}
                           className="w-full px-6 py-5 flex items-center justify-between text-left"
                         >
                           <span className="font-semibold pr-4">{faq.question}</span>
                           <ChevronDown 
                             className={cn(
                               "h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform duration-300",
                               isOpen && "rotate-180"
                             )}
                           />
                         </button>
                         <div 
                           className={cn(
                             "overflow-hidden transition-all duration-300 ease-out",
                             isOpen ? "max-h-[500px]" : "max-h-0"
                           )}
                         >
                           <div className="px-6 pb-5 text-muted-foreground leading-relaxed">
                             {faq.answer}
                           </div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>
             ))}
           
           {filteredCategories.length === 0 && (
             <div className="text-center py-16">
               <HelpCircle className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
               <h3 className="text-xl font-semibold mb-2">No results found</h3>
               <p className="text-muted-foreground">
                 Try adjusting your search or browse all categories
               </p>
             </div>
           )}
         </div>
       </section>
 
       {/* Contact CTA */}
       <section className="py-16 px-4 bg-muted/30">
         <div className="container mx-auto max-w-2xl text-center">
           <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
           <p className="text-muted-foreground mb-6">
             Can't find what you're looking for? Our team is here to help.
           </p>
           <div className="flex gap-4 justify-center flex-wrap">
             <a
               href="/contact-us"
               className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
             >
               <Mail className="h-4 w-4" />
               Contact Support
             </a>
             <a
               href="https://calendly.com/sharad-recouply/30min"
               target="_blank"
               rel="noopener noreferrer"
               className="inline-flex items-center gap-2 px-6 py-3 bg-card border rounded-lg font-medium hover:bg-muted transition-colors"
             >
               Book a Demo
             </a>
           </div>
         </div>
       </section>
     </MarketingLayout>
   );
 };
 
 export default KnowledgeBase;