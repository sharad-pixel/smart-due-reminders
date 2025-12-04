import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessRequest {
  uploadId: string;
  rows: Record<string, any>[];
  mappings: Record<string, string>;
  fileType: "invoice_aging" | "payments";
}

function parseDate(value: any): string | null {
  if (!value) return null;
  
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  
  if (typeof value === "number") {
    // Excel serial date
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }
  
  return null;
}

function parseNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function normalizeString(str: string): string {
  return (str || "").toLowerCase().trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { uploadId, rows, mappings, fileType }: ProcessRequest = await req.json();

    console.log(`Processing upload ${uploadId}: ${rows.length} rows, fileType: ${fileType}`);

    // Get reverse mapping (field key -> file column)
    const reverseMap: Record<string, string> = {};
    for (const [fileCol, fieldKey] of Object.entries(mappings)) {
      reverseMap[fieldKey] = fileCol;
    }

    const getValue = (row: Record<string, any>, fieldKey: string): any => {
      const fileCol = reverseMap[fieldKey];
      return fileCol ? row[fileCol] : null;
    };

    // Fetch existing customers for matching
    const { data: existingCustomers } = await supabase
      .from("debtors")
      .select("id, company_name, external_customer_id, email")
      .eq("user_id", user.id);

    const customerMap = new Map<string, string>();
    (existingCustomers || []).forEach(c => {
      customerMap.set(normalizeString(c.company_name), c.id);
      if (c.external_customer_id) {
        customerMap.set(normalizeString(c.external_customer_id), c.id);
      }
    });

    let processed = 0;
    let matched = 0;
    let needsReview = 0;
    let errors = 0;
    let newCustomers = 0;
    let existingCustomersCount = 0;
    let newRecords = 0;

    // Insert staging rows
    const stagingRows = rows.map((row, index) => {
      const normalized: Record<string, any> = {};
      for (const [fileCol, fieldKey] of Object.entries(mappings)) {
        normalized[fieldKey] = row[fileCol];
      }
      return {
        upload_id: uploadId,
        row_index: index,
        raw_json: row,
        normalized_json: normalized,
        match_status: "unmatched",
      };
    });

    // Batch insert staging rows
    const { error: stagingError } = await supabase
      .from("data_center_staging_rows")
      .insert(stagingRows);

    if (stagingError) {
      console.error("Staging error:", stagingError);
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Get customer name
        const customerName = String(getValue(row, "customer_name") || "").trim();
        const customerId = getValue(row, "customer_id");
        
        if (!customerName) {
          errors++;
          continue;
        }

        // Find or create customer
        let debtorId: string | null = null;
        
        // Try to match existing customer
        if (customerId) {
          debtorId = customerMap.get(normalizeString(String(customerId))) || null;
        }
        if (!debtorId) {
          debtorId = customerMap.get(normalizeString(customerName)) || null;
        }

        if (debtorId) {
          existingCustomersCount++;
          matched++;
        } else {
          // Create new customer
          const { data: newDebtor, error: debtorError } = await supabase
            .from("debtors")
            .insert({
              user_id: user.id,
              company_name: customerName,
              name: customerName,
              contact_name: String(getValue(row, "contact_name") || customerName),
              email: String(getValue(row, "customer_email") || ""),
              phone: String(getValue(row, "customer_phone") || ""),
              external_customer_id: customerId ? String(customerId) : null,
              reference_id: `RCPLY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            })
            .select()
            .single();

          if (debtorError) {
            console.error("Debtor creation error:", debtorError);
            errors++;
            continue;
          }

          debtorId = newDebtor.id;
          customerMap.set(normalizeString(customerName), debtorId!);
          newCustomers++;
        }

        if (fileType === "invoice_aging") {
          // Create invoice
          const invoiceNumber = String(getValue(row, "invoice_number") || "");
          const invoiceDate = parseDate(getValue(row, "invoice_date"));
          const dueDate = parseDate(getValue(row, "due_date"));
          const amount = parseNumber(getValue(row, "amount_original") || getValue(row, "amount_outstanding"));
          const amountOutstanding = parseNumber(getValue(row, "amount_outstanding") || getValue(row, "amount_original"));

          if (!invoiceNumber || !invoiceDate || !dueDate) {
            errors++;
            continue;
          }

          const { error: invoiceError } = await supabase
            .from("invoices")
            .insert({
              user_id: user.id,
              debtor_id: debtorId,
              invoice_number: invoiceNumber,
              invoice_date: invoiceDate,
              due_date: dueDate,
              amount: amount,
              amount_original: amount,
              amount_outstanding: amountOutstanding,
              currency: String(getValue(row, "currency") || "USD"),
              status: "Open",
              external_invoice_id: getValue(row, "external_invoice_id") ? String(getValue(row, "external_invoice_id")) : null,
              po_number: getValue(row, "po_number") ? String(getValue(row, "po_number")) : null,
              product_description: getValue(row, "product_description") ? String(getValue(row, "product_description")) : null,
              notes: getValue(row, "notes") ? String(getValue(row, "notes")) : null,
              data_center_upload_id: uploadId,
              reference_id: `INV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            } as any);

          if (invoiceError) {
            console.error("Invoice creation error:", invoiceError);
            errors++;
            continue;
          }

          newRecords++;
        } else if (fileType === "payments") {
          // Create payment
          const paymentDate = parseDate(getValue(row, "payment_date"));
          const paymentAmount = parseNumber(getValue(row, "payment_amount"));

          if (!paymentDate || paymentAmount <= 0) {
            errors++;
            continue;
          }

          const { error: paymentError } = await supabase
            .from("payments")
            .insert({
              user_id: user.id,
              debtor_id: debtorId,
              payment_date: paymentDate,
              amount: paymentAmount,
              currency: String(getValue(row, "currency") || "USD"),
              reference: getValue(row, "payment_reference") ? String(getValue(row, "payment_reference")) : null,
              notes: getValue(row, "payment_notes") ? String(getValue(row, "payment_notes")) : null,
              data_center_upload_id: uploadId,
              reconciliation_status: "pending",
            });

          if (paymentError) {
            console.error("Payment creation error:", paymentError);
            errors++;
            continue;
          }

          newRecords++;
        }

        processed++;
      } catch (rowError: any) {
        console.error(`Error processing row ${i}:`, rowError);
        errors++;
      }
    }

    // Update upload status
    const finalStatus = errors > 0 ? "needs_review" : "processed";
    await supabase
      .from("data_center_uploads")
      .update({
        status: finalStatus,
        processed_count: processed,
        matched_count: matched,
        processed_at: new Date().toISOString(),
      })
      .eq("id", uploadId);

    const result = {
      totalRows: rows.length,
      processed,
      matched,
      needsReview,
      errors,
      newCustomers,
      existingCustomers: existingCustomersCount,
      newRecords,
      fileType,
    };

    console.log("Processing complete:", result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Process upload error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
