// Pre-drafted founder messaging templates with Recouply.ai branding
import { founderConfig } from "./founderConfig";

export interface FounderMessage {
  id: string;
  category: "welcome" | "re-engagement" | "announcement";
  title: string;
  subject?: string;
  body: string;
  tone: "warm" | "professional" | "urgent";
  targetAudience?: string;
  daysInactiveMin?: number;
  daysInactiveMax?: number;
}

export const founderAnnouncements: FounderMessage[] = [
  {
    id: "ann-platform-update",
    category: "announcement",
    title: "Platform Update — New AI Agents",
    body: `Hi there 👋\n\nI'm ${founderConfig.name}, founder of ${founderConfig.company}. I wanted to personally let you know about some exciting updates we've shipped:\n\n• Smarter AI-powered draft generation with tone controls\n• Enhanced risk scoring for your accounts\n• Improved daily digest with actionable insights\n\nThese features are designed to help you collect smarter, not harder. If you haven't explored them yet, head to your AI Workflows page to see them in action.\n\nAs always, I read every response — hit reply if you have questions.\n\n— ${founderConfig.name}`,
    tone: "warm",
  },
  {
    id: "ann-collection-tips",
    category: "announcement",
    title: "Collection Intelligence Tips from the Founder",
    body: `Quick tips from ${founderConfig.name}:\n\n1. Import your aging report to get instant risk scoring\n2. Let AI agents handle follow-ups — they never forget\n3. Review your Collection Health Score daily\n4. Use the Payment Portal link in outreach for faster payments\n\nRemember: ${founderConfig.tagline}`,
    tone: "professional",
  },
  {
    id: "ann-milestone",
    category: "announcement",
    title: "🎉 A Note from Our Founder",
    body: `Hi! ${founderConfig.name} here.\n\nI wanted to take a moment to thank you for being part of the ${founderConfig.company} community. We're building something special — a platform where enterprise-grade collection intelligence meets startup speed.\n\nYour feedback shapes our roadmap. Don't hesitate to reach out at ${founderConfig.email}.\n\nLet's keep collecting intelligently. 🚀`,
    tone: "warm",
  },
];

export const reEngagementTemplates: FounderMessage[] = [
  {
    id: "re-gentle-3day",
    category: "re-engagement",
    title: "Gentle Check-In (3-7 days)",
    subject: "Quick question — did you get a chance to explore Recouply?",
    body: `Hi {{name}},\n\nIt's ${founderConfig.name} from ${founderConfig.company}. I noticed you signed up recently but haven't had a chance to upload your first invoices yet.\n\nI totally get it — getting started with a new tool takes time. Here's the quickest way to see value:\n\n1. Upload an aging report (CSV or Excel) → takes 30 seconds\n2. Watch our AI agents automatically categorize and prioritize\n3. Review your first Collection Health Score\n\nNeed help getting started? Reply to this email and I'll personally walk you through it.\n\nBest,\n${founderConfig.name}\nFounder, ${founderConfig.company}`,
    tone: "warm",
    targetAudience: "Signed up, never uploaded data",
    daysInactiveMin: 3,
    daysInactiveMax: 7,
  },
  {
    id: "re-value-14day",
    category: "re-engagement",
    title: "Value Proposition (7-14 days)",
    subject: "Your collections could be running on autopilot — here's how",
    body: `Hi {{name}},\n\n${founderConfig.name} here, founder of ${founderConfig.company}.\n\nI wanted to share what our most successful users do in their first week:\n\n✅ Upload their AR aging report\n✅ Let AI agents draft personalized collection messages\n✅ Set up automated workflows by aging bucket\n✅ Monitor their Collection Health Score daily\n\nThe result? Faster payments, fewer manual follow-ups, and complete visibility into collection performance.\n\nI built ${founderConfig.company} after ${founderConfig.yearsExperience} years in Revenue Operations because I saw teams drowning in manual collection processes. We can do better.\n\nWant a quick walkthrough? Book 15 minutes with me: ${founderConfig.calendly}\n\nBest,\n${founderConfig.name}`,
    tone: "professional",
    targetAudience: "Signed up, minimal or no engagement",
    daysInactiveMin: 7,
    daysInactiveMax: 14,
  },
  {
    id: "re-personal-30day",
    category: "re-engagement",
    title: "Personal Outreach (14-30 days)",
    subject: `${founderConfig.name} here — can I help you get started?`,
    body: `Hi {{name}},\n\nThis is ${founderConfig.name}, the founder of ${founderConfig.company}. I'm reaching out personally because I noticed your account has been inactive.\n\nI'd love to understand what's holding you back. Common reasons I hear:\n\n• "I'm not sure how to get my data in" → We support CSV, Excel, and direct imports\n• "I need to evaluate it more" → Happy to do a live demo tailored to your needs\n• "I got busy" → Totally understand! Your account is ready whenever you are\n\nIf ${founderConfig.company} isn't the right fit, I'd genuinely like to know why — your feedback helps us build a better product.\n\nBook a quick chat: ${founderConfig.calendly}\nOr reply to this email — I read every response.\n\nWarmly,\n${founderConfig.name}\nFounder, ${founderConfig.company}\n"${founderConfig.tagline}"`,
    tone: "warm",
    targetAudience: "Signed up, completely inactive",
    daysInactiveMin: 14,
    daysInactiveMax: 30,
  },
  {
    id: "re-last-chance-60day",
    category: "re-engagement",
    title: "Last Chance (30-60 days)",
    subject: "Should I close your Recouply account?",
    body: `Hi {{name}},\n\nIt's been a while since you signed up for ${founderConfig.company}, and I wanted to check in one last time.\n\nI don't want to keep emailing you if you're not interested — but before I stop, I wanted to make sure you know what you're leaving on the table:\n\n🤖 Six AI collection agents working 24/7\n📊 Real-time Collection Health scoring\n📧 Automated, branded outreach that preserves customer relationships\n💰 Faster cash flow with intelligent prioritization\n\nIf you'd like to give it another shot, your account is ready to go. Just log in and upload your first aging report.\n\nIf not, no hard feelings — I appreciate you checking us out.\n\nAll the best,\n${founderConfig.name}\nFounder, ${founderConfig.company}`,
    tone: "professional",
    targetAudience: "Long-term inactive, final outreach",
    daysInactiveMin: 30,
    daysInactiveMax: 60,
  },
  {
    id: "re-winback-90day",
    category: "re-engagement",
    title: "Win-Back (60-90+ days)",
    subject: "A lot has changed at Recouply — worth another look?",
    body: `Hi {{name}},\n\nIt's ${founderConfig.name} from ${founderConfig.company}. It's been a while!\n\nSince you last visited, we've made some major improvements:\n\n🆕 Enhanced AI draft generation with tone controls\n🆕 Account-level outreach intelligence\n🆕 Payment portal for faster debtor payments\n🆕 Daily Collection Health Digest\n🆕 Advanced risk scoring and campaign management\n\nIf managing receivables is still a challenge for your team, I'd love for you to see what's new.\n\n→ Log back in: https://recouply.ai/dashboard\n→ Or book a quick demo: ${founderConfig.calendly}\n\nHope to see you back!\n\n${founderConfig.name}\nFounder, ${founderConfig.company}`,
    tone: "warm",
    targetAudience: "Very long-term inactive, win-back attempt",
    daysInactiveMin: 60,
    daysInactiveMax: undefined,
  },
];

// Helper to hydrate template placeholders
export const hydrateTemplate = (
  template: string,
  variables: Record<string, string>
): string => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "gi"), value);
  }
  // Replace remaining placeholders with fallbacks
  result = result.replace(/\{\{name\}\}/gi, "there");
  return result;
};
