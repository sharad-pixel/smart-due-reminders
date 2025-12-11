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

    // Process each row - use batch processing for all file types
    const BATCH_SIZE = 50;
    
    if (fileType === "invoice_aging") {
      // INVOICES: Process in batches of 50
      for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
        const batchRows = rows.slice(batchStart, batchEnd);
        const invoicesToCreate: any[] = [];
        
        console.log(`Processing invoice batch ${batchStart}-${batchEnd} of ${rows.length}`);
        
        for (let j = 0; j < batchRows.length; j++) {
          const row = batchRows[j];
          const i = batchStart + j;
          
          try {
            // Get identifiers for matching
            const recouplyAccountId = String(getValue(row, "recouply_account_id") || "").trim();
            const customerName = String(getValue(row, "customer_name") || "").trim();
            const customerId = getValue(row, "customer_id");
            
            // Find or create customer
            let debtorId: string | null = null;
            
            // PRIORITY 1: Match by Recouply Account ID (reference_id)
            if (recouplyAccountId) {
              debtorId = customerRefMap.get(normalizeString(recouplyAccountId)) || null;
            }
            
            // PRIORITY 2: Match by external customer ID
            if (!debtorId && customerId) {
              debtorId = customerMap.get(normalizeString(String(customerId))) || null;
            }
            
            // PRIORITY 3: Match by company name
            if (!debtorId && customerName) {
              debtorId = customerMap.get(normalizeString(customerName)) || null;
            }

            if (debtorId) {
              existingCustomersCount++;
              matched++;
              
              // Update staging row with matched customer
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

            if (!invoiceNumber || !invoiceDate || !dueDate) {
              console.error(`Row ${i}: Missing required invoice fields`);
              errors++;
              continue;
            }

            // Generate unique reference_id for invoice
            const referenceId = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

            invoicesToCreate.push({
              user_id: user.id,
              debtor_id: debtorId,
              invoice_number: invoiceNumber,
              issue_date: invoiceDate,
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
            });
            
            processed++;
          } catch (rowError: any) {
            console.error(`Error processing row ${i}:`, rowError);
            errors++;
          }
        }
        
        // Batch insert invoices
        if (invoicesToCreate.length > 0) {
          console.log(`Inserting batch of ${invoicesToCreate.length} invoices`);
          const { data: createdInvoices, error: createError } = await supabase
            .from("invoices")
            .insert(invoicesToCreate)
            .select("id");
          
          if (createError) {
            console.error("Batch invoice creation error:", createError);
            errors += invoicesToCreate.length;
          } else {
            newRecords += invoicesToCreate.length;
            if (createdInvoices) {
              createdInvoiceIds.push(...createdInvoices.map(inv => inv.id));
            }
          }
        }
      }
    } else if (fileType === "payments") {
      // PAYMENTS: Process in batches of 50
      for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
        const batchRows = rows.slice(batchStart, batchEnd);
        const paymentsToCreate: any[] = [];
        const paymentLinks: { paymentIndex: number; invoiceData: any; paymentAmount: number }[] = [];
        
        console.log(`Processing payment batch ${batchStart}-${batchEnd} of ${rows.length}`);
        
        for (let j = 0; j < batchRows.length; j++) {
          const row = batchRows[j];
          const i = batchStart + j;
          
          try {
            const recouplyAccountId = String(getValue(row, "recouply_account_id") || "").trim();
            const recouplyInvoiceId = String(getValue(row, "recouply_invoice_id") || "").trim();
            const paymentInvoiceNumber = String(getValue(row, "payment_invoice_number") || "").trim();
            const paymentDate = parseDate(getValue(row, "payment_date"));
            const paymentAmount = parseNumber(getValue(row, "payment_amount"));
            
            const invoiceIdentifier = recouplyInvoiceId || paymentInvoiceNumber;

            // Validate required fields
            if (!recouplyAccountId || !invoiceIdentifier || !paymentDate || paymentAmount <= 0) {
              console.error(`Row ${i}: Missing required payment fields`);
              errors++;
              continue;
            }

            // Find debtor by reference_id
            const debtorId = customerRefMap.get(normalizeString(recouplyAccountId));
            if (!debtorId) {
              console.error(`Row ${i}: Account not found for: ${recouplyAccountId}`);
              errors++;
              continue;
            }

            // Find invoice
            let invoiceData = null;
            if (recouplyInvoiceId) {
              invoiceData = invoiceRefMap.get(normalizeString(recouplyInvoiceId));
            }
            if (!invoiceData && paymentInvoiceNumber) {
              invoiceData = invoiceRefMap.get(normalizeString(paymentInvoiceNumber)) ||
                           invoiceNumMap.get(normalizeString(paymentInvoiceNumber));
            }
            
            if (!invoiceData) {
              console.error(`Row ${i}: Invoice not found`);
              errors++;
              continue;
            }

            if (invoiceData.debtor_id !== debtorId || invoiceData.status === "Paid") {
              errors++;
              continue;
            }

            paymentsToCreate.push({
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
            });
            
            paymentLinks.push({
              paymentIndex: paymentsToCreate.length - 1,
              invoiceData,
              paymentAmount,
            });
            
            processed++;
          } catch (rowError: any) {
            console.error(`Error processing row ${i}:`, rowError);
            errors++;
          }
        }
        
        // Batch insert payments
        if (paymentsToCreate.length > 0) {
          console.log(`Inserting batch of ${paymentsToCreate.length} payments`);
          const { data: createdPayments, error: createError } = await supabase
            .from("payments")
            .insert(paymentsToCreate)
            .select("id");
          
          if (createError) {
            console.error("Batch payment creation error:", createError);
            errors += paymentsToCreate.length;
          } else if (createdPayments) {
            newRecords += createdPayments.length;
            matched += createdPayments.length;
            
            // Create payment-invoice links and update invoices
            for (const link of paymentLinks) {
              const payment = createdPayments[link.paymentIndex];
              if (!payment) continue;
              
              // Create link
              await supabase.from("payment_invoice_links").insert({
                payment_id: payment.id,
                invoice_id: link.invoiceData.id,
                applied_amount: link.paymentAmount,
                match_confidence: 1.0,
                match_method: "manual_upload",
                status: "confirmed",
              });
              
              // Update invoice
              const newOutstanding = Math.max(0, link.invoiceData.amount_outstanding - link.paymentAmount);
              const newStatus = newOutstanding <= 0 ? "Paid" : "PartiallyPaid";
              
              if (newStatus === "Paid") invoicesPaid++;
              else invoicesPartiallyPaid++;
              
              await supabase.from("invoices").update({
                amount_outstanding: newOutstanding,
                status: newStatus,
                payment_date: newStatus === "Paid" ? paymentsToCreate[link.paymentIndex].payment_date : null,
                updated_at: new Date().toISOString(),
              }).eq("id", link.invoiceData.id);
              
              // Update local cache
              link.invoiceData.amount_outstanding = newOutstanding;
              link.invoiceData.status = newStatus;
            }
          }
        }
      }
    } else if (fileType === "accounts") {
      // ACCOUNTS: Process in small chunks to avoid memory limits
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
            const newRaid = `RCPLY-ACCT-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            
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
