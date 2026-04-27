// Pool of LinkedIn share messages for Recouply.ai referrals.
// LinkedIn's share URL only supports text — link previews (OG image)
// come from meta tags on the destination page, not the share URL itself.
// To convey "agents", each message is signed by one of the AI agents.

export type ShareAgent = {
  name: string;
  emoji: string; // visual stand-in for the agent avatar inside the post text
  role: string;
};

export const SHARE_AGENTS: ShareAgent[] = [
  { name: "James", emoji: "🧑‍💼", role: "Collections Strategist" },
  { name: "Katy", emoji: "👩‍💻", role: "AR Automation Lead" },
  { name: "Sam", emoji: "🧑‍🚀", role: "Risk Intelligence Agent" },
  { name: "Troy", emoji: "🧑‍🔧", role: "Stripe Integration Agent" },
  { name: "Nicolas", emoji: "🧑‍🏫", role: "Collections Advisor" },
];

const signature = (agent: ShareAgent) =>
  `\n\n— Shared by ${agent.emoji} ${agent.name}, your ${agent.role} on Recouply.ai`;

const HASHTAGS = "#AccountsReceivable #Stripe #Fintech #AI #CashFlow #Collections";

type Builder = (link: string, agent: ShareAgent) => string;

const TEMPLATES: Builder[] = [
  // 1 — Set it and forget it (original, refined)
  (link, a) => `💸 Stripe + Recouply.ai = set it and forget it collections.

Invoices go out automatically — but chasing the unpaid ones still eats your week.

Recouply.ai plugs into Stripe and:
✅ Auto-syncs every invoice & payment in real time
✅ Sends AI-powered, on-brand follow-ups
✅ Scores customer credit & payment risk before it hurts cash flow
✅ Gives clients a one-click secure payment portal

💼 Pricing built for everyone — solo operators to enterprise finance teams.

Try it 👇
${link}${signature(a)}

(We both earn bonus credits when you sign up 🚀) ${HASHTAGS}`,

  // 2 — Stop chasing invoices
  (link, a) => `Stop chasing invoices. Start closing them. ⚡

I switched our AR over to Recouply.ai and it's wild — every Stripe invoice is auto-followed-up by an AI agent that sounds like us, not a bot.

→ Real-time Stripe sync
→ AI follow-ups in your brand voice
→ Customer risk scores before they default
→ Built for solos, teams, and finance departments alike

If you live in Stripe, this is a no-brainer.
${link}${signature(a)}

${HASHTAGS}`,

  // 3 — Cash flow story
  (link, a) => `Cash flow tip from someone who learned the hard way 👇

Your invoices aren't your problem. Your follow-ups are.

Recouply.ai is a Collections & Risk Intelligence Platform that sits on top of Stripe and runs the chase for you — politely, on-brand, and 24/7.

Plans scale from solo founders to enterprise AR teams.

${link}${signature(a)}

${HASHTAGS}`,

  // 4 — Numbers focused
  (link, a) => `Most B2B businesses lose 1–3% of revenue to slow payments. 📉

Recouply.ai gets it back — automatically.

🔌 Native Stripe integration
🤖 AI-written follow-ups that match your tone
📊 Real-time credit & risk scoring per customer
💳 Branded payment portal so clients pay in one click

From solo operator to enterprise finance team — there's a plan that fits.

${link}${signature(a)}

${HASHTAGS}`,

  // 5 — Founder voice
  (link, a) => `Honest take: collections used to be the worst part of my week. 😮‍💨

Then I plugged Stripe into Recouply.ai. Now an AI agent sends the reminders, flags risky customers before they ghost, and gives clients a clean portal to pay.

I literally don't think about AR anymore.

If you bill on Stripe, try it 👇
${link}${signature(a)}

${HASHTAGS}`,

  // 6 — For solo operators
  (link, a) => `Solo founders & freelancers — this one's for you. 🎯

You shouldn't need a finance team to get paid on time.

Recouply.ai gives you one:
✅ Auto-syncs Stripe invoices
✅ AI follow-ups in your voice
✅ Risk scores so you know who to watch
✅ Plans starting at solo-operator pricing

${link}${signature(a)}

${HASHTAGS}`,

  // 7 — Enterprise angle
  (link, a) => `For finance leaders running B2B AR at scale 📈

Recouply.ai brings collections, risk intelligence, and a debtor-facing payment portal into one platform — natively integrated with Stripe.

→ Multi-currency, multi-entity ready
→ ASC 326 / IFRS 9 simplified ECL signals
→ Team roles, audit trails, SSO
→ Enterprise pricing with custom integrations

${link}${signature(a)}

${HASHTAGS}`,

  // 8 — Risk intelligence focus
  (link, a) => `Collections is a lagging indicator. Risk is a leading one. 🧠

Recouply.ai scores every customer's payment risk in real time — using engagement signals, payment history, and Stripe activity — so you stop bad debt before it shows up on your aging report.

Plus on-brand AI follow-ups, a customer payment portal, and pricing for every team size.

${link}${signature(a)}

${HASHTAGS}`,

  // 9 — Direct & punchy
  (link, a) => `Your Stripe dashboard tells you what was paid.
Recouply.ai tells you what *will* be paid — and chases what won't. ⚡

✅ AI follow-ups
✅ Risk scoring
✅ Payment portal
✅ Pricing for solos → enterprise

${link}${signature(a)}

${HASHTAGS}`,

  // 10 — Time saved
  (link, a) => `What I gave back to my week after switching to Recouply.ai: ⏱️

→ ~5 hrs of invoice chasing
→ ~2 hrs of "did they pay?" Slack threads
→ Most of the anxiety around month-end

Native Stripe sync. AI follow-ups. Customer risk scores. One-click payment portal. That's it.

${link}${signature(a)}

${HASHTAGS}`,

  // 11 — Stripe-native pitch
  (link, a) => `If you bill on Stripe, you're already 80% of the way to fully automated AR. 🔌

Recouply.ai is the missing 20%:
✅ Real-time invoice & payment sync
✅ AI-written, on-brand follow-ups
✅ Customer credit & risk intelligence
✅ Branded one-click payment portal

Pricing scales from solo operator → enterprise finance team.

${link}${signature(a)}

${HASHTAGS}`,

  // 12 — Conversational
  (link, a) => `Genuine recommendation if you run on Stripe and hate chasing invoices 👇

Recouply.ai is a Collections & Risk Intelligence Platform that does the chasing *for* you — in your tone, on schedule, with risk scoring built in. Customers pay through a clean branded portal.

Solo plan to enterprise. Truly set it and forget it AR.

${link}${signature(a)}

(We both earn bonus credits when you sign up 🚀) ${HASHTAGS}`,
];

export function buildRandomShareText(link: string): { text: string; agent: ShareAgent } {
  const agent = SHARE_AGENTS[Math.floor(Math.random() * SHARE_AGENTS.length)];
  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  return { text: template(link, agent), agent };
}

export function buildLinkedInShareUrl(link: string): string {
  const { text } = buildRandomShareText(link);
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}
