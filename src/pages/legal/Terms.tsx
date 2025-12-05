import MarketingLayout from "@/components/MarketingLayout";

const Terms = () => {
  return (
    <MarketingLayout>
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: January 2024</p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Nature of Service</h2>
            <p className="mb-4">
              Recouply.ai is <strong>software only</strong>. We provide tools that help you manage and automate your own accounts receivable and collection activities. We do not act as a collection agency, and we do not collect debts on your behalf.
            </p>
            <p>
              <strong>You, the customer, remain responsible for all collection activities</strong> conducted through our platform, including compliance with applicable federal, state, and local laws such as the Fair Debt Collection Practices Act (FDCPA), Telephone Consumer Protection Act (TCPA), and any other relevant regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">2. User Responsibilities</h2>
            <p className="mb-4">By using Recouply.ai, you agree that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are responsible for the accuracy of all data you upload or input into the platform.</li>
              <li>You will comply with all applicable laws and regulations when communicating with debtors.</li>
              <li>You will not use the platform to harass, threaten, or engage in deceptive practices.</li>
              <li>You will review and approve all AI-generated messages before sending them.</li>
              <li>You understand that Recouply.ai is not providing legal advice or acting as a collection agency.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">3. Limitation of Liability</h2>
            <p className="mb-4">
              Recouply.ai provides software "as is" without warranties of any kind. We are not liable for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Any legal claims arising from your use of the platform</li>
              <li>Non-compliance with debt collection laws or regulations</li>
              <li>Disputes between you and your debtors</li>
              <li>Lost revenue or failed collection attempts</li>
              <li>Errors in AI-generated content that you approve and send</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">4. Compliance and Legal Obligations</h2>
            <p className="mb-4">
              <strong>You are solely responsible for ensuring compliance with all applicable laws</strong>, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Fair Debt Collection Practices Act (FDCPA)</li>
              <li>Telephone Consumer Protection Act (TCPA)</li>
              <li>State-specific debt collection laws</li>
              <li>Consumer protection regulations</li>
              <li>Privacy and data protection laws (GDPR, CCPA, etc.)</li>
            </ul>
            <p className="mt-4">
              Recouply.ai does not provide legal advice. Consult with legal counsel to ensure your collection practices comply with all applicable regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">5. Payment Processing</h2>
            <p>
              All payments from debtors are processed directly through your own payment processors (e.g., Stripe). Recouply.ai never holds, processes, or takes a percentage of collected funds. We charge only a flat monthly fee for use of the software.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">6. Data and Privacy</h2>
            <p className="mb-4">
              You retain ownership of all data you input into Recouply.ai. We process data only to provide our services. See our <a href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</a> for details on how we handle and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">7. Content Safety & Acceptable Use</h2>
            <p className="mb-4">
              Recouply.ai maintains a safe and professional environment for all users. All uploaded content, including images (logos, attachments, avatars, and documents), is automatically scanned for inappropriate material.
            </p>
            <p className="mb-4 font-semibold text-foreground">Prohibited Content:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Nudity or sexually explicit content</li>
              <li>Graphic violence or gore</li>
              <li>Hate speech, harassment, or discriminatory imagery</li>
              <li>Self-harm or dangerous activity promotion</li>
              <li>Illegal drug use or promotion</li>
              <li>Any other content that is offensive, harmful, or violates applicable laws</li>
            </ul>
            <p className="mb-4">
              <strong>Automatic Moderation:</strong> All image uploads are processed through our automated content moderation system before being accepted. Content that violates our policies will be automatically rejected and will not be stored on our platform.
            </p>
            <p className="mb-4">
              <strong>Moderation Logging:</strong> For security and compliance purposes, we maintain logs of all content moderation decisions. These logs may include metadata about upload attempts but do not store rejected content.
            </p>
            <p>
              <strong>Violations:</strong> Repeated attempts to upload prohibited content may result in account suspension or termination. We reserve the right to report illegal content to appropriate authorities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">8. Termination</h2>
            <p>
              Either party may terminate this agreement at any time. Upon termination, you will retain access to your data for a reasonable export period. We reserve the right to suspend or terminate accounts that violate these terms or engage in illegal activity.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">9. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the new terms. We will notify you of material changes via email.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">10. Governing Law</h2>
            <p>
              These terms are governed by the laws of [Your Jurisdiction]. Any disputes shall be resolved in the courts of [Your Jurisdiction].
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">11. Contact</h2>
            <p>
              For questions about these terms, contact us at <a href="mailto:legal@recouply.ai" className="text-primary hover:underline">legal@recouply.ai</a>.
            </p>
          </section>

          <div className="mt-12 p-6 bg-muted/50 rounded-lg border">
            <p className="font-semibold mb-2">Important Reminder:</p>
            <p>
              Recouply.ai is software designed to help you manage your own collection activities. It is not a collection agency and does not collect debts on your behalf. You remain responsible for all communications sent through the platform and must ensure compliance with all applicable laws and regulations.
            </p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default Terms;
