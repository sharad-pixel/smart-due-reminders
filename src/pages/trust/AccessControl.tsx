import TrustPolicyPage from "./TrustPolicyPage";

const AccessControl = () => (
  <TrustPolicyPage
    title="Access Control Policy"
    metaDescription="Recouply.ai's access control policy: RBAC, least-privilege enforcement, MFA, credential management, and access lifecycle management."
    canonicalPath="/trust/access-control"
    lastUpdated="April 2026"
    intro="Access to Recouply.ai follows the principle of least privilege. Every permission is scoped to role, and every access event is logged."
    sections={[
      { title: "Least Privilege", bullets: [
        "Users and internal team members receive only the permissions necessary for their function.",
        "Administrative access requires additional authorization and is subject to periodic review.",
        "Privilege escalation is logged and monitored.",
      ]},
      { title: "Role-Based Access Controls", bullets: [
        "Customer organizations assign roles that govern access to data, workflows, outreach tools, and admin settings.",
        "Roles map to typical finance team structures — supporting separation of duties for collections, approvals, and reporting.",
        "Role changes are audit-logged with timestamps and actor attribution.",
      ]},
      { title: "Authentication & MFA", bullets: [
        "Strong password requirements enforced platform-wide.",
        "Multi-factor authentication supported for all accounts and expected for privileged access.",
        "Session management includes configurable timeouts and forced re-authentication.",
      ]},
      { title: "Internal Access", bullets: [
        "Production system access limited to authorized personnel on a need-to-know basis.",
        "Direct database access restricted and logged.",
        "No customer data is used in non-production environments.",
      ]},
      { title: "Access Lifecycle", bullets: [
        "Documented onboarding procedures for provisioning access.",
        "Prompt revocation when team members change roles or depart.",
        "Customer admins manage invitations, role assignment, and access removal directly.",
      ]},
    ]}
  />
);

export default AccessControl;
