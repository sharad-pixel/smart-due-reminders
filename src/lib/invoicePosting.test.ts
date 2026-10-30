import { describe, expect, test } from "bun:test";
import { isInvoiceEditLocked, isRecouplyManualInvoice } from "./invoicePosting";

describe("manual invoice editing", () => {
  test("Recouply-created invoices remain editable when posted", () => {
    expect(isInvoiceEditLocked({ integration_source: "recouply_manual", posting_state: "posted" })).toBe(false);
    expect(isInvoiceEditLocked({ source_system: "manual", posting_state: "posted" })).toBe(false);
    expect(isInvoiceEditLocked({ posting_state: "posted" })).toBe(false);
  });
  test("posted contract invoices stay locked", () => {
    expect(isInvoiceEditLocked({ integration_source: "recouply_manual", source_contract_id: "contract", posting_state: "posted" })).toBe(true);
  });
  test("source-system invoices are not classified as manual", () => {
    for (const source of ["stripe", "quickbooks", "xero", "netsuite", "sage_intacct", "ocr", "csv_upload"]) {
      expect(isRecouplyManualInvoice({ integration_source: source })).toBe(false);
    }
  });
});