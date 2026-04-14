import TrustPolicyPage from "./TrustPolicyPage";

const SecurityOverview = () => (
  <TrustPolicyPage
    title="Security Overview"
    metaDescription="Recouply.ai's security overview: data protection commitment, secure-by-design architecture, and layered administrative, technical, and operational safeguards."
    canonicalPath="/trust/security-overview"
    lastUpdated="April 2026"
    intro="Security is foundational to Recouply.ai. We take a secure-by-design approach — building protections into every layer of the platform rather than treating security as an add-on."
    sections={[
      { title: "Commitment to Data Protection", bullets: [
        "Customer data protection is a core operating principle, not a compliance checkbox.",
        "We maintain documented security policies that are reviewed and updated on a regular cadence.",
        "Security considerations are embedded into product design, development, and operational decisions.",
      ]},
      { title: "Administrative Safeguards", bullets: [
        "Documented policies cover access control, incident response, data handling, and vendor management.",
        "Team members follow established procedures for handling customer data.",
        "Security awareness is reinforced through onboarding and ongoing guidance.",
      ]},
      { title: "Technical Safeguards", bullets: [
        "Encryption in transit (TLS 1.2+) and at rest (AES-256).",
        "Role-based access controls, audit logging, and secure authentication mechanisms.",
        "Infrastructure monitoring, network isolation, and environment separation.",
      ]},
      { title: "Operational Safeguards", bullets: [
        "Structured change management with peer review and automated testing.",
        "Incident response procedures with defined escalation paths.",
        "Continuous improvement driven by operational experience and security developments.",
      ]},
      { title: "Enterprise Readiness", bullets: [
        "Security controls are aligned to enterprise expectations.",
        "We actively support customer security reviews and vendor due diligence processes.",
        "SOC 2 readiness roadmap in place to formalize our security program.",
      ]},
    ]}
  />
);

export default SecurityOverview;
