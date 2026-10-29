import { describe, expect, test } from "bun:test";
import { isTrustedInboundRequest } from "./inboundAuth";

describe("inbound internal authentication", () => {
  test("accepts the backend service credential for webhook handoff and replay", () => {
    expect(isTrustedInboundRequest("Bearer test-service", "test-service")).toBe(true);
  });
  test("does not trust a signed-in user's token", () => {
    expect(isTrustedInboundRequest("Bearer user-token", "test-service")).toBe(false);
  });
  test("does not allow unsigned requests", () => {
    expect(isTrustedInboundRequest(null, "test-service")).toBe(false);
  });
  test("fails closed when the service credential is missing", () => {
    expect(isTrustedInboundRequest("Bearer undefined", undefined)).toBe(false);
  });
});