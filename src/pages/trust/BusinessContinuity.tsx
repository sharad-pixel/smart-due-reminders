import TrustPolicyPage from "./TrustPolicyPage";

const BusinessContinuity = () => (
  <TrustPolicyPage
    title="Backup & Business Continuity"
    metaDescription="Recouply.ai's business continuity policy covering routine backups, recovery planning, and service availability commitments."
    canonicalPath="/trust/business-continuity"
    lastUpdated="April 2026"
    sections={[
      { title: "Routine Backups", content: [
        "Customer data is backed up on a regular schedule using automated processes. Backups are encrypted and stored in geographically separated locations to protect against regional disruptions.",
        "Backup integrity is verified through regular testing and restoration exercises."
      ]},
      { title: "Recovery Planning", content: [
        "We maintain recovery procedures designed to restore service within defined recovery objectives. Recovery plans are documented and tested periodically.",
        "Recovery time and recovery point objectives are aligned with the operational requirements of finance and collections workflows."
      ]},
      { title: "Continuity Considerations", content: [
        "Our platform architecture is designed to minimize single points of failure. We leverage cloud infrastructure capabilities including automatic scaling, load balancing, and multi-availability zone deployment.",
        "Continuity planning considers scenarios including infrastructure failures, security incidents, and third-party service disruptions."
      ]},
      { title: "Minimizing Customer Disruption", content: [
        "We prioritize minimal disruption to customer operations during maintenance, updates, and incident recovery. Planned maintenance is communicated in advance when possible.",
        "Our infrastructure supports rolling deployments to reduce downtime during application updates."
      ]},
      { title: "Infrastructure Provider Awareness", content: [
        "We evaluate and monitor the availability and resilience capabilities of our infrastructure providers. Provider selection considers security certifications, uptime commitments, and disaster recovery capabilities.",
        "Dependencies on critical infrastructure providers are documented and reviewed as part of our continuity planning."
      ]},
    ]}
  />
);

export default BusinessContinuity;
