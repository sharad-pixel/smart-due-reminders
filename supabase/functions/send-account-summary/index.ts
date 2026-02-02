import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEmailFromAddress } from "../_shared/emailSignature.ts";
import { renderEmail, getSenderIdentity, BrandingConfig } from "../_shared/renderBrandedEmail.ts";
import { getOutreachContacts } from "../_shared/contactUtils.ts";
import { personaTones, toneIntensityModifiers } from "../_shared/personaTones.ts";

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
      .select("business_name, from_name, from_email, reply_to_email, email_signature, email_footer, footer_disclaimer, logo_url, primary_color, accent_color, ar_page_public_token, ar_page_enabled, stripe_payment_link, email_format, email_wrapper_enabled, sending_mode, from_email_verified, verified_from_email")
      .eq("user_id", brandingOwnerId)
      .single();

    if (brandingError && brandingError.code !== "PGRST116") {
      logStep("Error fetching branding settings", brandingError);
    }

    const brandingSettings = branding || {
      business_name: "Recouply.ai",
      from_name: undefined,
      from_email: undefined,
      reply_to_email: undefined,
      email_signature: undefined,
      email_footer: undefined,
      footer_disclaimer: undefined,
      logo_url: undefined,
      primary_color: "#1e3a5f",
      accent_color: undefined,
      ar_page_public_token: undefined,
      ar_page_enabled: false,
      stripe_payment_link: undefined,
      email_format: 'simple' as const,
      email_wrapper_enabled: true,
      sending_mode: undefined,
      from_email_verified: undefined,
      verified_from_email: undefined,
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

      // Get user-selected persona and tone intensity from debtor settings
      const selectedPersonaKey = debtor.account_outreach_persona || 'sam';
      const selectedToneIntensity = debtor.account_outreach_tone || 3;
      const selectedPersona = personaTones[selectedPersonaKey] || personaTones.sam;
      const toneModifier = toneIntensityModifiers[selectedToneIntensity] || toneIntensityModifiers[3];
      
      logStep("Using selected persona and tone", { 
        persona: selectedPersonaKey, 
        toneIntensity: selectedToneIntensity,
        toneLabel: toneModifier.label 
      });

      // Build the outreach prompt with intelligence report guidance AND user-selected persona/tone
      const intelligenceGuidance = intelligenceReport ? `
COLLECTION INTELLIGENCE REPORT (for context only):
- Risk Level: ${intelligenceReport.riskLevel} (Score: ${intelligenceReport.riskScore}/100)
- Executive Summary: ${intelligenceReport.executiveSummary}
- Payment Behavior: ${intelligenceReport.paymentBehavior}
- Communication Sentiment: ${intelligenceReport.communicationSentiment}
- Key Insights: ${intelligenceReport.keyInsights?.join("; ") || "None"}

NOTE: Use this intelligence for context, but follow the PERSONA INSTRUCTIONS below for tone.
` : "";

      // Apply tone intensity modifier
      const toneIntensityGuidance = toneModifier.modifier ? `
${toneModifier.modifier}
` : "";

      const systemPrompt = `${selectedPersona.systemPromptGuidelines}

${toneIntensityGuidance}

${intelligenceGuidance}

IMPORTANT FOR ACCOUNT-LEVEL OUTREACH:
- This is an account-level summary covering ALL open invoices
- Reference the total outstanding balance and invoice count
- If there are open tasks (disputes, payment plans), acknowledge them
- If there's positive payment history, acknowledge it
- Keep the message focused on the account as a whole

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
- Generate a professional collection email following the persona guidelines in the system prompt
- Do NOT refuse to generate the email or claim data inconsistencies
- Follow the selected persona (${selectedPersona.name}) and tone intensity (${toneModifier.label}) exactly
- Do NOT auto-escalate tone based on days past due - use ONLY the configured persona

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

      // If generateOnly, save draft to ai_drafts table and return
      if (generateOnly) {
        // Save the generated draft to ai_drafts for review
        const { data: savedDraft, error: draftError } = await supabase
          .from("ai_drafts")
          .insert({
            user_id: user.id,
            invoice_id: null, // Account-level, not tied to single invoice
            channel: "email",
            step_number: 1,
            subject: generatedSubject,
            message_body: generatedMessage,
            status: "pending_approval",
            auto_approved: false,
            days_past_due: 0,
            applied_brand_snapshot: {
              type: "account_level_outreach",
              debtor_id: debtorId,
              debtor_name: debtor.company_name || debtor.name,
              context: contextSummary,
              intelligence: intelligenceReport,
              invoice_count: invoices?.length || 0,
              total_amount: invoices?.reduce((sum, inv) => sum + inv.amount, 0) || 0,
            },
          })
          .select()
          .single();

        if (draftError) {
          logStep("Failed to save draft", draftError);
        } else {
          logStep("Draft saved to ai_drafts", { draftId: savedDraft?.id });
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            draftId: savedDraft?.id,
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

    // Build branded email using the same format as invoice workflow (respects email_format setting)
    const brandingConfig: BrandingConfig = {
      business_name: brandingSettings.business_name,
      from_name: brandingSettings.from_name || undefined,
      logo_url: brandingSettings.logo_url || undefined,
      primary_color: brandingSettings.primary_color || undefined,
      accent_color: brandingSettings.accent_color || undefined,
      email_signature: brandingSettings.email_signature || undefined,
      email_footer: brandingSettings.email_footer || undefined,
      footer_disclaimer: brandingSettings.footer_disclaimer || undefined,
      email_format: (brandingSettings.email_format as 'simple' | 'enhanced') || 'simple',
      email_wrapper_enabled: brandingSettings.email_wrapper_enabled ?? true,
      ar_page_public_token: brandingSettings.ar_page_public_token || undefined,
      ar_page_enabled: brandingSettings.ar_page_enabled ?? false,
      stripe_payment_link: brandingSettings.stripe_payment_link || undefined,
    };

    // Use renderEmail which respects email_format setting (simple vs enhanced)
    const emailHtml = renderEmail({
      brand: brandingConfig,
      subject: generatedSubject || "",
      bodyHtml: emailContent,
      cta: paymentUrl ? {
        label: `Pay Now${totalAmount ? ` $${totalAmount.toLocaleString()}` : ''}`,
        url: paymentUrl,
      } : undefined,
      meta: {
        debtorId: debtorId,
        templateType: 'account_level_outreach',
      },
    });

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
