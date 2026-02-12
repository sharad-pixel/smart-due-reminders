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
  batchIndex?: number;
  totalBatches?: number;
  isLastBatch?: boolean;
}

// Optimized date parsing with caching
const dateCache = new Map<string, string | null>();

function parseDate(value: any): string | null {
  if (!value) return null;
  
  // Check cache first
  const cacheKey = String(value);
  if (dateCache.has(cacheKey)) {
    return dateCache.get(cacheKey)!;
  }
  
  let result: string | null = null;
  
  if (value instanceof Date) {
    result = value.toISOString().split("T")[0];
  } else if (typeof value === "number") {
    // Excel serial date - optimized calculation
    const date = new Date((value - 25569) * 86400000);
    result = date.toISOString().split("T")[0];
  } else if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      result = parsed.toISOString().split("T")[0];
    }
  }
  
  // Cache result (limit cache size to prevent memory issues)
  if (dateCache.size < 10000) {
    dateCache.set(cacheKey, result);
  }
  
  return result;
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

// Generate unique reference ID with collision prevention
function generateReferenceId(prefix: string, index: number): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${prefix}-${timestamp}-${index}-${random}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    const { uploadId, rows, mappings, fileType, batchIndex = 0, totalBatches = 1, isLastBatch = true }: ProcessRequest = await req.json();

    console.log(`Processing upload ${uploadId}: batch ${batchIndex + 1}/${totalBatches}, ${rows.length} rows, fileType: ${fileType}`);

    // Build reverse mapping once
    const reverseMap: Record<string, string> = {};
    for (const [fileCol, fieldKey] of Object.entries(mappings)) {
      reverseMap[fieldKey] = fileCol;
    }

    // Optimized getValue with pre-computed lowercase keys
    const getValue = (row: Record<string, any>, fieldKey: string): any => {
      const fileCol = reverseMap[fieldKey];
      if (!fileCol) return null;
      
      if (row[fileCol] !== undefined) return row[fileCol];
      
      const lowerFileCol = fileCol.toLowerCase();
      for (const key of Object.keys(row)) {
        if (key.toLowerCase() === lowerFileCol) {
          return row[key];
        }
      }
      
      return null;
    };

    // Paginated fetch of existing data to bypass 1000-row limit
    async function fetchAllRows(table: string, selectCols: string, userId: string): Promise<any[]> {
      const allRows: any[] = [];
      const PAGE_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from(table)
          .select(selectCols)
          .eq("user_id", userId)
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allRows.push(...data);
          offset += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      return allRows;
    }

    const [existingCustomers, existingInvoices] = await Promise.all([
      fetchAllRows("debtors", "id, company_name, external_customer_id, email, reference_id", user.id),
      fetchAllRows("invoices", "id, invoice_number, reference_id, debtor_id, amount_outstanding, status", user.id),
    ]);

    console.log(`Loaded ${existingCustomers.length} customers, ${existingInvoices.length} invoices`);

    // Build lookup maps
    const customerMap = new Map<string, string>();
    const customerRefMap = new Map<string, string>();
    existingCustomers.forEach(c => {
      customerMap.set(normalizeString(c.company_name), c.id);
      if (c.external_customer_id) {
        customerMap.set(normalizeString(c.external_customer_id), c.id);
      }
      if (c.reference_id) {
        customerRefMap.set(normalizeString(c.reference_id), c.id);
      }
    });

    const invoiceRefMap = new Map<string, { id: string; debtor_id: string; amount_outstanding: number; status: string }>();
    const invoiceNumMap = new Map<string, { id: string; debtor_id: string; amount_outstanding: number; status: string }>();
    existingInvoices.forEach(inv => {
      const invData = {
        id: inv.id,
        debtor_id: inv.debtor_id,
        amount_outstanding: inv.amount_outstanding || 0,
        status: inv.status,
      };
      if (inv.reference_id) {
        invoiceRefMap.set(normalizeString(inv.reference_id), invData);
      }
      if (inv.invoice_number) {
        invoiceNumMap.set(normalizeString(inv.invoice_number), invData);
      }
    });

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

    // Batch insert staging rows only on first batch
    if (batchIndex === 0) {
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

      const { error: stagingError } = await supabase
        .from("data_center_staging_rows")
        .insert(stagingRows);

      if (stagingError) {
        console.error("Staging error:", stagingError);
      }
    }

    const BATCH_SIZE = 50;
    
    if (fileType === "invoice_aging") {
      // Collect staging updates for batch processing
      const stagingUpdates: { index: number; debtorId: string }[] = [];
      
      for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
        const batchRows = rows.slice(batchStart, batchEnd);
        const invoicesToCreate: any[] = [];
        const newDebtorsToCreate: any[] = [];
        const newDebtorContacts: any[] = [];
        const rowDebtorMap: Map<number, string | null> = new Map();
        
        // First pass: identify existing vs new customers
        // Priority: 1. RAID (recouply_account_id), 2. Source System ID (customer_id), 3. Company Name (NOT email)
        for (let j = 0; j < batchRows.length; j++) {
          const row = batchRows[j];
          const i = batchStart + j;
          
          const recouplyAccountId = String(getValue(row, "recouply_account_id") || "").trim();
          const customerName = String(getValue(row, "customer_name") || "").trim();
          const customerId = getValue(row, "customer_id"); // Source System Customer ID
          
          let debtorId: string | null = null;
          
          // 1. First try matching by RAID (Recouply Account ID)
          if (recouplyAccountId) {
            debtorId = customerRefMap.get(normalizeString(recouplyAccountId)) || null;
          }
          // 2. Then try matching by Source System Customer ID (external_customer_id)
          if (!debtorId && customerId) {
            debtorId = customerMap.get(normalizeString(String(customerId))) || null;
          }
          // 3. Finally fallback to company name (NOT email to avoid duplicates)
          if (!debtorId && customerName) {
            debtorId = customerMap.get(normalizeString(customerName)) || null;
          }
          
          rowDebtorMap.set(i, debtorId);
          
          if (debtorId) {
            existingCustomersCount++;
            matched++;
            stagingUpdates.push({ index: i, debtorId });
          } else if (customerName) {
            // Queue new debtor creation with Source System ID and RAID
            const contactName = String(getValue(row, "contact_name") || customerName);
            const contactEmail = String(getValue(row, "customer_email") || "");
            const contactPhone = String(getValue(row, "customer_phone") || "");
            const newRaid = generateReferenceId("RAID", i); // Changed prefix to RAID
            
            newDebtorsToCreate.push({
              user_id: user.id,
              company_name: customerName,
              name: customerName,
              email: contactEmail,
              phone: contactPhone,
              external_customer_id: customerId ? String(customerId) : null, // Source System Customer ID
              external_system: "csv_upload", // Track source system
              integration_source: "csv_upload", // Integration source tracking
              reference_id: newRaid, // Auto-generated RAID
              _row_index: i, // Track for post-insert mapping
              _contact_name: contactName, // Store for contact creation
            });
            newCustomers++;
          } else {
            errors++;
          }
        }
        
        // Batch create new debtors
        if (newDebtorsToCreate.length > 0) {
          const debtorsForInsert = newDebtorsToCreate.map(({ _row_index, _contact_name, ...debtor }) => debtor);
          const { data: createdDebtors, error: debtorError } = await supabase
            .from("debtors")
            .insert(debtorsForInsert)
            .select("id, reference_id, email, phone");
          
          if (debtorError) {
            console.error("Batch debtor creation error:", debtorError);
            errors += newDebtorsToCreate.length;
            newCustomers -= newDebtorsToCreate.length;
          } else if (createdDebtors) {
            // Map new debtors back to rows
            for (let k = 0; k < createdDebtors.length; k++) {
              const debtor = createdDebtors[k];
              const originalData = newDebtorsToCreate[k];
              const rowIndex = originalData._row_index;
              
              rowDebtorMap.set(rowIndex, debtor.id);
              customerMap.set(normalizeString(debtor.reference_id || ""), debtor.id);
              if (debtor.reference_id) {
                customerRefMap.set(normalizeString(debtor.reference_id), debtor.id);
              }
              stagingUpdates.push({ index: rowIndex, debtorId: debtor.id });
              
              // Queue contact creation
              if (debtor.email) {
                newDebtorContacts.push({
                  debtor_id: debtor.id,
                  user_id: user.id,
                  name: originalData._contact_name || originalData.company_name,
                  email: debtor.email,
                  phone: debtor.phone || null,
                  is_primary: true,
                  outreach_enabled: true,
                });
              }
            }
          }
        }
        
        // Batch create contacts
        if (newDebtorContacts.length > 0) {
          await supabase.from("debtor_contacts").insert(newDebtorContacts);
        }
        
        // Create invoices for all rows with valid debtors
        for (let j = 0; j < batchRows.length; j++) {
          const row = batchRows[j];
          const i = batchStart + j;
          const debtorId = rowDebtorMap.get(i);
          
          if (!debtorId) continue;
          
          const invoiceNumber = String(getValue(row, "invoice_number") || "");
          const invoiceDate = parseDate(getValue(row, "invoice_date"));
          const dueDate = parseDate(getValue(row, "due_date"));
          const amount = parseNumber(getValue(row, "amount_original") || getValue(row, "amount_outstanding"));
          const amountOutstanding = parseNumber(getValue(row, "amount_outstanding") || getValue(row, "amount_original"));

          if (!invoiceNumber || !invoiceDate || !dueDate) {
            errors++;
            continue;
          }

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
            reference_id: generateReferenceId("INV", i),
            external_invoice_id: getValue(row, "external_invoice_id") ? String(getValue(row, "external_invoice_id")) : null,
            product_description: getValue(row, "product_description") ? String(getValue(row, "product_description")) : null,
            notes: getValue(row, "notes") ? String(getValue(row, "notes")) : null,
            data_center_upload_id: uploadId,
          });
          
          processed++;
        }
        
        // Batch insert invoices
        if (invoicesToCreate.length > 0) {
          const { data: createdInvoices, error: createError } = await supabase
            .from("invoices")
            .insert(invoicesToCreate)
            .select("id");
          
          if (createError) {
            console.error("Batch invoice creation error:", createError);
            errors += invoicesToCreate.length;
          } else if (createdInvoices) {
            newRecords += createdInvoices.length;
            createdInvoiceIds.push(...createdInvoices.map(inv => inv.id));
          }
        }
      }
      
      // Batch update staging rows
      if (stagingUpdates.length > 0) {
        const updatePromises = stagingUpdates.map(({ index, debtorId }) =>
          supabase
            .from("data_center_staging_rows")
            .update({
              matched_customer_id: debtorId,
              match_status: "matched_customer",
              match_confidence: 100,
            })
            .eq("upload_id", uploadId)
            .eq("row_index", index)
        );
        
        // Execute in parallel batches of 10
        for (let i = 0; i < updatePromises.length; i += 10) {
          await Promise.all(updatePromises.slice(i, i + 10));
        }
      }
      
    } else if (fileType === "payments") {
      for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
        const batchRows = rows.slice(batchStart, batchEnd);
        const paymentsToCreate: any[] = [];
        const paymentLinks: { paymentIndex: number; invoiceData: any; paymentAmount: number }[] = [];
        
        for (let j = 0; j < batchRows.length; j++) {
          const row = batchRows[j];
          const i = batchStart + j;
          
          try {
            const recouplyAccountId = String(getValue(row, "recouply_account_id") || "").trim();
            const recouplyInvoiceId = String(getValue(row, "recouply_invoice_id") || "").trim();
            const paymentInvoiceNumber = String(getValue(row, "payment_invoice_number") || "").trim();
            const paymentDate = parseDate(getValue(row, "payment_date"));
            const paymentAmount = parseNumber(getValue(row, "payment_amount"));
            const customerName = String(getValue(row, "customer_name") || getValue(row, "company_name") || "").trim();
            const customerId = String(getValue(row, "customer_id") || "").trim();
            
            const invoiceIdentifier = recouplyInvoiceId || paymentInvoiceNumber;

            if (!invoiceIdentifier || !paymentDate || paymentAmount <= 0) {
              console.error(`Row ${i}: Missing required fields - invoiceId: ${invoiceIdentifier}, date: ${paymentDate}, amount: ${paymentAmount}`);
              errors++;
              continue;
            }

            // Multi-tier debtor matching: 1. RAID, 2. External Customer ID, 3. Company Name
            let debtorId: string | undefined = undefined;
            
            // Priority 1: Match by Recouply Account ID (RAID)
            if (recouplyAccountId) {
              debtorId = customerRefMap.get(normalizeString(recouplyAccountId));
            }
            // Priority 2: Match by external customer ID or its normalized form
            if (!debtorId && customerId) {
              debtorId = customerMap.get(normalizeString(customerId));
            }
            // Priority 3: Match by company/customer name
            if (!debtorId && customerName) {
              debtorId = customerMap.get(normalizeString(customerName));
            }
            // Priority 4: If we have an invoice identifier, try to find the debtor from the invoice
            if (!debtorId && invoiceIdentifier) {
              const invByRef = invoiceRefMap.get(normalizeString(invoiceIdentifier));
              const invByNum = invoiceNumMap.get(normalizeString(invoiceIdentifier));
              const matchedInv = invByRef || invByNum;
              if (matchedInv) {
                debtorId = matchedInv.debtor_id;
              }
            }
            
            if (!debtorId) {
              console.error(`Row ${i}: Could not match debtor - RAID: ${recouplyAccountId}, custId: ${customerId}, name: ${customerName}`);
              errors++;
              continue;
            }

            let invoiceData = null;
            if (recouplyInvoiceId) {
              invoiceData = invoiceRefMap.get(normalizeString(recouplyInvoiceId));
            }
            if (!invoiceData && paymentInvoiceNumber) {
              invoiceData = invoiceRefMap.get(normalizeString(paymentInvoiceNumber)) ||
                           invoiceNumMap.get(normalizeString(paymentInvoiceNumber));
            }
            
            if (!invoiceData || invoiceData.debtor_id !== debtorId || invoiceData.status === "Paid") {
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
              reconciliation_status: "manually_matched",
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
            
            // Batch create payment-invoice links
            const linksToCreate = paymentLinks.map(link => ({
              payment_id: createdPayments[link.paymentIndex].id,
              invoice_id: link.invoiceData.id,
              applied_amount: link.paymentAmount,
              match_confidence: 1.0,
              match_method: "manual_upload",
              status: "confirmed",
            }));
            
            if (linksToCreate.length > 0) {
              await supabase.from("payment_invoice_links").insert(linksToCreate);
            }
            
            // Batch update invoices
            const invoiceUpdates = paymentLinks.map(link => {
              const newOutstanding = Math.max(0, link.invoiceData.amount_outstanding - link.paymentAmount);
              const newStatus = newOutstanding <= 0 ? "Paid" : "PartiallyPaid";
              
              if (newStatus === "Paid") invoicesPaid++;
              else invoicesPartiallyPaid++;
              
              return {
                id: link.invoiceData.id,
                amount_outstanding: newOutstanding,
                status: newStatus,
                payment_date: newStatus === "Paid" ? paymentsToCreate[link.paymentIndex].payment_date : null,
              };
            });
            
            // Execute invoice updates in parallel
            await Promise.all(
              invoiceUpdates.map(update =>
                supabase.from("invoices")
                  .update({
                    amount_outstanding: update.amount_outstanding,
                    status: update.status,
                    payment_date: update.payment_date,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", update.id)
              )
            );
          }
        }
      }
    } else if (fileType === "accounts") {
      for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
        const batchRows = rows.slice(batchStart, batchEnd);
        const accountsToCreate: any[] = [];
        const accountUpdates: { id: string; data: any; _contact_name?: string }[] = [];
        
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
          
          if (!companyName || !contactName || !contactEmail) {
            errors++;
            continue;
          }
          
          const parsedType = accountType.toUpperCase() === "B2B" ? "B2B" : "B2C";
          
          let debtorId: string | null = null;
          if (recouplyAccountId) {
            debtorId = customerRefMap.get(normalizeString(recouplyAccountId)) || null;
          }
          
          if (debtorId) {
            // Queue update
            accountUpdates.push({
              id: debtorId,
              data: {
                updated_at: new Date().toISOString(),
                company_name: companyName,
                name: companyName,
                email: contactEmail,
                type: parsedType,
                phone: contactPhone || undefined,
                address_line1: addressLine1 || undefined,
                address_line2: addressLine2 || undefined,
                city: city || undefined,
                state: state || undefined,
                postal_code: postalCode || undefined,
                country: country || undefined,
                external_customer_id: externalCustomerId || undefined,
                crm_account_id_external: crmId || undefined,
                industry: industry || undefined,
                notes: notes || undefined,
              },
              _contact_name: contactName, // Store for contact update
            });
            existingCustomersCount++;
            matched++;
          } else {
            // Create new account with Source System ID and RAID
            accountsToCreate.push({
              user_id: user.id,
              company_name: companyName,
              name: companyName,
              email: contactEmail,
              phone: contactPhone || null,
              type: parsedType,
              address_line1: addressLine1 || null,
              address_line2: addressLine2 || null,
              city: city || null,
              state: state || null,
              postal_code: postalCode || null,
              country: country || null,
              external_customer_id: externalCustomerId || null, // Source System Customer ID
              crm_account_id_external: crmId || null,
              industry: industry || null,
              notes: notes || null,
              external_system: "csv_upload",
              integration_source: "csv_upload",
              reference_id: generateReferenceId("RAID", i), // Auto-generated RAID
              _contact_name: contactName, // Store for contact creation
            });
            newCustomers++;
          }
          
          processed++;
        }
        
        // Execute account updates in parallel
        if (accountUpdates.length > 0) {
          await Promise.all(
            accountUpdates.map(update =>
              supabase.from("debtors").update(update.data).eq("id", update.id)
            )
          );
        }
        
        // Batch insert new accounts
        if (accountsToCreate.length > 0) {
          const accountsForInsert = accountsToCreate.map(({ _contact_name, ...account }) => account);
          const { data: createdAccounts, error: createError } = await supabase
            .from("debtors")
            .insert(accountsForInsert)
            .select("id, email, phone");
          
          if (createError) {
            console.error("Batch account creation error:", createError);
            errors += accountsToCreate.length;
            newCustomers -= accountsToCreate.length;
          } else if (createdAccounts) {
            newRecords += createdAccounts.length;
            matched += createdAccounts.length;
            
            // Batch create primary contacts
            const contactsToCreate = createdAccounts
              .filter((acc: any) => acc.email)
              .map((acc: any, index: number) => ({
                debtor_id: acc.id,
                user_id: user.id,
                name: accountsToCreate[index]._contact_name || "Primary Contact",
                email: acc.email,
                phone: acc.phone || null,
                is_primary: true,
                outreach_enabled: true,
              }));
            
            if (contactsToCreate.length > 0) {
              await supabase.from("debtor_contacts").insert(contactsToCreate);
            }
          }
        }
      }
    }

    // Update upload status on last batch
    if (isLastBatch) {
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
    }

    // Batch track invoice usage on last batch
    if (isLastBatch && fileType === "invoice_aging" && createdInvoiceIds.length > 0) {
      console.log(`Tracking usage for ${createdInvoiceIds.length} new invoices`);
      
      // Process in parallel batches of 5 to avoid overwhelming the function
      const USAGE_BATCH_SIZE = 5;
      for (let i = 0; i < createdInvoiceIds.length; i += USAGE_BATCH_SIZE) {
        const batch = createdInvoiceIds.slice(i, i + USAGE_BATCH_SIZE);
        await Promise.all(
          batch.map(invoiceId =>
            supabase.functions.invoke('track-invoice-usage', {
              body: { invoice_id: invoiceId }
            }).catch(err => console.log(`Usage tracking error for ${invoiceId}:`, err?.message))
          )
        );
      }
    }

    // Trigger AI workflow on last batch
    let draftsGenerated = 0;
    let workflowErrors: string[] = [];
    
    if (isLastBatch && fileType === "invoice_aging" && createdInvoiceIds.length > 0) {
      console.log(`Triggering AI workflow for ${createdInvoiceIds.length} new invoices`);
      
      const { data: newInvoices } = await supabase
        .from("invoices")
        .select("id, aging_bucket, due_date")
        .in("id", createdInvoiceIds);
      
      const bucketInvoices: Record<string, string[]> = {};
      
      for (const inv of newInvoices || []) {
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
        
        if (bucket) {
          if (!bucketInvoices[bucket]) bucketInvoices[bucket] = [];
          bucketInvoices[bucket].push(inv.id);
        }
      }
      
      // Trigger draft generation in parallel
      const draftPromises = Object.entries(bucketInvoices).map(async ([bucket]) => {
        try {
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
            return { bucket, drafts: result.drafts_created || 0 };
          } else {
            const errorText = await response.text();
            console.error(`Failed to generate drafts for bucket ${bucket}:`, errorText);
            return { bucket, error: true };
          }
        } catch (error: any) {
          console.error(`Error generating drafts for bucket ${bucket}:`, error);
          return { bucket, error: true };
        }
      });
      
      const draftResults = await Promise.all(draftPromises);
      
      for (const result of draftResults) {
        if (result.error) {
          workflowErrors.push(`Failed to generate drafts for ${result.bucket}`);
        } else {
          draftsGenerated += result.drafts || 0;
        }
      }
    }

    const duration = Date.now() - startTime;
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
      processingTimeMs: duration,
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
