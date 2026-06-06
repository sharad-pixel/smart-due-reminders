import { ReactNode } from "react";

/**
 * CLM entitlement gating has been removed — Contract Intelligence is available
 * to every account. This component is kept as a pass-through for backwards
 * compatibility with existing routes.
 */
export const RequireClmAccess = ({ children }: { children: ReactNode }) => <>{children}</>;
