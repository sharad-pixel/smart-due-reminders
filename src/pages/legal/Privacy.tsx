import MarketingLayout from "@/components/layout/MarketingLayout";
import { COMPANY_INFO } from "@/lib/companyConfig";
import SEOHead from "@/components/seo/SEOHead";
import { PAGE_SEO } from "@/lib/seoConfig";

const Privacy = () => {
  const currentYear = new Date().getFullYear();

  return (
    <MarketingLayout>
      <SEOHead
        title={PAGE_SEO.privacy.title}
        description={PAGE_SEO.privacy.description}
        keywords={PAGE_SEO.privacy.keywords}
        breadcrumbs={[
          { name: 'Legal', url: 'https://recouply.ai/legal/privacy' },
          { name: 'Privacy Policy', url: 'https://recouply.ai/legal/privacy' },
        ]}
      />
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: April 3, 2026</p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">1. Introduction</h2>
            <p>
              {COMPANY_INFO.legalName} ("we," "our," or "us"), operating as {COMPANY_INFO.displayName}, is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered accounts receivable intelligence and collections management platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">2. Information We Collect</h2>
            <p className="mb-4">We collect information in the following ways:</p>
            
            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account information (name, email address, business details, organization membership)</li>
              <li>Invoice, debtor, and payment data you upload, create, or import</li>
              <li>Data imported via integrations (Google Sheets, Google Drive, QuickBooks, Stripe, CRM systems)</li>
              <li>Payment processing information for subscription billing (stored with Stripe)</li>
              <li>CRM data you choose to sync (customer names, account details, health scores, etc.)</li>
              <li>Communication preferences, branding settings, and email templates</li>
              <li>Documents and files you upload (PDFs, spreadsheets, images, W-9 forms)</li>
              <li>AI command inputs and instructions for message generation</li>
              <li>Contact form submissions and assessment tool responses</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Usage data (features used, time spent, actions taken, page views)</li>
              <li>Device information (browser type, operating system, screen resolution)</li>
              <li>IP addresses (collected for security, rate limiting, and login tracking)</li>
              <li>Authentication events (login attempts, session activity, password resets)</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Information from Third-Party Integrations</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Google OAuth profile data (name, email) when you sign in with Google</li>
              <li>Google Drive file metadata and document contents when you connect your Drive</li>
              <li>Google Sheets data when you use our spreadsheet sync features</li>
              <li>CRM account and contact data from connected systems (Salesforce, HubSpot, etc.)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide and maintain our software platform and all its features</li>
              <li>Generate AI-powered collection messages, risk assessments, and payment scoring</li>
              <li>Process AI commands using third-party AI models (Google Gemini, OpenAI) to generate drafts, summaries, and recommendations</li>
              <li>Extract invoice data from uploaded documents using AI-powered OCR and parsing</li>
              <li>Calculate debtor risk scores, payment behavior patterns, and credit recommendations</li>
              <li>Synchronize data with connected third-party services (Google Sheets, Google Drive, CRMs)</li>
              <li>Process subscription billing via Stripe</li>
              <li>Send transactional emails (collection messages, verification emails, password resets, daily digests, admin alerts)</li>
              <li>Enforce rate limits, detect abuse, and prevent unauthorized access</li>
              <li>Maintain audit logs and security event records for compliance</li>
              <li>Provide the debtor portal for your customers to view invoices and make payments</li>
              <li>Generate public AR information pages on your behalf</li>
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
              <li><strong>Cloud hosting & database:</strong> Supabase (data storage, authentication, serverless functions)</li>
              <li><strong>Payment processing:</strong> Stripe (subscription billing and debtor payment links)</li>
              <li><strong>AI/ML providers:</strong> Google (Gemini models) and OpenAI (GPT models) for message generation, data extraction, risk analysis, and intelligent features</li>
              <li><strong>Email delivery:</strong> Resend (transactional and collection email sending)</li>
              <li><strong>Google APIs:</strong> Google Drive API and Google Sheets API for document ingestion and data synchronization</li>
              <li><strong>Content moderation:</strong> AI-based image scanning for uploaded visual content</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Debtor-Facing Features</h3>
            <p className="mb-2">Certain data is intentionally shared with your debtors/customers through features you control:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Public AR Information Pages display your business name, contact details, payment methods, and branding</li>
              <li>The Debtor Portal shows invoice details, payment plans, and payment links to your customers</li>
              <li>Collection emails sent on your behalf contain invoice details and payment instructions</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Team & Organization Access</h3>
            <p>
              If you are part of an organization on {COMPANY_INFO.displayName}, other authorized team members within your organization may access shared data such as debtor records, invoices, and collection activities based on their assigned roles and permissions.
            </p>

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
              We implement industry-standard and advanced security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption in transit (TLS/SSL) and at rest</li>
              <li>Row-level security (RLS) policies ensuring users can only access their own data</li>
              <li>Role-based access controls and authentication requirements</li>
              <li>Rate limiting and abuse prevention on all API endpoints and AI features</li>
              <li>Login attempt tracking with automatic account lockout after repeated failures</li>
              <li>Leaked password detection (HaveIBeenPwned integration)</li>
              <li>Bot detection via honeypot fields on public forms</li>
              <li>Input validation and sanitization to prevent SQL injection and XSS attacks</li>
              <li>Comprehensive audit logging of user actions and security events</li>
              <li>Session tracking and monitoring</li>
              <li>Secure cloud infrastructure with reputable providers</li>
              <li>Sync protection controls to prevent mass data deletion via integrations</li>
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
            <h2 className="text-2xl font-bold text-foreground mb-4">7. AI & Automated Processing</h2>
            <p className="mb-4">
              {COMPANY_INFO.displayName} makes extensive use of artificial intelligence and automated processing:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>AI-Generated Collection Messages:</strong> Our AI agent ("Nicolas") generates personalized collection emails, SMS messages, and follow-ups based on debtor data, aging status, and your configured tone and branding preferences</li>
              <li><strong>Invoice Data Extraction:</strong> Uploaded PDF invoices are processed by AI to extract structured data (invoice numbers, amounts, dates, debtor information) with confidence scoring</li>
              <li><strong>Risk Scoring & Payment Behavior Analysis:</strong> Automated algorithms calculate Paydex-style scores, payment trends, and credit risk assessments for your debtor accounts</li>
              <li><strong>Smart Campaign Recommendations:</strong> AI analyzes your portfolio to recommend collection strategies, channels, and timing</li>
              <li><strong>Inbound Email Triage:</strong> AI automatically categorizes and triages inbound debtor replies, generating suggested responses</li>
              <li><strong>Data Deduplication:</strong> Automated matching identifies potential duplicate records during data imports</li>
            </ul>
            <p className="mt-4">
              AI-generated content is always presented for your review before sending, unless you have explicitly enabled auto-approval for specific workflows. You retain full control over all AI-generated communications.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">8. Third-Party Integrations</h2>
            <p className="mb-4">
              When you connect third-party services to {COMPANY_INFO.displayName}, we access and process data from those services as follows:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Google Drive:</strong> We access files in folders you authorize via OAuth to extract invoice data. We store extracted data and file metadata but do not modify your Drive files.</li>
              <li><strong>Google Sheets:</strong> We create and synchronize spreadsheet templates for data import/export. Sync protection prevents accidental mass deletion of records through sheet updates.</li>
              <li><strong>CRM Systems:</strong> We import customer, account, and support case data from connected CRMs to enrich debtor profiles and inform collection strategies.</li>
              <li><strong>Stripe:</strong> We integrate with Stripe for subscription billing and enable you to configure payment links for your debtors.</li>
            </ul>
            <p className="mt-4">
              You can disconnect integrations at any time. Disconnecting will stop future data syncs but will not automatically delete previously imported data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">9. Data Retention</h2>
            <p className="mb-4">
              We retain your data for as long as your account is active or as needed to provide services. Specific retention policies include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account data:</strong> Retained while your account is active</li>
              <li><strong>Audit logs & security events:</strong> Retained for compliance and security investigation purposes</li>
              <li><strong>Login attempt records:</strong> Retained for security monitoring and rate limiting</li>
              <li><strong>AI command logs:</strong> Retained for service improvement and troubleshooting</li>
              <li><strong>Daily digest history:</strong> Retained for your reference and reporting</li>
            </ul>
            <p className="mt-4">
              Upon account deletion, we will remove your personal data and business records. Certain anonymized or aggregated data may be retained for analytics. Audit logs may be retained for a reasonable period to comply with legal obligations and resolve disputes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">10. Your Rights</h2>
            <p className="mb-4">Depending on your jurisdiction, you may have the following rights:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data and account</li>
              <li><strong>Portability:</strong> Request export of your data in a structured format (CSV, spreadsheet exports are available within the platform)</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications and daily digest emails</li>
              <li><strong>Restrict Processing:</strong> Request restriction of certain data processing activities</li>
              <li><strong>Object to Automated Decisions:</strong> Request human review of decisions made solely by automated processing</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at{" "}
              <a href={`mailto:${COMPANY_INFO.emails.support}`} className="text-primary hover:underline">
                {COMPANY_INFO.emails.support}
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">11. Cookies and Tracking</h2>
            <p className="mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintain your login session and authentication state</li>
              <li>Remember your preferences and settings</li>
              <li>Analyze usage patterns and improve our platform</li>
              <li>Track assessment and onboarding funnel events</li>
            </ul>
            <p className="mt-4">
              You can control cookies through your browser settings, though disabling certain cookies may affect platform functionality. For more details, see our{" "}
              <a href="/legal/cookies" className="text-primary hover:underline">Cookie Policy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">12. International Data Transfers</h2>
            <p>
              Your data may be transferred to and processed in countries other than your own, including the United States. Our cloud infrastructure, AI providers, and email services may process data in multiple regions. We ensure appropriate safeguards are in place when transferring data internationally, including standard contractual clauses and compliance with applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">13. Children's Privacy</h2>
            <p>
              Our platform is designed for business use and is not intended for use by individuals under the age of 18. We do not knowingly collect information from children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">14. Customer-Managed Content Disclaimer</h2>
            
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <p className="font-semibold text-foreground mb-2">✅ Recouply.ai — Customer-Managed Content Disclaimer</p>
            </div>

            <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Customer-Provided Information Disclaimer</h3>
            <p className="mb-4">
              The Accounts Receivable ("AR") Information Pages, Debtor Portal pages, and any related content displayed through the {COMPANY_INFO.displayName} platform are created, managed, and maintained solely by the customer.
            </p>
            <p className="mb-4">
              {COMPANY_INFO.displayName} acts only as a technology platform that enables customers to publish and share their own AR-related information, including but not limited to payment instructions, banking details (ACH/Wire), tax documents (such as W-9 forms), contact information, business policies, invoice data, and payment plan details.
            </p>
            <p className="mb-4">
              {COMPANY_INFO.displayName} does not review, verify, validate, endorse, or guarantee the accuracy, completeness, legality, or compliance of any customer-provided content. All information presented on customer AR Information Pages and Debtor Portal pages is provided "as is" and at the customer's sole discretion.
            </p>

            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">Customer Responsibility</h3>
            <p className="mb-4">
              By using {COMPANY_INFO.displayName} to create or distribute AR Information Pages, Debtor Portal content, or AI-generated collection communications, the customer acknowledges and agrees that:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>The customer is solely responsible for the accuracy, validity, and completeness of all information displayed.</li>
              <li>The customer is responsible for reviewing and approving all AI-generated communications before they are sent to debtors.</li>
              <li>The customer is responsible for ensuring all content complies with applicable laws, regulations, and contractual obligations, including tax, banking, privacy, consumer protection, and financial disclosure requirements.</li>
              <li>The customer is responsible for maintaining, updating, and correcting any information made available through their AR Information Page, Debtor Portal, or collection communications.</li>
              <li>Any reliance on customer-provided information by third parties, including debtors or payers, is at the customer's own risk.</li>
            </ul>

            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">Limitation of Liability</h3>
            <p className="mb-4">
              {COMPANY_INFO.displayName} shall not be liable for any damages, losses, disputes, payment errors, misdirected funds, compliance issues, or claims arising out of or related to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Incorrect or outdated customer-provided information</li>
              <li>AI-generated content that the customer approved and sent</li>
              <li>Unauthorized changes made by the customer or their authorized users</li>
              <li>Use or misuse of banking, tax, or payment details displayed on customer pages</li>
              <li>Any transaction or interaction between the customer and third parties facilitated by customer-provided content</li>
              <li>Data imported from third-party integrations (Google Sheets, Google Drive, CRMs) that is inaccurate or incomplete</li>
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
              <li>A credit reporting agency</li>
            </ul>
            <p>
              All financial decisions, payment arrangements, and compliance obligations remain solely between the customer and their counterparties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">15. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes via email or through the platform. Continued use after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-4">16. Contact Us</h2>
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
