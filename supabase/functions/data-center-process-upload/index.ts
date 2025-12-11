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
  fileType: "invoice_aging" | "payments" | "accounts";
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
    console.log(`Mappings received:`, JSON.stringify(mappings));

    // Get reverse mapping (field key -> file column)
    const reverseMap: Record<string, string> = {};
    for (const [fileCol, fieldKey] of Object.entries(mappings)) {
      reverseMap[fieldKey] = fileCol;
    }
    console.log(`Reverse map:`, JSON.stringify(reverseMap));

    const getValue = (row: Record<string, any>, fieldKey: string): any => {
      const fileCol = reverseMap[fieldKey];
      if (!fileCol) return null;
      
      // Try exact match first
      if (row[fileCol] !== undefined) {
        return row[fileCol];
      }
      
      // Try case-insensitive match
      const lowerFileCol = fileCol.toLowerCase();
      for (const key of Object.keys(row)) {
        if (key.toLowerCase() === lowerFileCol) {
          return row[key];
        }
      }
      
      return null;
    };
    
    // Log mapping and first row for debugging
    console.log(`Mappings (fileCol -> fieldKey):`, JSON.stringify(mappings));
    console.log(`Reverse map (fieldKey -> fileCol):`, JSON.stringify(reverseMap));
    if (rows.length > 0) {
      console.log(`First row keys:`, Object.keys(rows[0]));
      console.log(`First row values for invoice_number field:`, getValue(rows[0], "invoice_number"));
    }
    // Debug row 1 specifically
    if (rows.length > 1) {
      console.log(`Row 1 ALL data:`, JSON.stringify(rows[1]));
      console.log(`Row 1 invoice_number lookup - fileCol:`, reverseMap["invoice_number"]);
      console.log(`Row 1 direct access rows[1]["Invoice Number"]:`, rows[1]["Invoice Number"]);
      console.log(`Row 1 getValue result:`, getValue(rows[1], "invoice_number"));
    }

    // Fetch existing customers for matching
    const { data: existingCustomers } = await supabase
      .from("debtors")
      .select("id, company_name, external_customer_id, email, reference_id")
      .eq("user_id", user.id);

    console.log(`Found ${existingCustomers?.length || 0} existing customers`);

    const customerMap = new Map<string, string>();
    const customerRefMap = new Map<string, string>(); // reference_id -> id
    (existingCustomers || []).forEach(c => {
      customerMap.set(normalizeString(c.company_name), c.id);
      if (c.external_customer_id) {
        customerMap.set(normalizeString(c.external_customer_id), c.id);
      }
      if (c.reference_id) {
        customerRefMap.set(normalizeString(c.reference_id), c.id);
      }
    });
    
    // Log some sample reference IDs for debugging
    const sampleRefs = Array.from(customerRefMap.keys()).slice(0, 5);
    console.log(`Sample reference IDs in system:`, sampleRefs);

    // Fetch existing invoices for payment matching
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, reference_id, debtor_id, amount_outstanding, status")
      .eq("user_id", user.id);

    // Maps for invoice matching: reference_id (primary) and invoice_number (fallback)
    const invoiceRefMap = new Map<string, { id: string; debtor_id: string; amount_outstanding: number; status: string }>();
    const invoiceNumMap = new Map<string, { id: string; debtor_id: string; amount_outstanding: number; status: string }>();
    (existingInvoices || []).forEach(inv => {
      const invData = {
        id: inv.id,
        debtor_id: inv.debtor_id,
        amount_outstanding: inv.amount_outstanding || 0,
        status: inv.status,
      };
      // Primary: reference_id (Recouply INV ID like INV-XXXXX)
      if (inv.reference_id) {
        invoiceRefMap.set(normalizeString(inv.reference_id), invData);
      }
      // Fallback: invoice_number
      if (inv.invoice_number) {
        invoiceNumMap.set(normalizeString(inv.invoice_number), invData);
      }
    });
    
    console.log(`Invoice maps built: ${invoiceRefMap.size} by reference_id, ${invoiceNumMap.size} by invoice_number`);

    let processed = 0;
    let matched = 0;
    let needsReview = 0;
    let errors = 0;
    let newCustomers = 0;
    let existingCustomersCount = 0;
    let newRecords = 0;
    let invoicesPaid = 0;
    let invoicesPartiallyPaid = 0;
    const createdInvoiceIds: string[] = [];

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
        if (fileType === "invoice_aging") {
          // Get identifiers for matching
          const recouplyAccountId = String(getValue(row, "recouply_account_id") || "").trim();
          const customerName = String(getValue(row, "customer_name") || "").trim();
          const customerId = getValue(row, "customer_id");
          
          // Log first few rows for debugging
          if (i < 3) {
            console.log(`Row ${i} values: recouply_account_id="${recouplyAccountId}", customer_name="${customerName}", customer_id="${customerId}"`);
            console.log(`Row ${i} raw keys:`, Object.keys(row).slice(0, 5));
          }
          
          // Find or create customer
          let debtorId: string | null = null;
          
          // PRIORITY 1: Match by Recouply Account ID (reference_id)
          if (recouplyAccountId) {
            const normalizedId = normalizeString(recouplyAccountId);
            debtorId = customerRefMap.get(normalizedId) || null;
            if (debtorId) {
              console.log(`Row ${i}: Matched by recouply_account_id: ${recouplyAccountId}`);
            } else if (i < 3) {
              console.log(`Row ${i}: No match for normalized recouply_account_id: "${normalizedId}"`);
            }
          }
          
          // PRIORITY 2: Match by external customer ID
          if (!debtorId && customerId) {
            debtorId = customerMap.get(normalizeString(String(customerId))) || null;
            if (debtorId) {
              console.log(`Row ${i}: Matched by customer_id: ${customerId}`);
            }
          }
          
          // PRIORITY 3: Match by company name
          if (!debtorId && customerName) {
            debtorId = customerMap.get(normalizeString(customerName)) || null;
            if (debtorId) {
              console.log(`Row ${i}: Matched by customer_name: ${customerName}`);
            }
          }

          if (debtorId) {
            existingCustomersCount++;
            matched++;
            
            // Update staging row with matched customer IMMEDIATELY after match
            await supabase
              .from("data_center_staging_rows")
              .update({
                matched_customer_id: debtorId,
                match_status: "matched_customer",
                match_confidence: 100,
              })
              .eq("upload_id", uploadId)
              .eq("row_index", i);
          } else {
            // Need customer name to create new record
            if (!customerName) {
              console.error(`Row ${i}: No customer name and no matching account found`);
              errors++;
              continue;
            }
            
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
            if (newDebtor.reference_id) {
              customerRefMap.set(normalizeString(newDebtor.reference_id), debtorId!);
            }
            newCustomers++;
            
            // Update staging row for newly created customer
            await supabase
              .from("data_center_staging_rows")
              .update({
                matched_customer_id: debtorId,
                match_status: "matched_customer",
                match_confidence: 100,
              })
              .eq("upload_id", uploadId)
              .eq("row_index", i);
          }

          // Create invoice
          const invoiceNumber = String(getValue(row, "invoice_number") || "");
          const invoiceDate = parseDate(getValue(row, "invoice_date"));
          const dueDate = parseDate(getValue(row, "due_date"));
          const amount = parseNumber(getValue(row, "amount_original") || getValue(row, "amount_outstanding"));
          const amountOutstanding = parseNumber(getValue(row, "amount_outstanding") || getValue(row, "amount_original"));

          // Log invoice fields for debugging
          if (i < 3) {
            console.log(`Row ${i} invoice fields: invoice_number="${invoiceNumber}", invoice_date="${invoiceDate}", due_date="${dueDate}", amount=${amount}`);
          }

          if (!invoiceNumber || !invoiceDate || !dueDate) {
            console.error(`Row ${i}: Missing required invoice fields - invoice_number="${invoiceNumber}", invoice_date="${invoiceDate}", due_date="${dueDate}"`);
            errors++;
            continue;
          }

          // Generate unique reference_id for invoice
          const referenceId = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

          // Use upsert to handle duplicates - update existing invoice if found
          const { data: createdInvoice, error: invoiceError } = await supabase
            .from("invoices")
            .upsert({
              user_id: user.id,
              debtor_id: debtorId,
              invoice_number: invoiceNumber,
              issue_date: invoiceDate, // Maps from invoice_date field
              due_date: dueDate,
              amount: amount,
              amount_original: amount,
              amount_outstanding: amountOutstanding,
              currency: String(getValue(row, "currency") || "USD"),
              status: "Open",
              reference_id: referenceId,
              external_invoice_id: getValue(row, "external_invoice_id") ? String(getValue(row, "external_invoice_id")) : null,
              product_description: getValue(row, "product_description") ? String(getValue(row, "product_description")) : null,
              notes: getValue(row, "notes") ? String(getValue(row, "notes")) : null,
              data_center_upload_id: uploadId,
            }, {
              onConflict: "user_id,invoice_number",
              ignoreDuplicates: false,
            })
            .select("id")
            .single();

          if (invoiceError) {
            console.error("Invoice creation error:", invoiceError);
            errors++;
            continue;
          }

          // Track created invoice for workflow assignment
          if (createdInvoice?.id) {
            createdInvoiceIds.push(createdInvoice.id);
          }

          newRecords++;

        } else if (fileType === "payments") {
          // PAYMENTS: Require recouply_account_id and recouply_invoice_id (or payment_invoice_number as fallback)
          const recouplyAccountId = String(getValue(row, "recouply_account_id") || "").trim();
          const recouplyInvoiceId = String(getValue(row, "recouply_invoice_id") || "").trim();
          const paymentInvoiceNumber = String(getValue(row, "payment_invoice_number") || "").trim();
          const paymentDate = parseDate(getValue(row, "payment_date"));
          const paymentAmount = parseNumber(getValue(row, "payment_amount"));
          
          // Use recouply_invoice_id if provided, otherwise fall back to payment_invoice_number
          const invoiceIdentifier = recouplyInvoiceId || paymentInvoiceNumber;

          // Validate required fields
          if (!recouplyAccountId) {
            console.error(`Row ${i}: Missing required Recouply Account ID`);
            errors++;
            continue;
          }

          if (!invoiceIdentifier) {
            console.error(`Row ${i}: Missing required Recouply Invoice ID or Invoice Number`);
            errors++;
            continue;
          }

          if (!paymentDate || paymentAmount <= 0) {
            console.error(`Row ${i}: Invalid payment date or amount`);
            errors++;
            continue;
          }

          // Find debtor by reference_id (recouply_account_id)
          const debtorId = customerRefMap.get(normalizeString(recouplyAccountId));
          if (!debtorId) {
            console.error(`Row ${i}: Account not found for Recouply Account ID: ${recouplyAccountId}`);
            errors++;
            continue;
          }

          // Find invoice: try recouply_invoice_id (reference_id) first, then payment_invoice_number
          let invoiceData = null;
          if (recouplyInvoiceId) {
            invoiceData = invoiceRefMap.get(normalizeString(recouplyInvoiceId));
            if (invoiceData) {
              console.log(`Row ${i}: Matched invoice by Recouply Invoice ID: ${recouplyInvoiceId}`);
            }
          }
          if (!invoiceData && paymentInvoiceNumber) {
            // Try reference_id lookup first, then invoice_number
            invoiceData = invoiceRefMap.get(normalizeString(paymentInvoiceNumber));
            if (!invoiceData) {
              invoiceData = invoiceNumMap.get(normalizeString(paymentInvoiceNumber));
            }
            if (invoiceData) {
              console.log(`Row ${i}: Matched invoice by invoice_number: ${paymentInvoiceNumber}`);
            }
          }
          if (!invoiceData) {
            console.error(`Row ${i}: Invoice not found by Recouply Invoice ID (${recouplyInvoiceId}) or invoice_number (${paymentInvoiceNumber})`);
            errors++;
            continue;
          }

          // Verify invoice belongs to the specified account
          if (invoiceData.debtor_id !== debtorId) {
            console.error(`Row ${i}: Invoice ${paymentInvoiceNumber} does not belong to account ${recouplyAccountId}`);
            errors++;
            continue;
          }

          // Check if invoice is already paid
          if (invoiceData.status === "Paid") {
            console.error(`Row ${i}: Invoice ${paymentInvoiceNumber} is already paid`);
            errors++;
            continue;
          }

          // Create payment record
          const { data: newPayment, error: paymentError } = await supabase
            .from("payments")
            .insert({
              user_id: user.id,
              debtor_id: debtorId,
              payment_date: paymentDate,
              amount: paymentAmount,
              currency: String(getValue(row, "currency") || "USD"),
              reference: getValue(row, "payment_reference") ? String(getValue(row, "payment_reference")) : null,
              notes: getValue(row, "payment_notes") ? String(getValue(row, "payment_notes")) : null,
              invoice_number_hint: paymentInvoiceNumber,
              data_center_upload_id: uploadId,
              reconciliation_status: "matched",
            })
            .select()
            .single();

          if (paymentError) {
            console.error("Payment creation error:", paymentError);
            errors++;
            continue;
          }

          // Create payment-invoice link
          const { error: linkError } = await supabase
            .from("payment_invoice_links")
            .insert({
              payment_id: newPayment.id,
              invoice_id: invoiceData.id,
              applied_amount: paymentAmount,
              match_confidence: 1.0,
              match_method: "manual_upload",
              status: "confirmed",
            });

          if (linkError) {
            console.error("Payment link creation error:", linkError);
          }

          // Calculate new outstanding amount
          const newOutstanding = Math.max(0, invoiceData.amount_outstanding - paymentAmount);
          
          // Determine new invoice status
          let newStatus: string;
          if (newOutstanding <= 0) {
            // Full payment - mark as Paid
            newStatus = "Paid";
            invoicesPaid++;
          } else {
            // Partial payment - mark as PartiallyPaid
            newStatus = "PartiallyPaid";
            invoicesPartiallyPaid++;
          }

          // Update invoice with new outstanding amount and status
          const { error: invoiceUpdateError } = await supabase
            .from("invoices")
            .update({
              amount_outstanding: newOutstanding,
              status: newStatus,
              payment_date: newStatus === "Paid" ? paymentDate : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoiceData.id);

          if (invoiceUpdateError) {
            console.error("Invoice update error:", invoiceUpdateError);
          } else {
            // Update local cache for subsequent payments to same invoice
            invoiceData.amount_outstanding = newOutstanding;
            invoiceData.status = newStatus;
          }

          matched++;
          newRecords++;
        } else if (fileType === "accounts") {
          // ACCOUNTS: Process in small chunks to avoid memory limits
          const BATCH_SIZE = 50;
          
          for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
            const batchRows = rows.slice(batchStart, batchEnd);
            const accountsToCreate: any[] = [];
            
            console.log(`Processing batch ${batchStart}-${batchEnd} of ${rows.length}`);
            
            for (let j = 0; j < batchRows.length; j++) {
              const row = batchRows[j];
              const i = batchStart + j;
              
              const recouplyAccountId = String(getValue(row, "recouply_account_id") || "").trim();
              const companyName = String(getValue(row, "company_name") || "").trim();
              const contactName = String(getValue(row, "contact_name") || "").trim();
              const contactEmail = String(getValue(row, "contact_email") || "").trim();
              const contactPhone = String(getValue(row, "contact_phone") || "").trim();
              const accountType = String(getValue(row, "account_type") || "B2C").trim();
              const addressLine1 = String(getValue(row, "address_line1") || "").trim();
              const addressLine2 = String(getValue(row, "address_line2") || "").trim();
              const city = String(getValue(row, "city") || "").trim();
              const state = String(getValue(row, "state") || "").trim();
              const postalCode = String(getValue(row, "postal_code") || "").trim();
              const country = String(getValue(row, "country") || "").trim();
              const externalCustomerId = String(getValue(row, "customer_id") || "").trim();
              const crmId = String(getValue(row, "crm_id") || "").trim();
              const industry = String(getValue(row, "industry") || "").trim();
              const notes = String(getValue(row, "notes") || "").trim();
              
              // Validate required fields
              if (!companyName || !contactName || !contactEmail) {
                console.error(`Row ${i}: Missing required fields`);
                errors++;
                continue;
              }
              
              const parsedType = accountType.toUpperCase() === "B2B" ? "B2B" : "B2C";
              
              // Check if this is an update (RAID provided) or new account (no RAID)
              let debtorId: string | null = null;
              if (recouplyAccountId) {
                debtorId = customerRefMap.get(normalizeString(recouplyAccountId)) || null;
              }
              
              if (debtorId) {
                // Update existing account one at a time (rare case)
                const updateData: any = {
                  updated_at: new Date().toISOString(),
                  company_name: companyName,
                  name: companyName,
                  contact_name: contactName,
                  email: contactEmail,
                  type: parsedType,
                };
                
                if (contactPhone) updateData.phone = contactPhone;
                if (addressLine1) updateData.address_line1 = addressLine1;
                if (addressLine2) updateData.address_line2 = addressLine2;
                if (city) updateData.city = city;
                if (state) updateData.state = state;
                if (postalCode) updateData.postal_code = postalCode;
                if (country) updateData.country = country;
                if (externalCustomerId) updateData.external_customer_id = externalCustomerId;
                if (crmId) updateData.crm_account_id_external = crmId;
                if (industry) updateData.industry = industry;
                if (notes) updateData.notes = notes;
                
                await supabase.from("debtors").update(updateData).eq("id", debtorId);
                existingCustomersCount++;
                matched++;
              } else {
                // Queue for batch insert
                const newRaid = `RCPLY-ACCT-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
                
                accountsToCreate.push({
                  user_id: user.id,
                  company_name: companyName,
                  name: companyName,
                  contact_name: contactName,
                  email: contactEmail,
                  phone: contactPhone || null,
                  type: parsedType,
                  address_line1: addressLine1 || null,
                  address_line2: addressLine2 || null,
                  city: city || null,
                  state: state || null,
                  postal_code: postalCode || null,
                  country: country || null,
                  external_customer_id: externalCustomerId || null,
                  crm_account_id_external: crmId || null,
                  industry: industry || null,
                  notes: notes || null,
                  reference_id: newRaid,
                });
                newCustomers++;
              }
              
              processed++;
            }
            
            // Insert this batch of new accounts
            if (accountsToCreate.length > 0) {
              console.log(`Inserting batch of ${accountsToCreate.length} accounts`);
              const { error: createError } = await supabase
                .from("debtors")
                .insert(accountsToCreate);
              
              if (createError) {
                console.error("Batch account creation error:", createError);
                errors += accountsToCreate.length;
                newCustomers -= accountsToCreate.length;
              } else {
                newRecords += accountsToCreate.length;
                matched += accountsToCreate.length;
              }
            }
          }
        }

        // For accounts, we process all rows in the batch loop above, so mark this row as processed
        // (the outer loop still exists but accounts handles its own iteration)
        if (fileType === "accounts") {
          // Already processed in batch above, break out of outer loop
          break;
        }
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

    // Track invoice usage for each new invoice
    if (fileType === "invoice_aging" && createdInvoiceIds.length > 0) {
      console.log(`Tracking usage for ${createdInvoiceIds.length} new invoices`);
      
      for (const invoiceId of createdInvoiceIds) {
        try {
          await supabase.functions.invoke('track-invoice-usage', {
            body: { invoice_id: invoiceId }
          });
        } catch (usageError: any) {
          console.log(`Usage tracking error for ${invoiceId} (non-blocking):`, usageError?.message);
        }
      }
    }

    // Trigger AI workflow assignment and draft generation for new invoices
    let draftsGenerated = 0;
    let workflowErrors: string[] = [];
    
    if (fileType === "invoice_aging" && createdInvoiceIds.length > 0) {
      console.log(`Triggering AI workflow for ${createdInvoiceIds.length} new invoices`);
      
      // Fetch the created invoices with their aging buckets
      const { data: newInvoices } = await supabase
        .from("invoices")
        .select("id, aging_bucket, due_date")
        .in("id", createdInvoiceIds);
      
      // Group invoices by aging bucket
      const bucketInvoices: Record<string, string[]> = {};
      
      for (const inv of newInvoices || []) {
        // Calculate aging bucket from due date if not set
        let bucket = inv.aging_bucket;
        if (!bucket) {
          const today = new Date();
          const dueDate = new Date(inv.due_date);
          const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysPastDue <= 0) bucket = 'current';
          else if (daysPastDue <= 30) bucket = 'dpd_1_30';
          else if (daysPastDue <= 60) bucket = 'dpd_31_60';
          else if (daysPastDue <= 90) bucket = 'dpd_61_90';
          else if (daysPastDue <= 120) bucket = 'dpd_91_120';
          else if (daysPastDue <= 150) bucket = 'dpd_121_150';
          else bucket = 'dpd_150_plus';
        }
        
        if (bucket && bucket !== 'current') {
          if (!bucketInvoices[bucket]) bucketInvoices[bucket] = [];
          bucketInvoices[bucket].push(inv.id);
        }
      }
      
      console.log(`Invoice buckets:`, JSON.stringify(bucketInvoices));
      
      // Trigger draft generation for each bucket with invoices
      for (const [bucket, invoiceIds] of Object.entries(bucketInvoices)) {
        try {
          console.log(`Generating drafts for bucket ${bucket} with ${invoiceIds.length} invoices`);
          
          const response = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-bucket-drafts`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ aging_bucket: bucket }),
            }
          );
          
          if (response.ok) {
            const result = await response.json();
            draftsGenerated += result.drafts_created || 0;
            console.log(`Generated ${result.drafts_created || 0} drafts for bucket ${bucket}`);
          } else {
            const errorText = await response.text();
            console.error(`Failed to generate drafts for bucket ${bucket}:`, errorText);
            workflowErrors.push(`Failed to generate drafts for ${bucket}`);
          }
        } catch (error: any) {
          console.error(`Error generating drafts for bucket ${bucket}:`, error);
          workflowErrors.push(`Error generating drafts for ${bucket}: ${error.message}`);
        }
      }
    }

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
      invoicesPaid,
      invoicesPartiallyPaid,
      draftsGenerated,
      workflowErrors: workflowErrors.length > 0 ? workflowErrors : undefined,
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
