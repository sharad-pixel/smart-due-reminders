import TrustPolicyPage from "./TrustPolicyPage";

const IncidentResponse = () => (
  <TrustPolicyPage
    title="Incident Response Policy"
    metaDescription="Recouply.ai's incident response policy covering identification, escalation, containment, and customer notification procedures."
    canonicalPath="/trust/incident-response"
    lastUpdated="April 2026"
    sections={[
      { title: "Incident Identification", content: [
        "We maintain monitoring and alerting systems to detect potential security incidents promptly. Anomalous activity, unauthorized access attempts, and system irregularities are flagged for investigation.",
        "Team members are trained to recognize and report potential security events through established channels."
      ]},
      { title: "Escalation & Triage", content: [
        "Identified incidents are assessed for severity and impact. A structured triage process determines the appropriate response level and resource allocation.",
        "Critical incidents are escalated immediately to senior technical and leadership team members."
      ]},
      { title: "Containment & Remediation", content: [
        "Once an incident is confirmed, containment measures are implemented to limit impact. This may include isolating affected systems, revoking compromised credentials, or applying emergency patches.",
        "Remediation efforts address the root cause and restore affected systems to a secure state."
      ]},
      { title: "Customer Notification", content: [
        "When a security incident may affect customer data, we notify impacted customers promptly with relevant details about the incident, its impact, and the steps being taken to address it.",
        "Notification timelines and methods are aligned with applicable regulatory requirements and contractual obligations."
      ]},
      { title: "Post-Incident Review", content: [
        "After resolution, we conduct internal reviews to identify contributing factors and improvement opportunities. Lessons learned are incorporated into our security practices and procedures.",
        "Post-incident reviews inform updates to monitoring, controls, and response procedures."
      ]},
    ]}
  />
);

export default IncidentResponse;
