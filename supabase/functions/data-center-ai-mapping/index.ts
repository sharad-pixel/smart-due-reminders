import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MappingRequest {
  headers: string[];
  sampleRows: Record<string, any>[];
  fileType: "invoice_aging" | "payments" | "accounts";
}

// Field definitions for mapping - aligned with Create New Account form
const FIELD_DEFINITIONS = {
  customer: [
    { key: "company_name", label: "Company Name", aliases: ["company", "company name", "business name", "account name", "customer name", "client name", "name"] },
    { key: "account_type", label: "Type", aliases: ["type", "account type", "customer type", "business type", "b2b", "b2c"] },
    { key: "contact_name", label: "Contact Name", aliases: ["contact", "contact name", "primary contact", "contact person", "full name", "name"] },
    { key: "contact_title", label: "Contact Title", aliases: ["title", "contact title", "job title", "position", "role"] },
    { key: "contact_email", label: "Contact Email", aliases: ["email", "contact email", "customer email", "primary email", "email address"] },
    { key: "contact_phone", label: "Contact Phone", aliases: ["phone", "contact phone", "telephone", "phone number", "mobile"] },
    { key: "address_line1", label: "Address Line 1", aliases: ["address", "address 1", "address line 1", "street", "street address"] },
    { key: "address_line2", label: "Address Line 2", aliases: ["address 2", "address line 2", "apt", "suite", "unit"] },
    { key: "city", label: "City", aliases: ["city", "town"] },
    { key: "state", label: "State", aliases: ["state", "province", "region"] },
    { key: "postal_code", label: "Postal Code", aliases: ["postal code", "zip", "zip code", "postcode"] },
    { key: "country", label: "Country", aliases: ["country", "nation"] },
    { key: "external_customer_id", label: "Account ID (Billing System)", aliases: ["account id", "billing id", "customer id", "external id", "qb id", "quickbooks id"] },
    { key: "crm_id", label: "CRM ID", aliases: ["crm id", "salesforce id", "sf id", "hubspot id", "crm account"] },
    { key: "industry", label: "Industry", aliases: ["industry", "sector", "vertical", "business industry"] },
    { key: "account_notes", label: "Notes", aliases: ["notes", "comments", "remarks", "account notes"] },
    { key: "recouply_account_id", label: "Recouply Account ID (RAID)", aliases: ["raid", "recouply id", "recouply account id", "account raid"] },
  ],
  invoice: [
    { key: "invoice_number", label: "Invoice Number", aliases: ["invoice", "inv", "invoice no", "invoice number", "inv no", "inv #", "invoice #", "document number", "doc no"] },
    { key: "invoice_date", label: "Invoice Date", aliases: ["invoice date", "inv date", "date", "issue date", "document date"] },
    { key: "due_date", label: "Due Date", aliases: ["due date", "due", "payment due", "due by", "payment date due"] },
    { key: "amount_original", label: "Original Amount", aliases: ["amount", "total", "invoice amount", "original amount", "total amount", "invoice total", "gross amount"] },
    { key: "amount_outstanding", label: "Outstanding Amount", aliases: ["outstanding", "balance", "amount due", "remaining", "open amount", "outstanding amount", "balance due"] },
    { key: "currency", label: "Currency", aliases: ["currency", "curr", "ccy"] },
    { key: "invoice_status", label: "Invoice Status", aliases: ["status", "invoice status", "state"] },
    { key: "po_number", label: "PO Number", aliases: ["po", "po number", "purchase order", "po #"] },
    { key: "product_description", label: "Product Description", aliases: ["description", "product", "service", "item", "line item", "product description"] },
    { key: "external_invoice_id", label: "External Invoice ID", aliases: ["external id", "system id", "reference"] },
    { key: "recouply_account_id", label: "Recouply Account ID (RAID)", aliases: ["raid", "recouply id", "recouply account id", "account raid", "customer raid"] },
  ],
  payment: [
    { key: "payment_date", label: "Payment Date", aliases: ["payment date", "pay date", "date paid", "received date", "deposit date"] },
    { key: "payment_amount", label: "Payment Amount", aliases: ["payment", "amount", "payment amount", "amount paid", "paid amount"] },
    { key: "payment_reference", label: "Payment Reference", aliases: ["reference", "check number", "check no", "check #", "transaction id", "confirmation"] },
    { key: "payment_method", label: "Payment Method", aliases: ["method", "payment method", "pay method", "type"] },
    { key: "payment_notes", label: "Payment Notes", aliases: ["notes", "memo", "comments", "payment notes"] },
    { key: "recouply_account_id", label: "Recouply Account ID (RAID)", aliases: ["raid", "recouply id", "recouply account id", "account raid"] },
    { key: "recouply_invoice_id", label: "Recouply Invoice ID", aliases: ["rinvd", "recouply invoice", "invoice raid"] },
    { key: "payment_invoice_number", label: "Invoice Number", aliases: ["invoice", "invoice number", "inv no", "invoice #"] },
  ],
  meta: [
    { key: "notes", label: "Notes", aliases: ["notes", "comments", "remarks"] },
    { key: "source_system", label: "Source System", aliases: ["source", "system", "origin"] },
  ],
};

function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Simple Levenshtein-based similarity
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

function inferDataType(values: any[]): string {
  const nonNullValues = values.filter(v => v != null && v !== "");
  if (nonNullValues.length === 0) return "string";
  
  const sample = nonNullValues[0];
  
  // Check if it looks like a date
  if (typeof sample === "object" && sample instanceof Date) return "date";
  const datePattern = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/;
  if (typeof sample === "string" && datePattern.test(sample)) return "date";
  
  // Check if it's a number
  if (typeof sample === "number") return "number";
  if (typeof sample === "string" && !isNaN(parseFloat(sample.replace(/[$,]/g, "")))) return "number";
  
  return "string";
}

function findBestMatch(
  header: string,
  sampleValues: any[],
  relevantFields: typeof FIELD_DEFINITIONS.customer,
  usedKeys: Set<string>
): { fieldKey: string | null; confidence: number } {
  let bestMatch: { fieldKey: string | null; confidence: number } = { fieldKey: null, confidence: 0 };
  
  const normalizedHeader = normalizeString(header);
  const inferredType = inferDataType(sampleValues);
  
  for (const field of relevantFields) {
    // Skip already used fields
    if (usedKeys.has(field.key)) continue;
    
    // Check against all aliases
    for (const alias of field.aliases) {
      const similarity = calculateSimilarity(header, alias);
      
      if (similarity > bestMatch.confidence) {
        bestMatch = { fieldKey: field.key, confidence: similarity };
      }
    }
    
    // Direct key match
    const keyMatch = calculateSimilarity(header, field.key);
    if (keyMatch > bestMatch.confidence) {
      bestMatch = { fieldKey: field.key, confidence: keyMatch };
    }
  }
  
  // Apply confidence threshold
  if (bestMatch.confidence < 0.5) {
    return { fieldKey: null, confidence: 0 };
  }
  
  return bestMatch;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headers, sampleRows, fileType }: MappingRequest = await req.json();
    
    console.log("AI Mapping request:", { headerCount: headers.length, sampleCount: sampleRows.length, fileType });
    
    // Determine relevant field groups based on file type
    let relevantGroups: string[];
    if (fileType === "accounts") {
      relevantGroups = ["customer", "meta"];
    } else if (fileType === "invoice_aging") {
      relevantGroups = ["customer", "invoice", "meta"];
    } else {
      relevantGroups = ["customer", "payment", "meta"];
    }
    
    const relevantFields = relevantGroups.flatMap(group => 
      FIELD_DEFINITIONS[group as keyof typeof FIELD_DEFINITIONS] || []
    );
    
    const usedKeys = new Set<string>();
    const mappings: Array<{ fileColumn: string; fieldKey: string | null; confidence: number }> = [];
    
    for (const header of headers) {
      // Get sample values for this column
      const sampleValues = sampleRows.map(row => row[header]).filter(v => v != null);
      
      const match = findBestMatch(header, sampleValues, relevantFields, usedKeys);
      
      if (match.fieldKey) {
        usedKeys.add(match.fieldKey);
      }
      
      mappings.push({
        fileColumn: header,
        fieldKey: match.fieldKey,
        confidence: match.confidence,
      });
    }
    
    console.log("AI Mapping results:", mappings.filter(m => m.fieldKey));
    
    return new Response(
      JSON.stringify({ mappings }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("AI Mapping error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
