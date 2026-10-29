// Only the backend service credential can bypass external webhook signatures.
export function isTrustedInboundRequest(authorization: string | null, serviceKey: string | undefined): boolean {
  return Boolean(serviceKey && authorization === `Bearer ${serviceKey}`);
}