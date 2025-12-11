import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "How do AI collection agents work?",
    answer: "Our AI agents monitor your invoices and automatically send personalized follow-up emails based on aging buckets. Each agent has a different tone—from friendly reminders to firm escalations—ensuring appropriate communication at every stage of the collection process."
  },
  {
    question: "Can I customize the email templates?",
    answer: "Yes! While our AI generates effective messages automatically, you have full control to review, edit, and approve all communications before they're sent. You can also customize templates and tone preferences for each agent."
  },
  {
    question: "How quickly can I get started?",
    answer: "Most teams are up and running within 15 minutes. Simply upload your invoices or connect your billing system, and our AI agents will start working immediately. No complex setup or training required."
  },
  {
    question: "Is my data secure?",
    answer: "Absolutely. We use bank-level 256-bit encryption, are SOC 2 Type II compliant, and follow strict data privacy practices. Your financial data is never shared or used for any purpose other than your collection workflows."
  },
  {
    question: "What happens if I exceed my invoice limit?",
    answer: "Your collections continue without interruption. Any invoices beyond your plan limit are billed at $1.99 per invoice. You can also upgrade your plan anytime to get a better rate."
  },
  {
    question: "Do you integrate with my existing tools?",
    answer: "Yes! Recouply.ai integrates with popular billing systems, ERPs, and CRMs including QuickBooks, Stripe, Salesforce, NetSuite, and more. Our Enterprise plan includes custom integrations."
  },
];

const FAQAccordion = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-24 px-4 bg-background">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            FAQ
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about Recouply.ai
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-card rounded-xl border border-border/50 overflow-hidden transition-all duration-300 hover:border-primary/30"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left"
              >
                <span className="font-semibold pr-4">{faq.question}</span>
                <ChevronDown 
                  className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div 
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  openIndex === index ? "max-h-96" : "max-h-0"
                }`}
              >
                <div className="px-6 pb-5 text-muted-foreground">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQAccordion;
