import TrustPolicyPage from "./TrustPolicyPage";

const Subprocessors = () => (
  <TrustPolicyPage
    title="Subprocessors"
    metaDescription="Recouply.ai's list of subprocessors — the vendors that may process Customer personal data to deliver the platform, along with their purpose and hosting region."
    canonicalPath="/trust/subprocessors"
    lastUpdated="July 2026"
    intro="Recouply.ai (RecouplyAI Inc.) uses the subprocessors below to deliver the platform. Each is bound by written data protection terms substantially equivalent to our DPA. To be notified of changes to this list, email legal@recouply.ai."
    sections={[
      { title: "Infrastructure & Hosting", bullets: [
        "Supabase / AWS — primary application database, authentication, edge functions, and object storage. Region: US.",
        "Cloudflare — DNS, CDN, WAF, and DDoS protection. Region: global edge.",
        "Vercel / Lovable hosting — static asset and preview delivery. Region: global edge.",
      ]},
      { title: "AI & Document Processing", bullets: [
        "Google (Gemini API) — powers contract extraction, ASC 606 assessment, and outreach generation. Region: US.",
        "OpenAI / Anthropic (fallback where enabled) — auxiliary model routing via the Lovable AI Gateway. Region: US.",
        "Zero-retention terms are in place with model providers where offered.",
      ]},
      { title: "Communications", bullets: [
        "Resend — transactional and outbound collections email delivery, plus inbound email webhooks. Region: US.",
        "Twilio (where enabled) — SMS/voice channels for outreach. Region: US.",
      ]},
      { title: "Payments & Billing", bullets: [
        "Stripe — subscription billing, payment method storage, and debtor payment collection. Region: US.",
        "Recouply.ai does not store cardholder data directly; Stripe is the PCI-DSS Level 1 processor of record.",
      ]},
      { title: "Customer-Enabled Integrations", bullets: [
        "QuickBooks Online, NetSuite, Sage Intacct — accounting/ERP sync (enabled per Customer).",
        "Salesforce, HubSpot — CRM context sync (enabled per Customer).",
        "Google Drive, Google Sheets — document and worksheet sync (enabled per Customer).",
        "These integrations are activated only when Customer connects them; access is scoped to the connecting user.",
      ]},
      { title: "Operations & Support", bullets: [
        "Sentry / analytics providers — error monitoring and product analytics. PII scrubbing enabled where applicable.",
        "Google Workspace — internal email, docs, and support ticketing.",
      ]},
      { title: "Change Notifications", bullets: [
        "Material additions or replacements are announced on this page at least 30 days before they take effect, where feasible.",
        "Customers with a signed DPA may object to a new subprocessor on reasonable data protection grounds.",
      ]},
    ]}
  />
);

export default Subprocessors;
