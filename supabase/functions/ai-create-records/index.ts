import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[AI-CREATE-RECORDS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    const { 
      debtor_choice, 
      debtor_existing_id, 
      debtor_data, 
      invoice_list,
      raw_prompt,
      structured_json
    } = await req.json();

    if (!debtor_choice || !invoice_list) {
      throw new Error("Invalid request data");
    }

    logStep("Request data received", { debtorChoice: debtor_choice, invoiceCount: invoice_list.length });

    let debtorId;

    // Handle debtor creation/selection
    if (debtor_choice === "use_existing") {
      if (!debtor_existing_id) {
        throw new Error("Existing debtor ID required when using existing debtor");
      }
      debtorId = debtor_existing_id;
      logStep("Using existing debtor", { debtorId });
    } else {
      // Create new debtor
      if (!debtor_data.name && !debtor_data.company_name) {
        throw new Error("Debtor name or company name is required");
      }

      const { data: newDebtor, error: debtorError } = await supabaseClient
        .from("debtors")
        .insert({
          user_id: user.id,
          name: debtor_data.name || debtor_data.company_name,
          company_name: debtor_data.company_name || debtor_data.name,
          contact_name: debtor_data.name || "",
          email: debtor_data.email || "",
          phone: debtor_data.phone || "",
          notes: debtor_data.notes || ""
        })
        .select()
        .single();

      if (debtorError) {
        logStep("Debtor creation error", debtorError);
        throw new Error(`Failed to create debtor: ${debtorError.message}`);
      }

      debtorId = newDebtor.id;
      logStep("New debtor created", { debtorId });
    }

    // Get user's plan to check for line item permission
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("plan_type")
      .eq("id", user.id)
      .single();

    const userPlan = profileData?.plan_type || "free";
    const canUseLineItems = userPlan === "pro";

    // Create invoices
    const createdInvoiceIds: string[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const invoice of invoice_list) {
      const hasLineItems = invoice.line_items && invoice.line_items.length > 0;

      // Validate required fields
      if (!hasLineItems && (!invoice.amount || invoice.amount <= 0)) {
        throw new Error("Invoice amount or line items are required");
      }
      if (!invoice.due_date && !invoice.payment_terms_days) {
        throw new Error("Invoice due date or payment terms are required");
      }

      // Check line item permission
      if (hasLineItems && !canUseLineItems) {
        throw new Error("Invoice line items are available on the Professional plan only");
      }

      // Calculate amounts from line items if present
      let subtotal = 0;
      let totalAmount = invoice.amount || 0;
      if (hasLineItems && canUseLineItems) {
        subtotal = invoice.line_items.reduce((sum: number, item: any) => {
          return sum + (item.quantity * item.unit_price);
        }, 0);
        totalAmount = subtotal + (invoice.tax_amount || 0);
      }

      // Calculate due date from payment terms if not provided
      let dueDate = invoice.due_date;
      if (!dueDate && invoice.payment_terms_days) {
        const issueDate = new Date(invoice.issue_date || today);
        issueDate.setDate(issueDate.getDate() + invoice.payment_terms_days);
        dueDate = issueDate.toISOString().split('T')[0];
      }

      // Generate invoice number if missing
      let invoiceNumber = invoice.invoice_number;
      if (!invoiceNumber || invoiceNumber.trim() === "") {
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        invoiceNumber = `AI-${today.replace(/-/g, '')}-${randomSuffix}`;
      }

      const { data: newInvoice, error: invoiceError } = await supabaseClient
        .from("invoices")
        .insert({
          user_id: user.id,
          debtor_id: debtorId,
          invoice_number: invoiceNumber,
          amount: hasLineItems ? totalAmount : invoice.amount,
          currency: invoice.currency || "USD",
          issue_date: invoice.issue_date || today,
          due_date: dueDate,
          payment_terms: invoice.payment_terms || null,
          payment_terms_days: invoice.payment_terms_days || null,
          subtotal: hasLineItems ? subtotal : null,
          tax_amount: invoice.tax_amount || 0,
          total_amount: hasLineItems ? totalAmount : invoice.amount,
          external_link: invoice.external_link || null,
          notes: invoice.notes || null,
          status: "Open"
        })
        .select()
        .single();

      if (invoiceError) {
        logStep("Invoice creation error", invoiceError);
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      createdInvoiceIds.push(newInvoice.id);

      // Create line items if present and allowed
      if (hasLineItems && canUseLineItems) {
        const lineItemsToInsert = invoice.line_items.map((item: any, index: number) => ({
          invoice_id: newInvoice.id,
          user_id: user.id,
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price,
          line_total: (item.quantity || 1) * item.unit_price,
          sort_order: index
        }));

        const { error: lineItemsError } = await supabaseClient
          .from("invoice_line_items")
          .insert(lineItemsToInsert);

        if (lineItemsError) {
          logStep("Line items creation error", lineItemsError);
          // Non-blocking, invoice already created
        }
      }

      // Track invoice usage
      try {
        await supabaseClient.functions.invoke('track-invoice-usage', {
          body: { invoice_id: newInvoice.id }
        });
      } catch (usageError) {
        logStep("Usage tracking error (non-blocking)", usageError);
      }
    }

    logStep("Invoices created", { count: createdInvoiceIds.length });

    // Create audit trail
    try {
      await supabaseClient
        .from("ai_creations")
        .insert({
          user_id: user.id,
          raw_prompt: raw_prompt || "",
          structured_json: structured_json || {},
          created_debtor_id: debtor_choice === "create_new" ? debtorId : null,
          created_invoice_ids: createdInvoiceIds
        });
      logStep("Audit trail created");
    } catch (auditError) {
      logStep("Audit trail error (non-blocking)", auditError);
    }

    return new Response(JSON.stringify({
      created: true,
      created_debtor_id: debtorId,
      created_invoice_ids: createdInvoiceIds
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});