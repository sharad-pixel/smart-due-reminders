import MarketingLayout from "@/components/MarketingLayout";
import { COMPANY_INFO } from "@/lib/companyConfig";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Scale, Shield, Clock, CreditCard, Database, Users, AlertTriangle, Gavel, Mail } from "lucide-react";

const Terms = () => {
  const currentYear = new Date().getFullYear();
  const effectiveDate = "January 1, 2025";
  
  return (
    <MarketingLayout>
      <div className="container mx-auto max-w-4xl px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Master Service Agreement</h1>
          <p className="text-xl text-muted-foreground mb-2">Terms of Service</p>
          <p className="text-sm text-muted-foreground">Effective Date: {effectiveDate} | Last Updated: January 2025</p>
        </div>

        {/* Quick Navigation */}
        <Card className="mb-12">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Agreement Overview
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              This Master Service Agreement ("Agreement") is entered into by and between {COMPANY_INFO.legalName} ("Provider," "we," "us," or "our") 
              and the entity or individual ("Customer," "you," or "your") agreeing to these terms.
            </p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <a href="#definitions" className="text-primary hover:underline">1. Definitions</a>
              <a href="#services" className="text-primary hover:underline">2. Services & License</a>
              <a href="#subscriptions" className="text-primary hover:underline">3. Subscriptions & Fees</a>
              <a href="#customer-responsibilities" className="text-primary hover:underline">4. Customer Responsibilities</a>
              <a href="#data" className="text-primary hover:underline">5. Data Rights & Privacy</a>
              <a href="#security" className="text-primary hover:underline">6. Security & Compliance</a>
              <a href="#sla" className="text-primary hover:underline">7. Service Levels</a>
              <a href="#warranties" className="text-primary hover:underline">8. Warranties & Disclaimers</a>
              <a href="#liability" className="text-primary hover:underline">9. Limitation of Liability</a>
              <a href="#indemnification" className="text-primary hover:underline">10. Indemnification</a>
              <a href="#term" className="text-primary hover:underline">11. Term & Termination</a>
              <a href="#general" className="text-primary hover:underline">12. General Provisions</a>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-10 text-muted-foreground">
          
          {/* Section 1: Definitions */}
          <section id="definitions">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">1. Definitions</h2>
            </div>
            <div className="space-y-3 pl-9">
              <p><strong>"Agreement"</strong> means this Master Service Agreement, including all Order Forms, Exhibits, and policies incorporated by reference.</p>
              <p><strong>"Authorized Users"</strong> means employees, contractors, or agents of Customer who are authorized to access and use the Services under Customer's account.</p>
              <p><strong>"Customer Data"</strong> means all data, content, and information uploaded, submitted, or otherwise provided by Customer or Authorized Users to the Services.</p>
              <p><strong>"Documentation"</strong> means the user guides, help files, and other technical materials provided by Provider describing the features and functionality of the Services.</p>
              <p><strong>"Order Form"</strong> means an ordering document specifying the Services, subscription tier, fees, and subscription term agreed upon by the parties.</p>
              <p><strong>"Services"</strong> means the {COMPANY_INFO.displayName} collection intelligence platform and any related services provided under this Agreement.</p>
              <p><strong>"Subscription Term"</strong> means the period during which Customer has agreed to subscribe to the Services as specified in an Order Form.</p>
            </div>
          </section>

          <Separator />

          {/* Section 2: Services & License */}
          <section id="services">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">2. Services & License Grant</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">2.1 Nature of Services</h3>
                <p className="mb-3">
                  {COMPANY_INFO.displayName} is a <strong>software-as-a-service (SaaS) platform</strong> that provides collection intelligence tools, 
                  AI-powered communication drafting, workflow automation, and accounts receivable management capabilities. 
                </p>
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 my-4">
                  <p className="text-sm font-semibold text-warning-foreground">
                    <strong>IMPORTANT NOTICE:</strong> {COMPANY_INFO.legalName} is NOT a collection agency. We provide software tools only. 
                    We do not collect debts, communicate with debtors on your behalf, or take any collection actions. 
                    You, the Customer, remain solely responsible for all collection activities.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">2.2 License Grant</h3>
                <p>
                  Subject to the terms of this Agreement and payment of applicable fees, Provider grants Customer a limited, non-exclusive, 
                  non-transferable, non-sublicensable right to access and use the Services during the Subscription Term solely for 
                  Customer's internal business purposes.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">2.3 Restrictions</h3>
                <p className="mb-2">Customer shall not, and shall not permit any third party to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Copy, modify, or create derivative works of the Services</li>
                  <li>Reverse engineer, disassemble, or decompile any portion of the Services</li>
                  <li>Sell, resell, license, sublicense, or distribute the Services</li>
                  <li>Use the Services to develop a competing product or service</li>
                  <li>Access the Services to benchmark against a competitive product</li>
                  <li>Use the Services in violation of applicable laws or regulations</li>
                  <li>Circumvent any security measures or access controls</li>
                  <li>Transmit viruses, malware, or other harmful code</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">2.4 AI-Generated Content</h3>
                <p>
                  The Services include AI-powered features that generate draft communications and recommendations. Customer acknowledges that:
                </p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>All AI-generated content requires human review and approval before use</li>
                  <li>Customer is solely responsible for the accuracy, legality, and appropriateness of content sent to debtors</li>
                  <li>Provider makes no warranties regarding the suitability of AI-generated content for any purpose</li>
                  <li>Customer must verify compliance with applicable laws before sending any communication</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 3: Subscriptions & Fees */}
          <section id="subscriptions">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">3. Subscriptions, Fees & Payment</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">3.1 Subscription Plans</h3>
                <p>
                  Services are offered on a subscription basis. The specific features, usage limits, and pricing for each subscription 
                  tier are set forth in the applicable Order Form or as published on our pricing page.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">3.2 Fees and Payment</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Billing:</strong> Fees are billed in advance on a monthly or annual basis as specified in the Order Form</li>
                  <li><strong>Payment Method:</strong> Customer shall provide valid payment information and authorize recurring charges</li>
                  <li><strong>Taxes:</strong> Fees are exclusive of taxes. Customer is responsible for all applicable taxes</li>
                  <li><strong>Late Payments:</strong> Overdue amounts accrue interest at 1.5% per month or the maximum legal rate</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">3.3 Fee Changes</h3>
                <p>
                  Provider may modify fees upon 30 days' written notice. Fee changes take effect at the start of the next renewal term. 
                  Customer may terminate the affected subscription before the fee change takes effect.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">3.4 Refunds</h3>
                <p>
                  Fees are non-refundable except as expressly set forth in this Agreement or required by applicable law. 
                  Provider may, at its sole discretion, offer prorated refunds for annual subscriptions terminated by Provider without cause.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">3.5 No Commission on Collections</h3>
                <p>
                  {COMPANY_INFO.displayName} charges only flat subscription fees. We do not take any percentage or commission on 
                  amounts collected by Customer. All payments from debtors flow directly to Customer through Customer's own payment processors.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 4: Customer Responsibilities */}
          <section id="customer-responsibilities">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">4. Customer Responsibilities</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">4.1 Account Security</h3>
                <p>Customer is responsible for:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>Maintaining the confidentiality of account credentials</li>
                  <li>Managing Authorized User access and permissions</li>
                  <li>All activities occurring under Customer's account</li>
                  <li>Promptly notifying Provider of any unauthorized access</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">4.2 Data Accuracy</h3>
                <p>
                  Customer is solely responsible for the accuracy, quality, integrity, and legality of all Customer Data 
                  and the means by which Customer acquired such data.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">4.3 Legal Compliance</h3>
                <p className="mb-2">
                  <strong>Customer is solely responsible for ensuring all collection activities comply with applicable laws</strong>, including:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Fair Debt Collection Practices Act (FDCPA)</li>
                  <li>Telephone Consumer Protection Act (TCPA)</li>
                  <li>Fair Credit Reporting Act (FCRA)</li>
                  <li>State-specific debt collection licensing and regulations</li>
                  <li>Consumer Financial Protection Bureau (CFPB) rules</li>
                  <li>General Data Protection Regulation (GDPR) where applicable</li>
                  <li>California Consumer Privacy Act (CCPA) and state privacy laws</li>
                  <li>CAN-SPAM Act and email marketing regulations</li>
                  <li>Any other applicable federal, state, local, or international laws</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">4.4 Prohibited Uses</h3>
                <p>Customer shall not use the Services to:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>Harass, threaten, abuse, or intimidate any person</li>
                  <li>Make false, deceptive, or misleading representations</li>
                  <li>Violate any person's privacy rights</li>
                  <li>Engage in unfair or deceptive collection practices</li>
                  <li>Process personal data without proper legal basis</li>
                  <li>Upload illegal, harmful, or inappropriate content</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">4.5 Content Moderation</h3>
                <p>
                  All uploaded content, including images and documents, is subject to automated content moderation. 
                  Prohibited content (explicit material, violence, hate speech, illegal content) will be automatically rejected. 
                  Repeated violations may result in account suspension or termination.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 5: Data Rights */}
          <section id="data">
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">5. Data Rights & Privacy</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">5.1 Customer Data Ownership</h3>
                <p>
                  Customer retains all rights, title, and interest in and to Customer Data. Provider acquires no ownership 
                  rights in Customer Data. Customer grants Provider a limited license to use Customer Data solely to provide the Services.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">5.2 Data Processing</h3>
                <p>
                  Provider processes Customer Data in accordance with our <a href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</a> and 
                  applicable data protection laws. Provider acts as a data processor on behalf of Customer (the data controller).
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">5.3 Data Protection Agreement</h3>
                <p>
                  Upon request, Provider will execute a Data Processing Agreement (DPA) that addresses GDPR, CCPA, and other 
                  applicable data protection requirements. Enterprise customers may request custom DPAs.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">5.4 Data Portability</h3>
                <p>
                  Customer may export Customer Data at any time during the Subscription Term using available export features. 
                  Upon termination, Customer will have 30 days to export data before deletion.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">5.5 Aggregated Data</h3>
                <p>
                  Provider may use anonymized, aggregated data derived from Customer's use of the Services for analytics, 
                  benchmarking, and service improvement purposes, provided such data cannot identify Customer or any individual.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 6: Security & Compliance */}
          <section id="security">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">6. Security & Compliance</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">6.1 Security Measures</h3>
                <p className="mb-2">Provider maintains industry-standard security measures including:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Encryption of data in transit (TLS 1.2+) and at rest (AES-256)</li>
                  <li>Multi-factor authentication options</li>
                  <li>Role-based access controls</li>
                  <li>Regular security assessments and penetration testing</li>
                  <li>24/7 infrastructure monitoring</li>
                  <li>Automated threat detection and response</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">6.2 Security Incident Response</h3>
                <p>
                  In the event of a security incident affecting Customer Data, Provider will notify Customer within 72 hours 
                  and provide reasonable cooperation in investigating and remediating the incident.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">6.3 Compliance Certifications</h3>
                <p>
                  Provider maintains compliance with SOC 2 Type II standards. Compliance documentation is available upon request 
                  for customers under NDA. Additional certifications may be available for Enterprise customers.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">6.4 Audit Rights</h3>
                <p>
                  Upon reasonable advance notice and no more than once per year, Enterprise customers may audit Provider's 
                  compliance with security and data protection obligations, subject to confidentiality requirements.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 7: Service Levels */}
          <section id="sla">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">7. Service Level Agreement</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">7.1 Uptime Commitment</h3>
                <p>
                  Provider targets 99.9% uptime for the Services, measured monthly, excluding scheduled maintenance and 
                  circumstances beyond Provider's reasonable control.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">7.2 Scheduled Maintenance</h3>
                <p>
                  Provider will provide at least 48 hours' notice for scheduled maintenance that may affect availability. 
                  Maintenance windows are typically scheduled during off-peak hours.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">7.3 Support</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Starter/Growth:</strong> Email support with 24-hour response time (business days)</li>
                  <li><strong>Professional:</strong> Priority email support with 8-hour response time</li>
                  <li><strong>Enterprise:</strong> Dedicated support with 4-hour response time and named account manager</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">7.4 Service Credits</h3>
                <p>
                  If Provider fails to meet the uptime commitment, affected customers may request service credits:
                </p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>99.0% - 99.9% uptime: 10% credit of monthly fees</li>
                  <li>95.0% - 98.9% uptime: 25% credit of monthly fees</li>
                  <li>Below 95.0% uptime: 50% credit of monthly fees</li>
                </ul>
                <p className="mt-2 text-sm">
                  Credits must be requested within 30 days and are Customer's sole remedy for downtime.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 8: Warranties */}
          <section id="warranties">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">8. Warranties & Disclaimers</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">8.1 Provider Warranties</h3>
                <p>Provider warrants that:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>The Services will perform substantially in accordance with the Documentation</li>
                  <li>Provider will provide the Services in a professional and workmanlike manner</li>
                  <li>Provider has the authority to enter into this Agreement and grant the rights herein</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">8.2 Customer Warranties</h3>
                <p>Customer warrants that:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>Customer has the right to provide Customer Data to Provider</li>
                  <li>Customer's use of the Services will comply with all applicable laws</li>
                  <li>Customer has obtained all necessary consents for data processing</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">8.3 Disclaimer</h3>
                <div className="bg-muted/50 border rounded-lg p-4">
                  <p className="uppercase text-sm">
                    EXCEPT AS EXPRESSLY SET FORTH HEREIN, THE SERVICES ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. 
                    PROVIDER DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, 
                    FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. PROVIDER DOES NOT WARRANT THAT THE 
                    SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">8.4 No Legal Advice</h3>
                <p>
                  <strong>THE SERVICES DO NOT CONSTITUTE LEGAL ADVICE.</strong> Provider is not a law firm and does not provide 
                  legal services. Customer should consult with qualified legal counsel regarding compliance with debt collection 
                  laws and regulations.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 9: Limitation of Liability */}
          <section id="liability">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">9. Limitation of Liability</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">9.1 Exclusion of Consequential Damages</h3>
                <div className="bg-muted/50 border rounded-lg p-4">
                  <p className="uppercase text-sm">
                    IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, 
                    PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, 
                    OR OTHER INTANGIBLE LOSSES, REGARDLESS OF WHETHER SUCH PARTY WAS ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">9.2 Liability Cap</h3>
                <div className="bg-muted/50 border rounded-lg p-4">
                  <p className="uppercase text-sm">
                    EXCEPT FOR OBLIGATIONS UNDER SECTION 10 (INDEMNIFICATION), EACH PARTY'S TOTAL CUMULATIVE LIABILITY 
                    UNDER THIS AGREEMENT SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS PAID BY CUSTOMER TO PROVIDER 
                    IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE THOUSAND DOLLARS ($1,000).
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">9.3 Specific Exclusions</h3>
                <p>Provider is not liable for:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>Legal claims arising from Customer's collection activities</li>
                  <li>Customer's non-compliance with debt collection laws</li>
                  <li>Disputes between Customer and Customer's debtors</li>
                  <li>Failed collection attempts or lost revenue</li>
                  <li>Errors in AI-generated content that Customer approves and sends</li>
                  <li>Third-party services or integrations</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 10: Indemnification */}
          <section id="indemnification">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">10. Indemnification</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">10.1 Customer Indemnification</h3>
                <p>
                  Customer shall indemnify, defend, and hold harmless Provider and its officers, directors, employees, and agents 
                  from any claims, damages, losses, and expenses (including reasonable attorneys' fees) arising from:
                </p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>Customer's use of the Services in violation of this Agreement</li>
                  <li>Customer's violation of applicable laws, including debt collection laws</li>
                  <li>Customer Data or Customer's collection activities</li>
                  <li>Claims by Customer's debtors or any third parties</li>
                  <li>Customer's breach of privacy or data protection obligations</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">10.2 Provider Indemnification</h3>
                <p>
                  Provider shall indemnify, defend, and hold harmless Customer from claims that the Services infringe any 
                  third-party intellectual property rights, provided Customer promptly notifies Provider and cooperates in the defense.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">10.3 Procedure</h3>
                <p>
                  The indemnifying party shall have sole control of the defense and settlement. The indemnified party shall 
                  provide reasonable cooperation and may participate at its own expense.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 11: Term & Termination */}
          <section id="term">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">11. Term & Termination</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">11.1 Term</h3>
                <p>
                  This Agreement commences on the date Customer first accepts it and continues until all subscriptions expire 
                  or are terminated. Subscriptions automatically renew for successive periods equal to the initial term unless 
                  either party provides written notice of non-renewal at least 30 days before the renewal date.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">11.2 Termination for Convenience</h3>
                <p>
                  Either party may terminate this Agreement or any subscription with 30 days' written notice. Customer remains 
                  responsible for fees through the end of the current subscription term.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">11.3 Termination for Cause</h3>
                <p>Either party may terminate immediately upon written notice if:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>The other party materially breaches this Agreement and fails to cure within 30 days of notice</li>
                  <li>The other party becomes insolvent or files for bankruptcy</li>
                  <li>Continued performance would violate applicable law</li>
                </ul>
                <p className="mt-2">
                  Provider may suspend or terminate immediately for Customer's violation of acceptable use policies or 
                  non-payment of fees.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">11.4 Effect of Termination</h3>
                <p>Upon termination:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>Customer's right to access the Services immediately ceases</li>
                  <li>Customer has 30 days to export Customer Data</li>
                  <li>Provider will delete Customer Data within 90 days, except as required by law</li>
                  <li>Accrued rights and obligations survive termination</li>
                  <li>Sections 5, 8, 9, 10, and 12 survive termination</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          {/* Section 12: General Provisions */}
          <section id="general">
            <div className="flex items-center gap-3 mb-4">
              <Gavel className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">12. General Provisions</h2>
            </div>
            
            <div className="space-y-6 pl-9">
              <div>
                <h3 className="font-semibold text-foreground mb-2">12.1 Governing Law</h3>
                <p>
                  This Agreement is governed by the laws of the State of Delaware, USA, without regard to conflict of laws principles. 
                  Any disputes shall be resolved exclusively in the state or federal courts located in Delaware.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">12.2 Dispute Resolution</h3>
                <p>
                  Before initiating litigation, the parties agree to attempt resolution through good faith negotiation. 
                  Enterprise customers may elect binding arbitration under AAA Commercial Arbitration Rules.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">12.3 Assignment</h3>
                <p>
                  Customer may not assign this Agreement without Provider's prior written consent. Provider may assign this 
                  Agreement in connection with a merger, acquisition, or sale of assets.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">12.4 Notices</h3>
                <p>
                  Notices shall be in writing and sent to the addresses specified in the Order Form or Customer's account. 
                  Notices are effective upon receipt. Provider may provide notices via email or in-app notification.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">12.5 Force Majeure</h3>
                <p>
                  Neither party shall be liable for delays or failures caused by circumstances beyond its reasonable control, 
                  including natural disasters, war, terrorism, labor disputes, government actions, or internet failures.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">12.6 Modifications</h3>
                <p>
                  Provider may modify this Agreement upon 30 days' notice. Continued use after the effective date constitutes 
                  acceptance. Material changes require affirmative consent. Current terms are always available at this URL.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">12.7 Severability</h3>
                <p>
                  If any provision is held unenforceable, the remaining provisions continue in full force. The unenforceable 
                  provision shall be modified to the minimum extent necessary to make it enforceable.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">12.8 Entire Agreement</h3>
                <p>
                  This Agreement, including all Order Forms and policies incorporated by reference, constitutes the entire 
                  agreement between the parties and supersedes all prior agreements and understandings.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">12.9 Waiver</h3>
                <p>
                  Failure to enforce any provision does not constitute a waiver of future enforcement. Waivers must be in 
                  writing and signed by the waiving party.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Contact Section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Contact Information</h2>
            </div>
            
            <div className="pl-9 space-y-4">
              <p>For questions about this Agreement or to request additional documentation:</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-foreground">Legal Inquiries</p>
                  <a href={`mailto:${COMPANY_INFO.emails.support}`} className="text-primary hover:underline">
                    {COMPANY_INFO.emails.support}
                  </a>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Collections Support</p>
                  <a href={`mailto:${COMPANY_INFO.emails.collections}`} className="text-primary hover:underline">
                    {COMPANY_INFO.emails.collections}
                  </a>
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground">Mailing Address</p>
                <p>{COMPANY_INFO.legalName}</p>
                <p>{COMPANY_INFO.address.full}</p>
              </div>
            </div>
          </section>

          {/* Important Reminder Box */}
          <div className="mt-12 p-6 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground mb-2">Important Legal Notice</p>
                <p className="text-sm">
                  {COMPANY_INFO.displayName} is software designed to help you manage your own collection activities. 
                  {COMPANY_INFO.legalName} is <strong>not a collection agency</strong> and does not collect debts on your behalf. 
                  You remain responsible for all communications sent through the platform and must ensure compliance with all 
                  applicable laws and regulations. This Agreement does not create an attorney-client relationship. 
                  Consult with qualified legal counsel regarding your specific compliance obligations.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-muted-foreground pt-8 border-t">
            <p>© {currentYear} {COMPANY_INFO.legalName}. All rights reserved.</p>
            <p className="mt-1">{COMPANY_INFO.address.full}</p>
            <p className="mt-2">
              <a href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</a>
              {" · "}
              <a href="/legal/cookies" className="text-primary hover:underline">Cookie Policy</a>
              {" · "}
              <a href="/security-public" className="text-primary hover:underline">Security</a>
            </p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default Terms;
