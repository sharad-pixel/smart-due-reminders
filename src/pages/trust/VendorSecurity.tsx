import TrustPolicyPage from "./TrustPolicyPage";

const VendorSecurity = () => (
  <TrustPolicyPage
    title="Vendor & Subprocessor Security"
    metaDescription="Recouply.ai's vendor security policy covering third-party provider review, access limitations, and subprocessor management."
    canonicalPath="/trust/vendor-security"
    lastUpdated="April 2026"
    sections={[
      { title: "Third-Party Provider Review", content: [
        "We evaluate the security posture of third-party providers before engagement and on an ongoing basis. Evaluation criteria include security certifications, data handling practices, and operational maturity.",
        "Critical vendors are selected based on their established track records in serving enterprise and security-sensitive customers."
      ]},
      { title: "Established Infrastructure Partners", content: [
        "Recouply.ai is built on enterprise-grade cloud infrastructure and service providers that maintain their own comprehensive security programs and certifications.",
        "We leverage the security investments of our infrastructure partners while maintaining our own application-level security controls."
      ]},
      { title: "Limiting Vendor Access", content: [
        "Third-party vendors are granted the minimum access necessary to deliver their services. Vendor access to customer data is restricted and governed by contractual obligations.",
        "We do not share customer data with vendors except as necessary to operate and deliver the platform."
      ]},
      { title: "Periodic Evaluation", content: [
        "Critical vendors are subject to periodic security review. Changes in vendor security posture, service terms, or data handling practices are assessed for impact.",
        "Vendor relationships are reviewed as part of our overall security program management."
      ]},
      { title: "Subprocessor List", content: [
        "We maintain awareness of subprocessors involved in delivering our services. A list of key subprocessors may be provided to customers upon request as part of security review or procurement processes.",
        "Changes to critical subprocessors are communicated to customers when appropriate."
      ]},
    ]}
  />
);

export default VendorSecurity;
