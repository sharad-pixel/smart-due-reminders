import TrustPolicyPage from "./TrustPolicyPage";

const ApplicationSecurity = () => (
  <TrustPolicyPage
    title="Application Security Policy"
    metaDescription="Recouply.ai's application security policy covering secure development, code review, vulnerability management, and change management."
    canonicalPath="/trust/application-security"
    lastUpdated="April 2026"
    sections={[
      { title: "Secure Development Practices", content: [
        "Security is integrated into our software development lifecycle. Developers follow secure coding guidelines and are expected to consider security implications in their work.",
        "We use established frameworks and libraries that are actively maintained and widely trusted in the developer community."
      ]},
      { title: "Code Review", content: [
        "All code changes undergo peer review before being merged into production branches. Reviews consider functionality, security implications, and code quality.",
        "Automated linting and static analysis tools supplement manual review processes."
      ]},
      { title: "Environment Separation", content: [
        "Development, staging, and production environments are separated. Customer data is not used in non-production environments.",
        "Access to production systems is restricted and subject to additional authentication and authorization controls."
      ]},
      { title: "Vulnerability Management", content: [
        "We monitor for known vulnerabilities in our application dependencies and infrastructure components. Identified vulnerabilities are assessed for risk and remediated based on severity.",
        "Automated dependency scanning tools help identify outdated or vulnerable packages."
      ]},
      { title: "Change Management", content: [
        "Changes to the production environment follow a structured change management process including review, testing, and approval steps.",
        "Deployments are monitored for unexpected behavior, and rollback procedures are available when needed."
      ]},
    ]}
  />
);

export default ApplicationSecurity;
