import TrustPolicyPage from "./TrustPolicyPage";

const PrivacyDataHandling = () => (
  <TrustPolicyPage
    title="Privacy & Data Handling"
    metaDescription="Recouply.ai's privacy and data handling practices: purpose-limited data use, controlled retention, deletion support, and privacy-minded design."
    canonicalPath="/trust/privacy-data-handling"
    lastUpdated="April 2026"
    intro="Customer data is used to deliver the service — nothing more. We apply privacy-minded design principles to every feature involving customer records."
    sections={[
      { title: "Purpose-Limited Data Use", bullets: [
        "Customer data is used exclusively to deliver, maintain, and improve the Recouply.ai platform.",
        "We do not sell customer data or use it for unrelated purposes.",
        "Data processing is governed by our privacy policy and customer agreements.",
      ]},
      { title: "Access Limitations", bullets: [
        "Internal access follows least-privilege principles and is limited to operational, support, and security needs.",
        "Customer data is not accessed for marketing or analytics without explicit authorization.",
        "Access events are logged and auditable.",
      ]},
      { title: "Retention & Deletion", bullets: [
        "Data retained for the service relationship plus a defined post-contract period for legal and regulatory needs.",
        "Deletion requests are honored within documented timeframes in accordance with applicable regulations.",
        "Customers can request data export before deletion.",
      ]},
      { title: "Financial Records Handling", bullets: [
        "Invoices, payment records, outreach logs, and workflow data are access-controlled and encrypted.",
        "Uploaded documents and files are stored securely and accessible only to authorized users within the customer's organization.",
        "Approval records, draft history, and communication logs are retained for audit traceability.",
      ]},
      { title: "Privacy by Design", bullets: [
        "Privacy is considered at the design stage of every feature.",
        "Data collection is minimized and exposure is limited by default.",
        "Our practices are designed to help customers meet their own data protection obligations.",
      ]},
    ]}
  />
);

export default PrivacyDataHandling;
