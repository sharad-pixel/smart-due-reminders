import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { SessionTimeoutWarning } from "./SessionTimeoutWarning";
import { useAccess } from "@/contexts/AccessContext";

/**
 * Wraps the app to provide enterprise-grade session security:
 * - PCI-DSS compliant idle timeout (15 min)
 * - FFIEC absolute session timeout (8 hr)
 * - Cross-tab session sync
 * - Visual timeout warning
 */
export function SessionSecurityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAccess();
  const { isWarningVisible, secondsRemaining, extendSession } =
    useSessionTimeout(!!user);

  return (
    <>
      {children}
      <SessionTimeoutWarning
        isOpen={isWarningVisible}
        secondsRemaining={secondsRemaining}
        onExtend={extendSession}
      />
    </>
  );
}
