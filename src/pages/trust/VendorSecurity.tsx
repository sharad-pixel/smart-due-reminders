import TrustPolicyPage from "./TrustPolicyPage";

const VendorSecurity = () => (
  <TrustPolicyPage
    title="Vendor & Subprocessor Security"
    metaDescription="Recouply.ai's vendor security policy: third-party evaluation, access limitations, periodic review, and subprocessor transparency."
    canonicalPath="/trust/vendor-security"
    lastUpdated="April 2026"
    intro="We rely on a small number of established, enterprise-grade providers. Every vendor relationship is evaluated for security posture, access scope, and ongoing risk."
    sections={[
      { title: "Vendor Evaluation", bullets: [
        "Security posture, certifications, and data handling practices are assessed before engagement.",
        "Critical vendors are selected based on established track records serving security-sensitive customers.",
        "Contractual obligations govern data handling, access, and incident notification.",
      ]},
      { title: "Infrastructure Partners", bullets: [
        "Recouply.ai runs on enterprise-grade cloud infrastructure with comprehensive provider security programs.",
        "Provider security investments complement our application-level controls.",
        "Infrastructure certifications (SOC 2, ISO 27001) are validated as part of vendor review.",
      ]},
      { title: "Access Limitations", bullets: [
        "Vendors receive minimum necessary access to deliver their services.",
        "Customer data is not shared with vendors except as operationally required.",
        "Vendor access is governed by contractual terms and technical controls.",
      ]},
      { title: "Periodic Review", bullets: [
        "Critical vendors undergo periodic security reassessment.",
        "Changes in vendor posture, terms, or practices are evaluated for impact.",
        "Vendor inventory is maintained as part of overall security program management.",
      ]},
      { title: "Subprocessor Transparency", bullets: [
        "Key subprocessors involved in service delivery are documented and tracked.",
        "A subprocessor list is available to customers upon request during security review or procurement.",
        "Material changes to critical subprocessors are communicated proactively.",
      ]},
    ]}
  />
);

export default VendorSecurity;
