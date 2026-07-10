import TrustPolicyPage from "./TrustPolicyPage";

const DPA = () => (
  <TrustPolicyPage
    title="Data Processing Addendum (DPA)"
    metaDescription="Recouply.ai's Data Processing Addendum (DPA) — GDPR Article 28 terms covering roles, subprocessors, security measures, data subject rights, and international transfers."
    canonicalPath="/trust/dpa"
    lastUpdated="July 2026"
    intro="This Data Processing Addendum (DPA) supplements the Recouply.ai Terms of Service and governs Recouply.ai's processing of personal data on behalf of Customer, including for purposes of the EU/UK GDPR and comparable global privacy laws. A countersigned copy is available on request — email legal@recouply.ai."
    sections={[
      { title: "Roles & Scope", bullets: [
        "Customer is the Controller (or Processor acting on behalf of its own Controller); Recouply.ai (RecouplyAI Inc.) is the Processor.",
        "Recouply.ai processes personal data solely to deliver the Recouply.ai platform (contract intelligence, collections intelligence, and related services) as instructed by Customer.",
        "This DPA applies to all personal data Customer submits to the platform, including debtor contacts, invoice metadata, and communications.",
      ]},
      { title: "Nature & Purpose of Processing", bullets: [
        "Categories of data subjects: Customer's employees, Customer's debtors and their contacts, and end users of the platform.",
        "Categories of personal data: name, business email, phone, role, company, invoice/payment history, communication logs, and account credentials.",
        "Duration: for the term of the subscription plus the retention window defined in the Retention & Deletion policy.",
      ]},
      { title: "Subprocessors", bullets: [
        "Customer authorizes Recouply.ai's use of the subprocessors listed at /trust/subprocessors, which is updated as changes occur.",
        "Recouply.ai imposes written data protection obligations on subprocessors substantially equivalent to those in this DPA.",
        "Customer may subscribe to subprocessor change notifications and object on reasonable data protection grounds.",
      ]},
      { title: "Security Measures", bullets: [
        "TLS 1.2+ in transit, AES-256 at rest, tenant isolation, least-privilege access, MFA/SSO for staff, and full audit logging.",
        "Session timeout, HIBP leaked-password protection, and enterprise session controls enforced platform-wide.",
        "Additional detail available in the Data Protection and Application Security policies.",
      ]},
      { title: "Data Subject Rights", bullets: [
        "Recouply.ai will assist Customer in responding to access, rectification, deletion, restriction, portability, and objection requests via platform self-service or support tooling.",
        "Requests received by Recouply.ai directly from data subjects are forwarded to Customer without response, unless legally required.",
      ]},
      { title: "International Transfers", bullets: [
        "Where personal data is transferred outside the EEA, UK, or Switzerland, the EU Standard Contractual Clauses (2021/914) and the UK IDTA/Addendum are incorporated by reference.",
        "Recouply.ai maintains a Transfer Impact Assessment (TIA) available on request under NDA.",
      ]},
      { title: "Breach Notification", bullets: [
        "Recouply.ai will notify Customer without undue delay, and in any event within 72 hours, after becoming aware of a personal data breach affecting Customer data.",
        "Notification includes nature of the breach, affected data categories, likely consequences, and mitigation measures.",
      ]},
      { title: "Audit & Return / Deletion", bullets: [
        "On request, Recouply.ai provides recent third-party audit summaries, SIG-Lite, and control documentation in lieu of on-site audits.",
        "On termination, Customer may export data via the platform; residual data is deleted within the retention window unless retention is legally required.",
      ]},
    ]}
  />
);

export default DPA;
