 import { Button } from "@/components/ui/button";
 import { useNavigate, Link } from "react-router-dom";
 import { RecouplyLogo } from "@/components/RecouplyLogo";
 import { Brain, Linkedin, ShieldCheck, ClipboardCheck } from "lucide-react";
 
 const COMPANY_INFO = {
   legalName: "RecouplyAI Inc.",
   displayName: "Recouply.ai",
   tagline: "Collection Intelligence Platform",
   social: {
     linkedin: "https://www.linkedin.com/company/recouplyai-inc",
   },
 } as const;
 
 const MarketingFooter = () => {
   const navigate = useNavigate();
 
   return (
     <footer className="border-t py-12 px-4 bg-card mt-auto">
       <div className="container mx-auto">
         <div className="grid md:grid-cols-4 gap-8 mb-8">
           <div>
             <div className="mb-4">
               <RecouplyLogo size="lg" />
             </div>
             <p className="text-sm text-muted-foreground mb-4">
               {COMPANY_INFO.tagline}
             </p>
             <p className="text-xs text-muted-foreground mb-4">
               AI-powered software. Not a collection agency.
             </p>
             <a 
               href={COMPANY_INFO.social.linkedin}
               target="_blank"
               rel="noopener noreferrer"
               className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
             >
               <Linkedin className="h-5 w-5" />
               <span className="text-sm">Follow us</span>
             </a>
           </div>
           <div>
             <h4 className="font-semibold mb-4">Platform</h4>
             <ul className="space-y-2 text-sm">
               <li>
                 <button 
                   onClick={() => navigate("/collection-intelligence")}
                   className="text-muted-foreground hover:text-primary flex items-center gap-1"
                 >
                   <Brain className="h-3 w-3" />
                   Collection Intelligence
                 </button>
               </li>
               <li>
                 <button 
                   onClick={() => navigate("/personas")}
                   className="text-muted-foreground hover:text-primary"
                 >
                   AI Agents
                 </button>
               </li>
               <li>
                 <button 
                   onClick={() => navigate("/features")}
                   className="text-muted-foreground hover:text-primary"
                 >
                   Features
                 </button>
               </li>
               <li>
                 <button 
                   onClick={() => navigate("/pricing")}
                   className="text-muted-foreground hover:text-primary"
                 >
                   Pricing
                 </button>
               </li>
             </ul>
           </div>
           <div>
             <h4 className="font-semibold mb-4">Company</h4>
             <ul className="space-y-2 text-sm">
               <li>
                 <button 
                   onClick={() => navigate("/about")}
                   className="text-muted-foreground hover:text-primary"
                 >
                   About Us
                 </button>
               </li>
               <li>
                 <button 
                   onClick={() => navigate("/blog")}
                   className="text-muted-foreground hover:text-primary"
                 >
                   Blog
                 </button>
               </li>
               <li>
                 <button 
                   onClick={() => navigate("/investors")}
                   className="text-muted-foreground hover:text-primary"
                 >
                   Investors
                 </button>
               </li>
               <li>
                 <button 
                   onClick={() => navigate("/design-partners")}
                   className="text-muted-foreground hover:text-primary"
                 >
                   Design Partners
                 </button>
               </li>
               <li>
                 <button 
                   onClick={() => navigate("/careers")}
                   className="text-muted-foreground hover:text-primary"
                 >
                   Careers
                 </button>
               </li>
               <li>
                 <Link 
                   to="/legal/terms"
                   className="text-muted-foreground hover:text-primary"
                 >
                   Terms of Service
                 </Link>
               </li>
               <li>
                 <Link 
                   to="/legal/privacy"
                   className="text-muted-foreground hover:text-primary"
                 >
                   Privacy Policy
                 </Link>
               </li>
                <li>
                  <button 
                    onClick={() => navigate("/security-public")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Security
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/knowledge-base")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Knowledge Base
                  </button>
                </li>
              </ul>
            </div>
           <div>
            <h4 className="font-semibold mb-4">Contact</h4>
             <ul className="space-y-2 text-sm mb-4">
                <li>
                  <button 
                    onClick={() => navigate("/contact")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Contact Us
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/contact?intent=demo")}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Request a Demo
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate("/collections-assessment")}
                    className="text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <ClipboardCheck className="h-3 w-3" />
                    Free Assessment
                  </button>
                </li>
              </ul>
             <Button 
               onClick={() => navigate("/signup")}
               className="w-full"
             >
               Start Collecting
             </Button>
           </div>
         </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} {COMPANY_INFO.legalName} All rights reserved.
            </p>
 
           <div className="flex items-center gap-4">
             <nav aria-label="Legal" className="flex items-center gap-3 text-sm">
               <Link to="/legal/privacy" className="text-muted-foreground hover:text-primary">
                 Privacy
               </Link>
               <span className="text-muted-foreground/40">•</span>
               <Link to="/legal/terms" className="text-muted-foreground hover:text-primary">
                 Terms
               </Link>
               <span className="text-muted-foreground/40">•</span>
               <Link to="/legal/cookies" className="text-muted-foreground hover:text-primary">
                 Cookies
               </Link>
             </nav>
 
             <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
               <ShieldCheck className="h-3.5 w-3.5 text-primary" />
               <span className="text-xs font-medium text-primary">Responsible AI</span>
             </div>
           </div>
         </div>
       </div>
     </footer>
   );
 };
 
 export default MarketingFooter;