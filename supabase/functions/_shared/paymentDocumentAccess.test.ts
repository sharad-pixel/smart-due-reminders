import { expect, test } from "bun:test";
import { isPaymentDocumentAvailable } from "./paymentDocumentAccess";

test("attached wire or payment details remain downloadable while available", () => {
  expect(isPaymentDocumentAvailable({ status: "uploaded", expires_at: null })).toBe(true);
});
test("rejected payment documents are not shared with invoice recipients", () => {
  expect(isPaymentDocumentAvailable({ status: "rejected", expires_at: null })).toBe(false);
});
test("expired payment details are not shared with invoice recipients", () => {
  expect(isPaymentDocumentAvailable({ status: "verified", expires_at: "2026-10-29T00:00:00Z" }, new Date("2026-10-30T00:00:00Z"))).toBe(false);
});