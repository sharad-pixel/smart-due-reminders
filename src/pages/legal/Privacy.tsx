import MarketingLayout from "@/components/MarketingLayout";
import { COMPANY_INFO } from "@/lib/companyConfig";

const Privacy = () => {
  const currentYear = new Date().getFullYear();

  return (
    <MarketingLayout>
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: December 2024</p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Introduction</h2>
            <p>
              {COMPANY_INFO.legalName} ("we," "our," or "us"), operating as {COMPANY_INFO.displayName}, is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our accounts receivable and collections management software.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">2. Information We Collect</h2>
            <p className="mb-4">We collect information in the following ways:</p>
            
            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account information (name, email, business details)</li>
              <li>Invoice and debtor data you upload or create</li>
              <li>Payment processing information (stored with third-party providers)</li>
              <li>CRM data you choose to sync (customer names, account details, etc.)</li>
              <li>Communication preferences and settings</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Usage data (features used, time spent, actions taken)</li>
              <li>Device information (browser type, operating system, IP address)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide and maintain our software platform</li>
              <li>Generate AI-powered collection messages based on your instructions</li>
              <li>Process payments for your plan</li>
              <li>Send administrative and service-related communications</li>
              <li>Improve and optimize our platform features</li>
              <li>Provide customer support</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">4. Data Sharing and Disclosure</h2>
            <p className="mb-4">We do not sell your personal information. We may share information in the following circumstances:</p>
            
            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Service Providers</h3>
            <p className="mb-2">We work with third-party service providers who assist in operating our platform:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Cloud hosting providers (for data storage and processing)</li>
              <li>Payment processors (for plan billing)</li>
              <li>AI/ML providers (for message generation)</li>
              <li>Email delivery services</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Legal Requirements</h3>
            <p>
              We may disclose information if required by law, court order, or governmental authority, or to protect our rights or the safety of others.
            </p>

            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Business Transfers</h3>
            <p>
              In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">5. Data Security</h2>
            <p className="mb-4">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption in transit (TLS/SSL) and at rest</li>
              <li>Access controls and authentication requirements</li>
              <li>Regular security audits and monitoring</li>
              <li>Secure cloud infrastructure with reputable providers</li>
            </ul>
            <p className="mt-4">
              However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">6. Content Moderation & Safety</h2>
            <p className="mb-4">
              To maintain a safe platform environment, all uploaded images and visual content are automatically scanned using AI-powered content moderation technology before being stored on our platform.
            </p>
            <p className="mb-4 font-semibold text-foreground">What We Scan For:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Nudity and sexually explicit content</li>
              <li>Graphic violence</li>
              <li>Hate speech and harassment imagery</li>
              <li>Self-harm content</li>
              <li>Illegal drug-related content</li>
              <li>Other inappropriate or offensive material</li>
            </ul>
            <p className="mb-4 font-semibold text-foreground">How Content Moderation Works:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Automatic Scanning:</strong> All image uploads (logos, avatars, attachments, documents) are processed through our moderation system before acceptance</li>
              <li><strong>Immediate Rejection:</strong> Content flagged as inappropriate is automatically blocked and never stored on our servers</li>
              <li><strong>Audit Logging:</strong> We maintain moderation logs for security and compliance purposes, including upload metadata and moderation decisions</li>
              <li><strong>No Rejected Content Storage:</strong> Images that fail moderation are not stored on our platform</li>
            </ul>
            <p>
              This moderation applies uniformly across all organizations using {COMPANY_INFO.displayName} to ensure a safe, professional environment for all users.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">7. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide services. Upon account termination, we will retain data for a reasonable period to comply with legal obligations and resolve disputes, after which it will be securely deleted.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">8. Your Rights</h2>
            <p className="mb-4">Depending on your jurisdiction, you may have the following rights:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data</li>
              <li><strong>Portability:</strong> Request export of your data in a structured format</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at{" "}
              <a href={`mailto:${COMPANY_INFO.emails.support}`} className="text-primary hover:underline">
                {COMPANY_INFO.emails.support}
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">9. Cookies and Tracking</h2>
            <p className="mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintain your login session</li>
              <li>Remember your preferences</li>
              <li>Analyze usage patterns and improve our platform</li>
            </ul>
            <p className="mt-4">
              You can control cookies through your browser settings, though disabling certain cookies may affect platform functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">10. International Data Transfers</h2>
            <p>
              Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place when transferring data internationally, including standard contractual clauses and compliance with applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">11. Children's Privacy</h2>
            <p>
              Our platform is not intended for use by individuals under the age of 18. We do not knowingly collect information from children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">12. Customer-Managed Content Disclaimer</h2>
            
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <p className="font-semibold text-foreground mb-2">✅ Recouply.ai — Customer-Managed Content Disclaimer</p>
            </div>

            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Customer-Provided Information Disclaimer</h3>
            <p className="mb-4">
              The Accounts Receivable ("AR") Information Pages and any related content displayed through the {COMPANY_INFO.displayName} platform are created, managed, and maintained solely by the customer.
            </p>
            <p className="mb-4">
              {COMPANY_INFO.displayName} acts only as a technology platform that enables customers to publish and share their own AR-related information, including but not limited to payment instructions, banking details (ACH/Wire), tax documents (such as W-9 forms), contact information, and business policies.
            </p>
            <p className="mb-4">
              {COMPANY_INFO.displayName} does not review, verify, validate, endorse, or guarantee the accuracy, completeness, legality, or compliance of any customer-provided content. All information presented on customer AR Information Pages is provided "as is" and at the customer's sole discretion.
            </p>

            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">Customer Responsibility</h3>
            <p className="mb-4">
              By using {COMPANY_INFO.displayName} to create or distribute AR Information Pages, the customer acknowledges and agrees that:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>The customer is solely responsible for the accuracy, validity, and completeness of all information displayed.</li>
              <li>The customer is responsible for ensuring all content complies with applicable laws, regulations, and contractual obligations, including tax, banking, privacy, and financial disclosure requirements.</li>
              <li>The customer is responsible for maintaining, updating, and correcting any information made available through their AR Information Page.</li>
              <li>Any reliance on customer-provided information by third parties, including debtors or payers, is at the customer's own risk.</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">Limitation of Liability</h3>
            <p className="mb-4">
              {COMPANY_INFO.displayName} shall not be liable for any damages, losses, disputes, payment errors, misdirected funds, compliance issues, or claims arising out of or related to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Incorrect or outdated customer-provided information</li>
              <li>Unauthorized changes made by the customer or their authorized users</li>
              <li>Use or misuse of banking, tax, or payment details displayed on customer pages</li>
              <li>Any transaction or interaction between the customer and third parties facilitated by customer-provided content</li>
            </ul>
            <p className="mb-4">
              {COMPANY_INFO.displayName} expressly disclaims all liability arising from the publication or use of customer-managed AR Information.
            </p>

            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">Platform Role Clarification</h3>
            <p className="mb-4">{COMPANY_INFO.displayName} does not act as:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>A payment processor</li>
              <li>A financial institution</li>
              <li>A collection agency</li>
              <li>A legal, tax, or accounting advisor</li>
            </ul>
            <p>
              All financial decisions, payment arrangements, and compliance obligations remain solely between the customer and their counterparties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes via email or through the platform. Continued use after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">14. Contact Us</h2>
            <p className="mb-4">
              For questions or concerns about this Privacy Policy or our data practices, contact us at:
            </p>
            <ul className="list-none space-y-2">
              <li>
                <strong>Privacy & Data Requests:</strong>{" "}
                <a href={`mailto:${COMPANY_INFO.emails.support}`} className="text-primary hover:underline">
                  {COMPANY_INFO.emails.support}
                </a>
              </li>
              <li>
                <strong>General Inquiries:</strong>{" "}
                <a href={`mailto:${COMPANY_INFO.emails.support}`} className="text-primary hover:underline">
                  {COMPANY_INFO.emails.support}
                </a>
              </li>
            </ul>
          </section>

          <div className="mt-12 p-6 bg-muted/50 rounded-lg border">
            <p className="font-semibold mb-2">Important Notice:</p>
            <p>
              {COMPANY_INFO.displayName} is software only and does not act as a collection agency. Any data you input about debtors is your responsibility to manage in compliance with applicable privacy and consumer protection laws. We process this data solely to provide our software services as instructed by you.
            </p>
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>© {currentYear} {COMPANY_INFO.legalName}. All rights reserved.</p>
            <p className="mt-1">{COMPANY_INFO.address.full}</p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default Privacy;
