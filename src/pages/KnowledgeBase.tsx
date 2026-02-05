 import { useState } from "react";
 import { ChevronDown, Search, Book, Zap, Users, Mail, CreditCard, Shield, BarChart3, Settings, HelpCircle, Bot, FileText, Building2, Sparkles } from "lucide-react";
 import MarketingLayout from "@/components/MarketingLayout";
 import SEO from "@/components/SEO";
 import { Input } from "@/components/ui/input";
 import { cn } from "@/lib/utils";
 
 interface FAQItem {
   question: string;
   answer: string;
 }
 
 interface FAQCategory {
   id: string;
   title: string;
   icon: React.ReactNode;
   description: string;
   faqs: FAQItem[];
 }
 
 const knowledgeBase: FAQCategory[] = [
   {
     id: "getting-started",
     title: "Getting Started",
     icon: <Zap className="h-5 w-5" />,
     description: "Everything you need to begin using Recouply.ai",
     faqs: [
       {
         question: "How do I create an account?",
         answer: "Visit recouply.ai/signup to create your account. You'll need to provide your email, create a password, and verify your email address. Once verified, you can immediately start setting up your workspace and uploading invoices."
       },
       {
         question: "What information do I need to get started?",
         answer: "To get started, you'll need: 1) Your business name and contact details, 2) Your accounts receivable data (invoices) in CSV/Excel format or through Stripe integration, 3) Customer/debtor contact information including emails. You can start with as few as one invoice and scale from there."
       },
       {
         question: "How long does setup take?",
         answer: "Most teams are fully operational within 15-30 minutes. This includes: uploading your invoice data, configuring your branding settings, and reviewing your first AI-generated drafts. No technical expertise or complex integrations required."
       },
        {
          question: "Can I import data from my existing systems?",
          answer: "Yes! Recouply supports multiple import methods: 1) CSV/Excel upload for bulk invoice data, 2) Direct Stripe integration for automatic sync, 3) QuickBooks integration (limited - customer and invoice sync), 4) Manual entry for individual invoices."
        },
       {
         question: "Is there a free trial?",
         answer: "Yes, we offer a free trial with full access to all collection intelligence features. No credit card required to start. You can explore AI agents, upload invoices, and generate drafts before committing to a paid plan."
       }
     ]
   },
   {
     id: "ai-agents",
     title: "AI Collection Agents",
     icon: <Bot className="h-5 w-5" />,
     description: "Understanding your six specialized AI agents",
     faqs: [
       {
         question: "What are the six AI agents and what do they do?",
         answer: "Recouply uses six specialized AI agents, each designed for a specific aging bucket: 1) SAM (1-30 days) - Friendly payment reminders, 2) JAMES (31-60 days) - Professional follow-ups, 3) DIANA (61-90 days) - Firm but fair escalation, 4) MARCUS (91-120 days) - Urgent collection notices, 5) ELENA (120+ days) - Final resolution attempts, 6) RECOVERY - Settlement and payment plan negotiations."
       },
       {
         question: "How do AI agents determine the right tone for each message?",
         answer: "Agents analyze multiple signals: invoice age, payment history, customer value (from CRM data), previous response patterns, and account risk score. High-value customers receive more empathetic messaging, while consistently late payers may receive firmer communication."
       },
       {
         question: "Can I customize the AI agent personalities?",
         answer: "Yes! You can adjust tone preferences, escalation thresholds, and communication frequency for each agent through the AI Workflows settings. You can also create custom workflow steps with specific templates for each aging bucket."
       },
       {
         question: "Do AI agents send emails automatically?",
         answer: "By default, all AI-generated messages require your approval before sending (Human-in-the-Loop). You can enable 'Auto-Approve Outreach Drafts' in Branding settings if you want drafts to be sent automatically, but we recommend reviewing at least initially."
       },
       {
         question: "How do agents learn and improve over time?",
         answer: "Agents continuously learn from: email open/response rates, payment outcomes after outreach, customer feedback patterns, and dispute resolutions. This intelligence compounds with every interaction, improving recovery rates and timing recommendations."
       }
     ]
   },
   {
     id: "invoices-debtors",
     title: "Invoices & Accounts",
     icon: <FileText className="h-5 w-5" />,
     description: "Managing your accounts receivable data",
     faqs: [
       {
         question: "How do I upload invoices?",
         answer: "Navigate to Data Center or use the AR Upload page. You can: 1) Drag and drop CSV/Excel files with your invoice data, 2) Map columns to Recouply fields (invoice number, amount, due date, customer info), 3) Review and confirm before import. The system will automatically create debtors for new customers."
       },
       {
         question: "What invoice statuses are available?",
         answer: "Invoices can have the following statuses: Open (unpaid), Paid (fully collected), Partially Paid (partial payment received), Disputed (customer has raised an issue), Voided (cancelled), Write-Off (uncollectable). Status changes can be made manually or synced automatically via integrations."
       },
       {
         question: "How do I manage debtor/account information?",
         answer: "From the Debtors page, you can: view all accounts and their AR balance, click into any account for detailed history, add/edit contact information, view the Collection Intelligence Report for each account, and manage payment plans. Each account shows all associated invoices and communication history."
       },
       {
         question: "What is the Account Intelligence Report?",
         answer: "The Account Intelligence Report is an AI-generated analysis for each debtor showing: risk level scoring, payment behavior patterns, communication sentiment analysis, recommended collection strategies, and key insights. The report becomes more accurate as more interactions are recorded."
       },
       {
         question: "Can I bulk update invoice statuses?",
         answer: "Yes! From the Invoices page, you can select multiple invoices and perform bulk actions including status updates, adding notes, or assigning to workflows. You can also use the Reconciliation feature to mark invoices as paid based on payment data."
       }
     ]
   },
   {
     id: "outreach-workflows",
     title: "Outreach & Workflows",
     icon: <Mail className="h-5 w-5" />,
     description: "Automated collection communications",
     faqs: [
       {
         question: "How do AI Workflows work?",
         answer: "AI Workflows automate your collection cadence. Each workflow is tied to an aging bucket (1-30 days, 31-60 days, etc.) and contains steps that define: when to send (day offset), what channel (email/SMS), and the message template. When enabled, the system automatically generates drafts for invoices that match the criteria."
       },
       {
         question: "What is the Outreach Engine?",
         answer: "The Outreach Engine is the automated system that: 1) Cancels drafts for paid/voided invoices, 2) Generates new drafts for upcoming workflow steps (7-day window), 3) Sends approved drafts scheduled for today. You can run it manually from the AI Workflows page or let it run automatically."
       },
       {
         question: "How do I review and approve drafts?",
         answer: "Pending drafts appear on your Dashboard and Outreach page. Click any draft to: preview the full message, edit the subject or body, approve for sending, or discard. Approved drafts are queued for the next Outreach Engine run."
       },
       {
         question: "What is Account-Level Outreach?",
         answer: "Instead of sending invoice-specific messages, Account-Level Outreach sends consolidated communications at the debtor level. This uses the Collection Intelligence Report to dynamically inform message tone based on overall account health. Enable it from the debtor detail page."
       },
       {
         question: "Can I schedule outreach for specific times?",
         answer: "Drafts are generated with a recommended send date based on the workflow step's day offset. The Outreach Engine processes approved drafts daily. For more control, you can manually approve drafts on specific days or adjust workflow step timing."
       }
     ]
   },
   {
     id: "payment-plans",
     title: "Payment Plans",
     icon: <CreditCard className="h-5 w-5" />,
     description: "Setting up and managing payment arrangements",
     faqs: [
       {
         question: "How do payment plans work in Recouply?",
         answer: "Payment plans allow debtors to pay off their balance in installments. Plans are created at the account level (not per invoice) and support 2-12 installments with weekly, bi-weekly, or monthly frequency. Both the debtor and your team must approve the plan before it activates."
       },
       {
         question: "How do I create a payment plan?",
         answer: "From the debtor detail page: 1) Click 'Create Payment Plan', 2) Select which invoices to include, 3) Configure number of installments and frequency, 4) Preview the schedule, 5) Send to the debtor for approval. They'll receive a link to review and accept the terms."
       },
       {
         question: "What happens when a payment plan is active?",
         answer: "Active payment plans: 1) Flag included invoices as 'on payment plan', 2) Exclude those invoices from standard AI aging workflows, 3) Switch the account to account-level outreach, 4) Use payment plan intelligence to inform communications about processed and pending payments."
       },
       {
         question: "How do debtors approve and pay?",
         answer: "Debtors receive a tokenized portal link where they can: review the proposed payment schedule, accept or request modifications, make payments via Stripe (if configured), and track their remaining balance. You receive notifications when they interact with the portal."
       },
       {
         question: "Can I modify or cancel a payment plan?",
         answer: "Yes, from the debtor dashboard you can: edit pending plans before debtor approval, regenerate and resend portal links, mark plans as completed or cancelled. Cancelling a plan returns the included invoices to normal workflow processing."
       }
     ]
   },
   {
     id: "inbound-communications",
     title: "Inbound Communications",
     icon: <HelpCircle className="h-5 w-5" />,
     description: "Handling debtor responses and requests",
     faqs: [
       {
         question: "How does Recouply handle debtor email replies?",
         answer: "All debtor replies are captured via our inbound email system. The AI automatically: links emails to the correct debtor and invoice, summarizes the content, identifies the intent (dispute, payment plan request, W9 request, etc.), and creates actionable tasks for your team."
       },
       {
         question: "What is the Inbound Command Center?",
         answer: "The Inbound Command Center is your hub for managing all debtor responses. It shows: incoming emails with AI-generated summaries, extracted action items, suggested responses, and one-click actions like sending invoice copies, W9 forms, or portal links."
       },
       {
         question: "What types of requests does the AI detect?",
         answer: "The AI identifies common request types: W9/tax document requests, payment plan inquiries, invoice copy requests, dispute notifications, promise-to-pay commitments, address/contact updates, and general questions. Each creates a typed task with recommended actions."
       },
       {
         question: "How do I respond to inbound requests?",
         answer: "From any inbound task, you can: view the AI-suggested response, edit as needed, optionally include invoice PDFs or W9 documents, and send directly from Recouply. Responses are logged to the collection activity timeline for the account."
       },
       {
         question: "Can I set up auto-responses?",
         answer: "Currently, all inbound communications create tasks for human review. We recommend reviewing responses to maintain relationship quality. However, the AI pre-drafts responses that you can quickly approve and send with minimal editing."
       }
     ]
   },
   {
     id: "tasks",
     title: "Tasks & Collection Activities",
     icon: <BarChart3 className="h-5 w-5" />,
     description: "Tracking and managing collection work",
     faqs: [
       {
         question: "What are Collection Tasks?",
         answer: "Collection Tasks are actionable items generated by the system or created manually. Types include: inbound email responses, follow-up reminders, dispute resolutions, payment plan follow-ups, and escalation reviews. Tasks have priority levels (low, medium, high, critical) and due dates."
       },
       {
         question: "How are tasks prioritized?",
         answer: "Tasks are prioritized based on: invoice amount, days past due, account risk score, and request urgency. Critical tasks (disputes on large invoices, urgent requests) appear prominently on your Dashboard and in the Daily Digest email."
       },
       {
         question: "Can I assign tasks to team members?",
         answer: "Yes! If you have team members (Growth plan and above), you can assign tasks to specific users. Assigned team members receive email notifications and the task appears in their personal task list. Task ownership can be transferred at any time."
       },
       {
         question: "How do I track collection activities?",
         answer: "Every action is logged to the Collection Activities timeline: emails sent, payments received, status changes, notes added, and tasks completed. View the full timeline from any debtor detail page or export activity logs for compliance/audit purposes."
       },
       {
         question: "What is the Daily Digest?",
         answer: "The Daily Digest is an automated email report summarizing: total AR outstanding by aging bucket, payments collected, high-priority tasks requiring attention, portfolio risk metrics, and AI insights. Configure delivery preferences in your Profile settings."
       }
     ]
   },
   {
     id: "branding-emails",
     title: "Branding & Email Settings",
     icon: <Sparkles className="h-5 w-5" />,
     description: "Customizing your communications",
     faqs: [
       {
         question: "How do I set up my business branding?",
         answer: "Go to Settings > Branding to configure: business name, logo, primary/accent colors, email signature, and footer text. These settings are applied to all AI-generated emails, ensuring consistent brand presentation across all collection communications."
       },
       {
         question: "Can I use my own email domain?",
         answer: "Yes! You can configure a custom 'From' email address. Enter your preferred email in Branding settings, and we'll guide you through domain verification. Once verified, all outgoing emails will appear from your domain rather than recouply.ai."
       },
       {
         question: "What email formats are available?",
         answer: "Recouply offers two formats: 1) Simple - clean, text-focused emails without heavy styling, 2) Enhanced - branded emails with your logo, colors, and formatted layout. Choose based on your preference and what works best with your customers."
       },
       {
         question: "How do I add payment links to emails?",
         answer: "Add your Stripe payment link in Branding settings. AI-generated emails will automatically include a prominent 'Pay Now' button linking to your Stripe checkout. Payments go directly to your Stripe account—Recouply never handles your funds."
       },
       {
         question: "Can I include escalation contact information?",
         answer: "Yes, configure escalation contacts in Branding settings (name, email, phone). For higher aging buckets, AI agents can reference your escalation contact when appropriate, giving debtors a direct line to resolve complex issues."
       }
     ]
   },
   {
     id: "team-collaboration",
     title: "Team & Collaboration",
     icon: <Users className="h-5 w-5" />,
     description: "Working together on collections",
     faqs: [
       {
         question: "How do I invite team members?",
         answer: "Navigate to Team page to invite colleagues. Enter their email address and select a role (Admin, Member, or Viewer). They'll receive an invitation email with a link to join your workspace. Pending invites can be resent or cancelled."
       },
       {
         question: "What are the different team roles?",
         answer: "Three roles are available: 1) Owner - full access including billing and team management, 2) Admin - can manage invoices, workflows, and settings but not billing, 3) Member - can work with invoices and tasks but cannot change settings, 4) Viewer - read-only access to data."
       },
       {
         question: "How does billing work for team members?",
         answer: "Team seats are included based on your plan (Starter: 1 seat, Growth: 3 seats, Enterprise: unlimited). Additional seats beyond your plan limit are billed at the per-seat rate. Seats are pro-rated when added mid-billing cycle."
       },
       {
         question: "Can team members see all data?",
         answer: "Yes, team members in the same workspace share access to all invoices, debtors, and activities. For organizations needing data separation, contact us about multi-workspace configurations (Enterprise plan)."
       },
       {
         question: "How do I remove a team member?",
         answer: "From the Team page, click on the member you want to remove and select 'Remove from team'. Their access is revoked immediately. Any tasks assigned to them should be reassigned before removal."
       }
     ]
   },
   {
     id: "integrations",
     title: "Integrations",
     icon: <Building2 className="h-5 w-5" />,
     description: "Connecting your tools",
     faqs: [
        {
          question: "What integrations are available?",
          answer: "Currently available: Stripe (for payment sync and invoice import) and QuickBooks (limited - customer and invoice sync). CRM integrations (Salesforce, HubSpot) are available exclusively for Enterprise Custom plans. Check the Integrations page for the latest availability."
        },
        {
          question: "How does Stripe integration work?",
          answer: "Connect your Stripe account from the Integrations page. Recouply will: import open invoices from Stripe, sync payment status automatically, and optionally embed your Stripe payment links in collection emails. You can configure sync frequency and which invoices to include."
        },
        {
          question: "How does QuickBooks integration work?",
          answer: "Connect your QuickBooks account via OAuth from the Integrations page. Recouply will sync customers and invoices from QuickBooks. Note: QuickBooks integration is currently limited to customer and invoice data sync. Payment reconciliation features are coming soon."
        },
        {
          question: "Will synced payments update invoice status?",
          answer: "Yes! When a payment is recorded in Stripe, Recouply automatically updates the corresponding invoice status. Paid invoices are excluded from future collection workflows. Use the Reconciliation page to review and confirm payment matches."
        },
        {
          question: "Can I disconnect an integration?",
          answer: "Yes, you can disconnect any integration from the Integrations page. Disconnecting stops future syncs but preserves data already imported. To remove imported data, you'll need to delete those records manually."
        },
        {
          question: "Are CRM integrations available?",
          answer: "CRM integrations (Salesforce, HubSpot, and other customer relationship management platforms) are available exclusively for Enterprise Custom plans. These integrations enable AI agents to use customer relationship context for more personalized collection communications. Contact us to discuss Enterprise options."
        }
      ]
    },
   {
     id: "billing-plans",
     title: "Billing & Plans",
     icon: <CreditCard className="h-5 w-5" />,
     description: "Subscription and payment information",
      faqs: [
        {
          question: "What plans are available?",
          answer: "Recouply offers plans for every size: 1) Solo Pro ($49/mo) - 25 invoices, perfect for independent operators and sole proprietors, 2) Starter - up to 100 invoices/month, 1 user, 3) Growth - up to 300 invoices/month, 3 users, priority support, 4) Professional - up to 500 invoices/month, 5) Enterprise Custom - unlimited invoices and users, CRM integrations, dedicated support. All features are available on every plan—you only pay based on invoice volume and team size."
        },
        {
          question: "Do all plans include the same features?",
          answer: "Yes! All Recouply plans include full access to all features: all six AI collection agents (SAM, JAMES, DIANA, MARCUS, ELENA, RECOVERY), AI workflows, payment plans, inbound communications, branding customization, Stripe integration, QuickBooks integration, and analytics. The only differences are invoice capacity, team seats, and overage rates. CRM integrations (Salesforce, HubSpot) are exclusive to Enterprise Custom plans."
        },
        {
          question: "What is the Solo Pro plan?",
          answer: "Solo Pro is designed for independent operators, consultants, and sole proprietors who need full collection intelligence power without enterprise pricing. At $49/month, you get 25 active invoices, all AI agents, all features, and the same powerful automation as larger plans. Additional invoices are billed at $1.99 each."
        },
        {
          question: "What happens if I exceed my invoice limit?",
          answer: "Collections continue uninterrupted. Invoices beyond your plan limit are billed at overage rates ($1.49-$1.99 per invoice depending on plan). You can upgrade anytime to get a better per-invoice rate and avoid overages."
        },
        {
          question: "How do I upgrade or downgrade my plan?",
          answer: "Go to Settings > Billing to view your current plan and upgrade options. Upgrades take effect immediately with pro-rated billing. Downgrades take effect at the next billing cycle. Contact support if you need assistance with plan changes."
        },
        {
          question: "What payment methods are accepted?",
          answer: "We accept all major credit cards (Visa, Mastercard, American Express) via Stripe. Enterprise customers can request invoice billing with NET-30 terms. All payments are processed securely—we never store your card details."
        },
        {
          question: "Can I cancel my subscription?",
          answer: "Yes, you can cancel anytime from the Billing page. Cancellation takes effect at the end of your current billing period. Your data is retained for 30 days after cancellation, during which you can reactivate or export your data."
        }
      ]
    },
   {
     id: "security-privacy",
     title: "Security & Privacy",
     icon: <Shield className="h-5 w-5" />,
     description: "Keeping your data safe",
     faqs: [
       {
         question: "How is my data protected?",
         answer: "We use bank-level security: 256-bit TLS encryption in transit, AES-256 encryption at rest, SOC 2 Type II compliance, regular security audits, and strict access controls. Your financial data is isolated per workspace with row-level security."
       },
       {
         question: "Do you share or sell customer data?",
         answer: "Never. Your data is used solely for providing Recouply services to you. We do not share, sell, or use your data for any other purpose. See our Privacy Policy for complete details on data handling practices."
       },
       {
         question: "Can I export my data?",
         answer: "Yes, you can export your data at any time. From Settings, you can download invoices, debtors, and activity logs in CSV format. Enterprise customers have access to API exports and database snapshots."
       },
       {
         question: "How do you handle GDPR compliance?",
         answer: "Recouply is GDPR-compliant. We support: data subject access requests, right to deletion, data portability, and processing agreements. Contact support@recouply.ai for data requests or to sign a DPA."
       },
       {
         question: "What access controls are available?",
         answer: "Workspace security features include: role-based access control (Owner, Admin, Member, Viewer), email verification requirements, session management, and audit logs for all actions. Enterprise plans add SSO and IP whitelisting options."
       }
     ]
   }
 ];
 
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