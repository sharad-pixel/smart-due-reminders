import TrustPolicyPage from "./TrustPolicyPage";

const DataProtection = () => (
  <TrustPolicyPage
    title="Data Protection Policy"
    metaDescription="Recouply.ai's data protection policy: encryption standards, tenant isolation, financial data handling, and controlled retention and deletion."
    canonicalPath="/trust/data-protection"
    lastUpdated="April 2026"
    intro="Customer data is encrypted, isolated, and handled with the care expected of a system of record for finance and collections operations."
    sections={[
      { title: "Encryption Standards", bullets: [
        "TLS 1.2+ for all data in transit between clients and platform services.",
        "AES-256 encryption for all data at rest.",
        "Encryption keys managed through provider key management services with strict access controls.",
      ]},
      { title: "Tenant Isolation", bullets: [
        "Logical data segregation ensures each customer accesses only their own records.",
        "Multi-tenant architecture enforces isolation at the application, database, and API layers.",
        "Cross-tenant access is prevented by design and tested regularly.",
      ]},
      { title: "Financial Data Handling", bullets: [
        "Invoices, payment records, and collections communications are handled with appropriate access restrictions.",
        "Payment card data is not processed or stored directly — payment processing uses PCI-compliant third parties.",
        "Workflow data including drafts, approvals, and outreach records is treated as sensitive and access-controlled.",
      ]},
      { title: "Data Minimization", bullets: [
        "Only data necessary to deliver the service is collected and retained.",
        "Data fields are purpose-driven — regularly reviewed for alignment with service requirements.",
        "Unnecessary data collection is avoided by design.",
      ]},
      { title: "Retention & Deletion", bullets: [
        "Data retained for the duration of the service relationship plus a defined post-contract period.",
        "Deletion requests processed in accordance with applicable regulations within documented timeframes.",
        "Customers can initiate data export and deletion through the platform or by contacting support.",
      ]},
    ]}
  />
);

export default DataProtection;
