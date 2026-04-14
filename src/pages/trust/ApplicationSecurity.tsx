import TrustPolicyPage from "./TrustPolicyPage";

const ApplicationSecurity = () => (
  <TrustPolicyPage
    title="Application Security Policy"
    metaDescription="Recouply.ai's application security policy: secure SDLC, code review, dependency management, environment separation, and change management."
    canonicalPath="/trust/application-security"
    lastUpdated="April 2026"
    intro="Security is integrated into our development lifecycle — from design through deployment. Every change is reviewed, tested, and monitored."
    sections={[
      { title: "Secure Development", bullets: [
        "Developers follow secure coding guidelines and consider security implications in all work.",
        "Established, actively maintained frameworks and libraries are used throughout the stack.",
        "Security-relevant patterns are documented and shared across the team.",
      ]},
      { title: "Code Review & Testing", bullets: [
        "All code changes undergo mandatory peer review before production merge.",
        "Automated linting, static analysis, and integration tests supplement manual review.",
        "Security-sensitive changes receive additional scrutiny.",
      ]},
      { title: "Environment Separation", bullets: [
        "Development, staging, and production environments are fully separated.",
        "Customer data is never used in non-production environments.",
        "Production access requires additional authentication and is logged.",
      ]},
      { title: "Dependency Management", bullets: [
        "Automated scanning identifies outdated or vulnerable packages.",
        "Vulnerabilities are assessed for risk and remediated based on severity and exploitability.",
        "Dependency updates follow the same review and testing process as application changes.",
      ]},
      { title: "Change Management", bullets: [
        "All production changes follow a structured pipeline: review → test → approve → deploy → monitor.",
        "Rollback procedures are available and tested for every deployment.",
        "Post-deployment monitoring detects unexpected behavior.",
      ]},
    ]}
  />
);

export default ApplicationSecurity;
