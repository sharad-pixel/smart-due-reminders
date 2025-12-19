import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateBrandedEmail, getEmailFromAddress } from "../_shared/emailSignature.ts";
import { getOutreachContacts } from "../_shared/contactUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform email configuration
const PLATFORM_INBOUND_DOMAIN = "inbound.services.recouply.ai";

interface Invoice {
  id?: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  issue_date: string;
  status: string;
}

interface Task {
  id: string;
  summary: string;
  task_type: string;
  status: string;
  priority: string;
}

interface AttachedLink {
  label: string;
  url: string;
}

interface RequestBody {
  debtorId: string;
  generateOnly?: boolean;
  subject?: string;
  message?: string;
  invoices: Invoice[];
  openTasks?: Task[];
  attachedLinks?: AttachedLink[];
  attachedDocs?: any[];
  paymentUrl?: string;
}

const logStep = (step: string, details?: any) => {
  console.log(`[AI-OUTREACH] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { 
      debtorId, 
      generateOnly, 
      subject, 
      message, 
      invoices, 
      openTasks,
      attachedLinks = [], 
      attachedDocs = [], 
      paymentUrl 
    }: RequestBody = await req.json();

    logStep("Request received", { debtorId, generateOnly, invoiceCount: invoices?.length, taskCount: openTasks?.length });

    // Fetch debtor details
    const { data: debtor, error: debtorError } = await supabase
      .from("debtors")
      .select("*")
      .eq("id", debtorId)
      .single();

    if (debtorError || !debtor) {
      throw new Error("Debtor not found");
    }

    // Get effective account ID (for team member support)
    const { data: effectiveAccountId } = await supabase.rpc('get_effective_account_id', { p_user_id: user.id });
    const brandingOwnerId = effectiveAccountId || user.id;

    // Fetch user's branding settings (using effective account)
    const { data: branding, error: brandingError } = await supabase
      .from("branding_settings")
      .select("business_name, from_name, from_email, reply_to_email, email_signature, email_footer, logo_url, primary_color, ar_page_public_token, ar_page_enabled, stripe_payment_link")
      .eq("user_id", brandingOwnerId)
      .single();

    if (brandingError && brandingError.code !== "PGRST116") {
      logStep("Error fetching branding settings", brandingError);
    }

    const brandingSettings = branding || {
      business_name: "Recouply.ai",
      from_name: null,
      from_email: null,
      reply_to_email: null,
      email_signature: null,
      email_footer: null,
      logo_url: null,
      primary_color: "#1e3a5f",
      ar_page_public_token: null,
      ar_page_enabled: false,
      stripe_payment_link: null,
    };

    // Check if we need to generate AI content (either generateOnly OR no subject/message provided)
    const needsAIGeneration = generateOnly || (!subject && !message);
    
    let generatedSubject = subject;
    let generatedMessage = message;
    let intelligenceReport: any = null;
    let intelligenceGeneratedAt: string | null = null;
    let contextSummary: any = null;
    
    if (needsAIGeneration) {
      logStep("Generating AI outreach content with intelligence report", { generateOnly, hasSubject: !!subject, hasMessage: !!message });
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }

      // First, check if we have a cached intelligence report that's less than 24 hours old
      const CACHE_DURATION_HOURS = 24;
      let usedCachedReport = false;

      const cachedReport = debtor.intelligence_report;
      const cachedAt = debtor.intelligence_report_generated_at;

      if (cachedReport && cachedAt) {
        const cacheAge = Date.now() - new Date(cachedAt).getTime();
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);
        
        if (cacheAgeHours < CACHE_DURATION_HOURS) {
          logStep("Using cached intelligence report", { cacheAgeHours: cacheAgeHours.toFixed(1) });
          intelligenceReport = cachedReport;
          intelligenceGeneratedAt = cachedAt;
          usedCachedReport = true;
        }
      }

      // Fetch context data for outreach generation
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("*")
        .eq("debtor_id", debtorId)
        .eq("is_archived", false);

      const invoiceIds = invoicesData?.map(i => i.id) || [];
      let payments: any[] = [];
      if (invoiceIds.length > 0) {
        const { data: paymentLinks } = await supabase
          .from("payment_invoice_links")
          .select("*, payments(*)")
          .in("invoice_id", invoiceIds);
        payments = paymentLinks?.map(pl => pl.payments).filter(Boolean) || [];
      }

      const { data: tasks } = await supabase
        .from("collection_tasks")
        .select("*")
        .eq("debtor_id", debtorId)
        .order("created_at", { ascending: false });

      const { data: inboundEmails } = await supabase
        .from("inbound_emails")
        .select("*")
        .eq("debtor_id", debtorId)
        .order("received_at", { ascending: false })
        .limit(10);

      const { data: contacts } = await supabase
        .from("debtor_contacts")
        .select("*")
        .eq("debtor_id", debtorId);

      // Calculate metrics for intelligence (if we need to generate a new report)
      const openInvoicesForReport = invoicesData?.filter(i => ["Open", "PartiallyPaid", "InPaymentPlan"].includes(i.status)) || [];
      const totalOpenBalance = openInvoicesForReport.reduce((sum, inv) => sum + (inv.outstanding_amount || inv.amount || 0), 0);
      
      const paidInvoices = invoicesData?.filter(i => i.status === "Paid" && i.paid_at) || [];
      let avgDSO = 0;
      if (paidInvoices.length > 0) {
        const dsoValues = paidInvoices.map(inv => {
          const dueDate = new Date(inv.due_date);
          const paidDate = new Date(inv.paid_at);
          return Math.max(0, Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        });
        avgDSO = Math.round(dsoValues.reduce((a, b) => a + b, 0) / dsoValues.length);
      }

      const openTasksList = tasks?.filter(t => t.status === "open") || [];
      const completedTasks = tasks?.filter(t => t.status === "done") || [];
      const overdueTasks = openTasksList.filter(t => t.due_date && new Date(t.due_date) < new Date());

      // If no cached report, generate a new one
      if (!intelligenceReport) {
        logStep("Generating new intelligence report via AI");

        const contextData = {
          account: {
            name: debtor.company_name || debtor.name,
            type: debtor.type,
            paymentScore: debtor.payment_score,
            riskTier: debtor.payment_risk_tier || debtor.risk_tier,
            avgDaysToPay: debtor.avg_days_to_pay,
            creditLimit: debtor.credit_limit
          },
          financials: {
            totalOpenBalance,
            openInvoicesCount: openInvoicesForReport.length,
            totalInvoicesCount: invoicesData?.length || 0,
            paidInvoicesCount: paidInvoices.length,
            avgDSO,
            disputedCount: debtor.disputed_invoices_count || 0,
            writtenOffCount: debtor.written_off_invoices_count || 0
          },
          tasks: {
            openCount: openTasksList.length,
            completedCount: completedTasks.length,
            overdueCount: overdueTasks.length,
            recentTypes: tasks?.slice(0, 5).map(t => t.task_type) || []
          },
          communications: {
            inboundCount: inboundEmails?.length || 0,
            recentSentiments: inboundEmails?.slice(0, 5).map(e => ({
              date: e.received_at,
              subject: e.subject,
              sentiment: e.sentiment || "unknown",
              category: e.category,
              priority: e.priority
            })) || [],
            lastContactDate: inboundEmails?.[0]?.received_at || null
          },
          contacts: contacts?.map(c => ({
            name: c.name,
            title: c.title,
            outreachEnabled: c.outreach_enabled,
            isPrimary: c.is_primary
          })) || [],
          paymentHistory: payments.slice(0, 10).map(p => ({
            date: p.payment_date,
            amount: p.amount,
            method: p.payment_method
          }))
        };

        const intelligenceSystemPrompt = `You are a Collection Intelligence analyst for RecouplyAI. Analyze account data and provide actionable intelligence reports.

Your reports should be:
- Concise and actionable
- Risk-focused with clear recommendations
- Based on the data provided
- Written in a professional tone

Structure your response as JSON with these fields:
- riskLevel: "low" | "medium" | "high" | "critical"
- riskScore: number 0-100 (100 = highest risk)
- executiveSummary: 2-3 sentence overview
- keyInsights: array of 3-5 bullet point insights
- recommendations: array of 2-3 specific action items
- paymentBehavior: brief assessment of payment patterns
- communicationSentiment: assessment of customer engagement/sentiment
- collectionStrategy: recommended approach for this account`;

        const intelligenceUserPrompt = `Generate a Collection Intelligence Report for this account:

${JSON.stringify(contextData, null, 2)}

Provide your analysis as a JSON object.`;

        const intelligenceResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: intelligenceSystemPrompt },
              { role: "user", content: intelligenceUserPrompt }
            ],
          }),
        });

        if (intelligenceResponse.ok) {
          const intelligenceData = await intelligenceResponse.json();
          const intelligenceContent = intelligenceData.choices?.[0]?.message?.content || "";
          
          try {
            const jsonMatch = intelligenceContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                              intelligenceContent.match(/```\s*([\s\S]*?)\s*```/) ||
                              [null, intelligenceContent];
            intelligenceReport = JSON.parse(jsonMatch[1] || intelligenceContent);
            intelligenceGeneratedAt = new Date().toISOString();
            logStep("Intelligence report generated", { riskLevel: intelligenceReport.riskLevel, riskScore: intelligenceReport.riskScore });

            // Cache the new report
            await supabase
              .from("debtors")
              .update({
                intelligence_report: intelligenceReport,
                intelligence_report_generated_at: intelligenceGeneratedAt
              })
              .eq("id", debtorId);

          } catch (parseError) {
            logStep("Failed to parse intelligence report, using defaults", parseError);
          }
        } else {
          const status = intelligenceResponse.status;
          if (status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          logStep("Intelligence report generation failed", { status });
        }
      }

      // Now generate the outreach email using the intelligence report
      // CRITICAL: Use database-fetched invoices (invoicesData) NOT request body invoices
      // This ensures consistency between intelligence report and outreach email
      const openInvoicesForOutreach = invoicesData?.filter(i => 
        ["Open", "PartiallyPaid", "InPaymentPlan", "Overdue"].includes(i.status)
      ) || [];
      const totalOutstanding = openInvoicesForOutreach.reduce((sum, inv) => 
        sum + (inv.outstanding_amount || inv.amount || 0), 0
      );
      const highPriorityTasks = openTasks?.filter(t => t.priority === "high") || [];

      // Build context summary including intelligence insights
      contextSummary = {
        accountName: debtor.company_name,
        contactName: debtor.name,
        totalOutstanding,
        invoiceCount: openInvoicesForOutreach.length,
        allInvoicesCount: invoicesData?.length || 0,
        oldestInvoiceDue: openInvoicesForOutreach.length > 0 
          ? openInvoicesForOutreach.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]?.due_date 
          : null,
        openTaskCount: openTasks?.length || 0,
        highPriorityTaskCount: highPriorityTasks.length,
        taskTypes: [...new Set(openTasks?.map(t => t.task_type) || [])],
        recentPayments: payments?.slice(0, 3) || [],
        recentCommunications: inboundEmails?.slice(0, 3) || [],
        riskTier: debtor.risk_tier || "unknown",
        paymentScore: debtor.payment_score || null,
        avgDaysToPay: debtor.avg_days_to_pay || null,
        // Add intelligence report insights
        intelligence: intelligenceReport,
        // Store actual invoices for prompt
        invoices: openInvoicesForOutreach
      };

      logStep("Context for AI outreach", { hasIntelligence: !!intelligenceReport });

      // Build the outreach prompt with intelligence report guidance
      const intelligenceGuidance = intelligenceReport ? `
COLLECTION INTELLIGENCE REPORT:
- Risk Level: ${intelligenceReport.riskLevel} (Score: ${intelligenceReport.riskScore}/100)
- Executive Summary: ${intelligenceReport.executiveSummary}
- Payment Behavior: ${intelligenceReport.paymentBehavior}
- Communication Sentiment: ${intelligenceReport.communicationSentiment}
- Recommended Strategy: ${intelligenceReport.collectionStrategy}
- Key Insights: ${intelligenceReport.keyInsights?.join("; ") || "None"}
- Recommended Actions: ${intelligenceReport.recommendations?.join("; ") || "None"}

CRITICAL TONE GUIDANCE based on intelligence:
${intelligenceReport.riskLevel === "low" ? "- Use a friendly, appreciative tone. Acknowledge their good payment history. Frame this as a gentle reminder." : ""}
${intelligenceReport.riskLevel === "medium" ? "- Use a professional, balanced tone. Be courteous but clear about the importance of resolving the balance." : ""}
${intelligenceReport.riskLevel === "high" ? "- Use a firm but professional tone. Emphasize urgency without being aggressive. Focus on resolution options." : ""}
${intelligenceReport.riskLevel === "critical" ? "- Use a direct, serious tone. Clearly state the consequences of non-payment. Offer immediate resolution paths." : ""}
${intelligenceReport.communicationSentiment?.toLowerCase().includes("negative") ? "- Customer sentiment is negative. Be extra diplomatic and focus on problem-solving." : ""}
${intelligenceReport.communicationSentiment?.toLowerCase().includes("positive") ? "- Customer has shown positive engagement. Leverage this relationship." : ""}
` : "";

      const systemPrompt = `You are a professional collections specialist crafting personalized outreach for accounts receivable. 
Your tone should be tailored based on the Collection Intelligence Report provided.

Guidelines:
- CRITICALLY IMPORTANT: Match your tone to the intelligence report's risk level and recommended strategy
- Reference specific open invoices and their amounts
- If there are open tasks (like disputes, payment plan requests, document requests), acknowledge them
- If payment history exists, acknowledge their past payments positively
- If there are high-priority tasks, address them directly
- Always include a clear call to action aligned with the recommended strategy
- Keep the message concise but comprehensive
- Do not include placeholder text - use the actual data provided
- Sign off professionally

${intelligenceGuidance}

Company name for signature: ${brandingSettings.business_name || "Collections Team"}`;

      const userPrompt = `Generate a professional collection outreach email for this account:

ACCOUNT DETAILS:
- Company: ${contextSummary.accountName}
- Contact: ${contextSummary.contactName}
- Total Outstanding: $${contextSummary.totalOutstanding.toLocaleString()}
- Open Invoices: ${contextSummary.invoiceCount}
- Risk Tier: ${contextSummary.riskTier}
- Payment Score: ${contextSummary.paymentScore || "Not calculated"}
- Avg Days to Pay: ${contextSummary.avgDaysToPay || "Unknown"}

OPEN INVOICES:
${contextSummary.invoices?.map((inv: any) => `- Invoice #${inv.invoice_number}: $${(inv.outstanding_amount || inv.amount || 0).toLocaleString()} (Due: ${inv.due_date}, Status: ${inv.status})`).join('\n') || "None"}

OPEN TASKS/ISSUES:
${openTasks?.map(t => `- [${t.priority.toUpperCase()}] ${t.task_type}: ${t.summary}`).join('\n') || "None"}

RECENT PAYMENTS:
${payments?.map(p => `- $${p.amount.toLocaleString()} on ${p.payment_date}`).join('\n') || "No recent payments"}

RECENT COMMUNICATIONS:
${inboundEmails?.map(e => `- ${e.subject}: ${e.ai_summary || "No summary"} (Sentiment: ${e.sentiment || "neutral"})`).join('\n') || "No recent communications"}

IMPORTANT INSTRUCTIONS:
- Use the ACCOUNT DETAILS above as the source of truth for financial data
- Generate a professional collection email based on the risk level and data provided
- Do NOT refuse to generate the email or claim data inconsistencies
- Adjust tone based on risk tier: low=friendly, medium=professional, high=firm, critical=urgent

Generate a JSON response with:
{
  "subject": "Email subject line",
  "message": "Full email body (no HTML, use line breaks)"
}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`AI API error: ${status}`);
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content;
      
      logStep("AI outreach response received", { contentLength: content?.length });

      // Parse the AI response
      let parsedSubject = `Account Outreach - ${debtor.company_name}`;
      let parsedMessage = "";

      try {
        // Try to parse as JSON first
        const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanedContent);
        parsedSubject = parsed.subject || parsedSubject;
        parsedMessage = parsed.message || content;
      } catch {
        // If not JSON, use the raw content
        parsedMessage = content;
      }

      // Assign to outer variables
      generatedSubject = parsedSubject;
      generatedMessage = parsedMessage;

      // If generateOnly, return the generated content without sending
      if (generateOnly) {
        return new Response(
          JSON.stringify({ 
            subject: generatedSubject, 
            message: generatedMessage,
            context: contextSummary,
            intelligence: intelligenceReport,
            intelligenceGeneratedAt
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      logStep("AI content generated, proceeding to send", { subject: generatedSubject?.substring(0, 50) });
    }

    // If not generateOnly, proceed with sending the email
    // Get all outreach-enabled contacts with fallback to debtor record
    const outreachContactsResult = await getOutreachContacts(supabase, debtorId, debtor);
    const allEmails = outreachContactsResult.emails;
    
    if (allEmails.length === 0) {
      throw new Error("No outreach-enabled contact with email found. Please add a contact with email and enable outreach.");
    }

    logStep("Sending outreach email", { to: allEmails.join(', '), recipientCount: allEmails.length });

    // Generate From address using company branding with Recouply.ai fallback
    const fromEmail = getEmailFromAddress(brandingSettings);
    
    // Use platform reply-to address based on debtor for inbound routing
    const replyToAddress = `debtor+${debtorId}@${PLATFORM_INBOUND_DOMAIN}`;

    const primaryColor = brandingSettings.primary_color || "#1e3a5f";
    const totalAmount = invoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0;

    // Build invoice table HTML
    let invoiceTableHtml = "";
    if (invoices && invoices.length > 0) {
      invoiceTableHtml = `
        <h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 16px; font-weight: 600; color: #1e293b;">Open Invoices</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: linear-gradient(135deg, ${primaryColor} 0%, #2d5a87 100%);">
              <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-weight: 600;">Invoice #</th>
              <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-weight: 600;">Issue Date</th>
              <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-weight: 600;">Due Date</th>
              <th style="padding: 12px 16px; text-align: right; color: #ffffff; font-weight: 600;">Amount</th>
              <th style="padding: 12px 16px; text-align: left; color: #ffffff; font-weight: 600;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.map((inv, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #1e293b;">${inv.invoice_number}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${new Date(inv.issue_date).toLocaleDateString()}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${new Date(inv.due_date).toLocaleDateString()}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1e293b;">$${inv.amount.toLocaleString()}</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                  <span style="padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 500; ${inv.status === 'Open' ? 'background-color: #fef3c7; color: #92400e;' : 'background-color: #ddd6fe; color: #5b21b6;'}">
                    ${inv.status}
                  </span>
                </td>
              </tr>
            `).join('')}
            <tr style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);">
              <td colspan="3" style="padding: 14px 16px; text-align: right; font-weight: 700; color: #1e293b;">Total Outstanding:</td>
              <td style="padding: 14px 16px; text-align: right; font-weight: 700; color: #1e293b; font-size: 18px;">$${totalAmount.toLocaleString()}</td>
              <td style="padding: 14px 16px;"></td>
            </tr>
          </tbody>
        </table>
      `;
    }

    // Build links HTML
    let linksHtml = "";
    if (attachedLinks && attachedLinks.length > 0) {
      linksHtml = `
        <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1e293b;">Helpful Links</h3>
          <ul style="list-style-type: none; padding: 0; margin: 0;">
            ${attachedLinks.map(link => `
              <li style="margin-bottom: 8px;">
                <a href="${link.url}" style="color: #2563eb; text-decoration: none; font-weight: 500;">
                  🔗 ${link.label}
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    // Build email content body with message, invoice table, and links
    const emailContent = `
      <div style="white-space: pre-wrap; line-height: 1.6; color: #374151;">
        ${(generatedMessage || "").replace(/\n/g, '<br>')}
      </div>
      ${invoiceTableHtml}
      ${linksHtml}
    `;

    // Generate fully branded email HTML using shared template (uses Recouply.ai fallback)
    const emailHtml = generateBrandedEmail(
      emailContent,
      brandingSettings,
      {
        paymentUrl: paymentUrl,
        amount: totalAmount,
      }
    );

    logStep(`Sending branded email via platform from ${fromEmail} to ${allEmails.join(', ')}`);

    // Send to ALL outreach-enabled contacts
    const sendEmailResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          to: allEmails, // Send to all outreach-enabled contacts
          from: fromEmail,
          reply_to: replyToAddress,
          subject: generatedSubject,
          html: emailHtml,
        }),
      }
    );

    const emailResult = await sendEmailResponse.json();

    if (!sendEmailResponse.ok) {
      throw new Error(`Failed to send email: ${emailResult.error || "Unknown error"}`);
    }

    logStep("Email sent via platform", emailResult);

    // Log to collection_activities for audit trail - classified as account_level_outreach
    const { data: activity, error: logError } = await supabase.from("collection_activities").insert({
      user_id: user.id,
      debtor_id: debtorId,
      activity_type: "account_level_outreach",
      channel: "email",
      direction: "outbound",
      subject: generatedSubject,
      message_body: generatedMessage,
      sent_at: new Date().toISOString(),
      metadata: {
        outreach_type: "account_level_outreach",
        invoice_count: invoices?.length || 0,
        total_amount: totalAmount,
        invoices_included: invoices?.map(inv => ({
          invoice_number: inv.invoice_number,
          amount: inv.amount,
          due_date: inv.due_date,
          status: inv.status
        })) || [],
        task_count: openTasks?.length || 0,
        attached_links: attachedLinks?.length || 0,
        reply_to: replyToAddress,
        sent_to: allEmails,
        from_email: fromEmail,
        platform_send: true,
        branding_applied: !!branding,
        from_name: brandingSettings.business_name || 'Recouply.ai',
        payment_url: paymentUrl || null,
        ai_generated: true,
        branded: true,
        intelligence_report: intelligenceReport ? {
          risk_level: intelligenceReport.riskLevel,
          risk_score: intelligenceReport.riskScore,
          strategy: intelligenceReport.collectionStrategy
        } : null,
      },
    }).select().single();

    if (logError) {
      logStep("Failed to log activity", logError);
    }

    // Log to outreach_logs so responses can be linked
    if (invoices && invoices.length > 0 && invoices[0].invoice_number) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id")
        .eq("invoice_number", invoices[0].invoice_number)
        .eq("debtor_id", debtorId)
        .single();

      if (invoice) {
        const { error: outreachError } = await supabase.from("outreach_logs").insert({
          user_id: user.id,
          debtor_id: debtorId,
          invoice_id: invoice.id,
          channel: "email",
          subject: generatedSubject,
          message_body: generatedMessage,
          sent_to: allEmails.join(', '),
          sent_from: fromEmail,
          sent_at: new Date().toISOString(),
          status: "sent",
          delivery_metadata: {
            activity_id: activity?.id,
            type: "account_level_outreach",
            invoice_count: invoices?.length || 0,
            task_count: openTasks?.length || 0,
            reply_to: replyToAddress,
            platform_send: true,
            branding_applied: !!branding,
            payment_url: paymentUrl || null,
            ai_generated: true,
          },
        });

        if (outreachError) {
          logStep("Failed to log outreach", outreachError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "AI outreach sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-account-summary:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
