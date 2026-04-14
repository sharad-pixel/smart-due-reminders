import TrustPolicyPage from "./TrustPolicyPage";

const DataProtection = () => (
  <TrustPolicyPage
    title="Data Protection Policy"
    metaDescription="Recouply.ai's data protection policy covering encryption, data segregation, and secure handling of financial workflow data."
    canonicalPath="/trust/data-protection"
    lastUpdated="April 2026"
    sections={[
      { title: "Encryption", content: [
        "All data transmitted between clients and our platform is encrypted using TLS 1.2 or higher. Data at rest is encrypted using AES-256 encryption.",
        "Encryption keys are managed through our infrastructure provider's key management services with appropriate access controls."
      ]},
      { title: "Data Segregation", content: [
        "Customer data is logically segregated within our systems. Access controls and application logic ensure that each customer can only access their own data.",
        "Multi-tenant architecture is designed to prevent cross-tenant data access at the application, database, and API layers."
      ]},
      { title: "Handling Financial Data", content: [
        "Recouply.ai processes financial workflow data including invoices, payment records, and collections communications. This data is handled with appropriate care and access restrictions.",
        "We do not process or store payment card data directly. Payment processing is handled through established, PCI-compliant third-party providers."
      ]},
      { title: "Data Minimization", content: [
        "We collect and retain only the data necessary to deliver and improve our services. Unnecessary data collection is avoided by design.",
        "Data fields are purpose-driven, and we regularly review our data model to ensure alignment with service requirements."
      ]},
      { title: "Retention & Deletion", content: [
        "Customer data is retained for the duration of the service relationship and for a reasonable period thereafter to support operational and legal requirements.",
        "Customers can request data deletion, and we process these requests in accordance with applicable regulations and our documented procedures."
      ]},
    ]}
  />
);

export default DataProtection;
