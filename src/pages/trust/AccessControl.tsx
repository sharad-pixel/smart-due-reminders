import TrustPolicyPage from "./TrustPolicyPage";

const AccessControl = () => (
  <TrustPolicyPage
    title="Access Control Policy"
    metaDescription="Recouply.ai's access control policy covering role-based permissions, least privilege principles, and credential management."
    canonicalPath="/trust/access-control"
    lastUpdated="April 2026"
    sections={[
      { title: "Least Privilege Principles", content: [
        "Access to customer data and platform resources follows the principle of least privilege. Users and team members are granted only the permissions necessary to perform their specific functions.",
        "Administrative access is restricted and subject to additional controls."
      ]},
      { title: "Role-Based Access", content: [
        "Recouply.ai implements role-based access controls (RBAC) throughout the platform. Customer organizations can assign roles to team members that govern access to data, workflows, outreach tools, and administrative settings.",
        "Available roles are designed to support typical finance team structures with appropriate separation of duties."
      ]},
      { title: "Internal Access Limitations", content: [
        "Internal team access to production systems and customer data is strictly limited. Access is granted on a need-to-know basis and is reviewed regularly.",
        "Direct database access is restricted to authorized personnel for operational and support purposes only."
      ]},
      { title: "Credential Management", content: [
        "Strong password requirements are enforced across the platform. We support and encourage multi-factor authentication for all accounts.",
        "Multi-factor authentication is expected for privileged access to production systems and administrative interfaces."
      ]},
      { title: "Onboarding & Offboarding", content: [
        "Access provisioning follows documented onboarding procedures. When team members change roles or leave the organization, access is reviewed and revoked promptly.",
        "Customer administrators can manage team access, invite new members, and revoke access directly through the platform."
      ]},
    ]}
  />
);

export default AccessControl;
