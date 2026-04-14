import TrustPolicyPage from "./TrustPolicyPage";

const PrivacyDataHandling = () => (
  <TrustPolicyPage
    title="Privacy & Data Handling"
    metaDescription="Recouply.ai's privacy and data handling practices covering customer data use, retention, deletion, and privacy-minded handling of financial records."
    canonicalPath="/trust/privacy-data-handling"
    lastUpdated="April 2026"
    sections={[
      { title: "Customer Data Use", content: [
        "Customer data is used to deliver, maintain, and improve the Recouply.ai platform. We do not sell customer data or use it for purposes unrelated to service delivery.",
        "Data processing activities are aligned with our privacy policy and the terms of our customer agreements."
      ]},
      { title: "Access Limitations", content: [
        "Internal access to customer data is limited to authorized personnel who require it for operational, support, or security purposes. Access follows least-privilege principles.",
        "Customer data is not accessed for marketing, analytics, or other secondary purposes without appropriate authorization."
      ]},
      { title: "Retention & Deletion", content: [
        "Data is retained for the duration of the customer relationship and for a reasonable period thereafter as needed for legal, operational, or regulatory requirements.",
        "Customers can request deletion of their data. Deletion requests are processed in accordance with applicable regulations and our documented procedures."
      ]},
      { title: "Handling of Financial Records", content: [
        "Invoices, payment records, communications, workflow data, and outreach records are handled with appropriate care and access restrictions.",
        "Uploaded documents and files are stored securely and are accessible only to authorized users within the customer's organization."
      ]},
      { title: "Privacy-Minded Design", content: [
        "Privacy considerations are factored into our product design and development processes. We aim to minimize data collection, limit data exposure, and provide customers with visibility into how their data is used.",
        "Our privacy practices are designed to support customer compliance with applicable data protection regulations."
      ]},
    ]}
  />
);

export default PrivacyDataHandling;
