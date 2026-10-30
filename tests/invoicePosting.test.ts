import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { isInvoiceEditLocked, isRecouplyManualInvoice } from "../src/lib/invoicePosting";

describe("manual invoice editing", () => {
  test("Recouply-created invoices remain editable when posted", () => {
    assert.equal(isInvoiceEditLocked({ integration_source: "recouply_manual", posting_state: "posted" }), false);
    assert.equal(isInvoiceEditLocked({ source_system: "manual", posting_state: "posted" }), false);
    assert.equal(isInvoiceEditLocked({ posting_state: "posted" }), false);
  });
  test("posted contract invoices stay locked", () => {
    assert.equal(isInvoiceEditLocked({ integration_source: "recouply_manual", source_contract_id: "contract", posting_state: "posted" }), true);
  });
  test("source-system invoices are not classified as manual", () => {
    for (const source of ["stripe", "quickbooks", "xero", "netsuite", "sage_intacct", "ocr", "csv_upload"]) {
      assert.equal(isRecouplyManualInvoice({ integration_source: source }), false);
    }
  });
});