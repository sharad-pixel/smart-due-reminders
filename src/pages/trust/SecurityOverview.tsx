import TrustPolicyPage from "./TrustPolicyPage";

const SecurityOverview = () => (
  <TrustPolicyPage
    title="Security Overview"
    metaDescription="Recouply.ai's security overview covering our commitment to data protection, secure-by-design architecture, and operational safeguards."
    canonicalPath="/trust/security-overview"
    lastUpdated="April 2026"
    sections={[
      { title: "Our Commitment", content: [
        "Recouply.ai is committed to protecting the data our customers entrust to us. Security is foundational to our platform and is considered at every stage of design, development, and operations.",
        "We take a secure-by-design approach, building security controls into the platform rather than adding them as an afterthought."
      ]},
      { title: "Administrative Safeguards", content: [
        "We maintain documented security policies covering access control, incident response, data handling, and vendor management. These policies are reviewed and updated regularly to reflect evolving requirements and best practices.",
        "Team members receive security awareness guidance and are expected to follow established procedures for handling customer data."
      ]},
      { title: "Technical Safeguards", content: [
        "Technical controls include encryption of data in transit and at rest, role-based access controls, audit logging, secure authentication mechanisms, and infrastructure monitoring.",
        "We use established cloud infrastructure providers with strong security track records and maintain environment separation between development, staging, and production systems."
      ]},
      { title: "Operational Safeguards", content: [
        "We follow structured change management processes, conduct code reviews, and maintain incident response procedures. Our approach emphasizes continuous improvement based on operational experience and security developments.",
        "Security controls are aligned to enterprise expectations, and we actively support customer security reviews and due diligence processes."
      ]},
    ]}
  />
);

export default SecurityOverview;
