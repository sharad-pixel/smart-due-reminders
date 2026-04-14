import TrustPolicyPage from "./TrustPolicyPage";

const IncidentResponse = () => (
  <TrustPolicyPage
    title="Incident Response Policy"
    metaDescription="Recouply.ai's incident response policy: detection, escalation, containment, customer notification, and continuous improvement."
    canonicalPath="/trust/incident-response"
    lastUpdated="April 2026"
    intro="We maintain a structured incident response process designed to detect, contain, and resolve security events promptly — with transparent customer communication when warranted."
    sections={[
      { title: "Detection & Identification", bullets: [
        "Monitoring and alerting systems flag anomalous activity, unauthorized access attempts, and system irregularities.",
        "All team members are trained to recognize and escalate potential security events.",
        "Automated alerts reduce mean time to detection.",
      ]},
      { title: "Escalation & Triage", bullets: [
        "Structured severity classification determines response level and resource allocation.",
        "Critical incidents are escalated immediately to senior technical and leadership personnel.",
        "Clear ownership is assigned for every incident.",
      ]},
      { title: "Containment & Remediation", bullets: [
        "Containment actions include system isolation, credential revocation, and emergency patching.",
        "Root cause analysis drives remediation to prevent recurrence.",
        "Systems are restored to a verified secure state before resuming normal operations.",
      ]},
      { title: "Customer Notification", bullets: [
        "Impacted customers are notified promptly with details about the incident, its scope, and remediation steps.",
        "Notification timelines align with regulatory requirements and contractual obligations.",
        "Follow-up communication provided until resolution is confirmed.",
      ]},
      { title: "Post-Incident Review", bullets: [
        "Every incident triggers an internal review to identify contributing factors.",
        "Lessons learned are incorporated into monitoring, controls, and response procedures.",
        "Review outcomes are documented and tracked.",
      ]},
    ]}
  />
);

export default IncidentResponse;
