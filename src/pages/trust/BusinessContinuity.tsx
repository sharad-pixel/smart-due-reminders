import TrustPolicyPage from "./TrustPolicyPage";

const BusinessContinuity = () => (
  <TrustPolicyPage
    title="Backup & Business Continuity"
    metaDescription="Recouply.ai's business continuity policy: automated backups, geo-redundancy, recovery targets, and continuity planning."
    canonicalPath="/trust/business-continuity"
    lastUpdated="April 2026"
    intro="Collections operations are time-sensitive. Our continuity strategy prioritizes minimal downtime, fast recovery, and transparent communication during disruptions."
    sections={[
      { title: "Automated Backups", bullets: [
        "Customer data is backed up on defined schedules with automated, encrypted processes.",
        "Backups are stored in geographically separated locations.",
        "Backup integrity is verified through regular restoration testing.",
      ]},
      { title: "Recovery Objectives", bullets: [
        "Documented RPO and RTO targets aligned with the operational needs of finance workflows.",
        "Recovery procedures are tested periodically and updated based on findings.",
        "Priority restoration covers customer-facing services and data access.",
      ]},
      { title: "Architecture Resilience", bullets: [
        "Multi-availability zone deployment minimizes single points of failure.",
        "Automatic scaling and load balancing maintain performance during demand spikes.",
        "Rolling deployments reduce downtime during application updates.",
      ]},
      { title: "Disruption Minimization", bullets: [
        "Planned maintenance is communicated in advance when possible.",
        "Infrastructure and application monitoring provide early warning of degradation.",
        "Incident communication includes estimated impact and recovery timelines.",
      ]},
      { title: "Provider Dependencies", bullets: [
        "Infrastructure providers are evaluated for uptime commitments, certifications, and disaster recovery capabilities.",
        "Critical dependencies are documented and reviewed as part of continuity planning.",
        "Fallback strategies are considered for key vendor dependencies.",
      ]},
    ]}
  />
);

export default BusinessContinuity;
