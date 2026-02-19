import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Enterprise-grade session timeout management
 * Compliant with PCI-DSS 8.1.8 and FFIEC guidelines:
 * - 15-minute idle timeout
 * - 8-hour absolute session timeout
 * - 2-minute warning before idle logout
 * - Activity tracking on user interactions
 */

// Idle timeout: 30 minutes
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
// Warning shown 2 minutes before idle logout
const IDLE_WARNING_MS = IDLE_TIMEOUT_MS - 2 * 60 * 1000;
// Absolute session timeout: 12 hours
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
// How often to check timeouts
const CHECK_INTERVAL_MS = 30 * 1000;
// Debounce activity updates (avoid flooding)
const ACTIVITY_DEBOUNCE_MS = 60 * 1000;

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "mousemove",
] as const;

const STORAGE_KEY_LAST_ACTIVITY = "recouply_last_activity";
const STORAGE_KEY_SESSION_START = "recouply_session_start";

export interface SessionTimeoutState {
  isWarningVisible: boolean;
  secondsRemaining: number;
  sessionStartedAt: number | null;
  lastActivityAt: number;
  extendSession: () => void;
}

export function useSessionTimeout(enabled = true): SessionTimeoutState {
  const navigate = useNavigate();
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number | null>(null);
  const debounceRef = useRef<number>(0);
  const warningToastRef = useRef<string | number | null>(null);

  // Record user activity
  const recordActivity = useCallback(() => {
    const now = Date.now();
    // Debounce to avoid performance issues
    if (now - debounceRef.current < 1000) return;
    debounceRef.current = now;
    lastActivityRef.current = now;
    localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));

    // If warning was showing and user is active, dismiss it
    if (isWarningVisible) {
      setIsWarningVisible(false);
      if (warningToastRef.current) {
        toast.dismiss(warningToastRef.current);
        warningToastRef.current = null;
      }
    }
  }, [isWarningVisible]);

  // Extend session (dismiss warning and reset timers)
  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
    setIsWarningVisible(false);
    if (warningToastRef.current) {
      toast.dismiss(warningToastRef.current);
      warningToastRef.current = null;
    }
    toast.success("Session extended");
  }, []);

  // Force logout
  const forceLogout = useCallback(
    async (reason: string) => {
      try {
        // Log the timeout event
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("audit_logs").insert({
            user_id: user.id,
            action_type: "session_timeout",
            resource_type: "session",
            metadata: { reason, idle_timeout_minutes: IDLE_TIMEOUT_MS / 60000 },
          });
        }
      } catch (e) {
        console.error("Failed to log session timeout:", e);
      }

      localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
      localStorage.removeItem(STORAGE_KEY_SESSION_START);
      await supabase.auth.signOut();
      navigate("/", { replace: true });
      toast.error(
        reason === "absolute_timeout"
          ? "Session expired. Maximum session duration reached. Please sign in again."
          : "Session expired due to inactivity. Please sign in again.",
      );
    },
    [navigate],
  );

  // Initialize session start tracking
  useEffect(() => {
    if (!enabled) return;

    const stored = localStorage.getItem(STORAGE_KEY_SESSION_START);
    if (stored) {
      sessionStartRef.current = parseInt(stored, 10);
    }

    const storedActivity = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
    if (storedActivity) {
      lastActivityRef.current = parseInt(storedActivity, 10);
    }

    // Listen for auth state to set session start
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        const now = Date.now();
        sessionStartRef.current = now;
        lastActivityRef.current = now;
        localStorage.setItem(STORAGE_KEY_SESSION_START, String(now));
        localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
      } else if (event === "SIGNED_OUT") {
        sessionStartRef.current = null;
        localStorage.removeItem(STORAGE_KEY_SESSION_START);
        localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
      }
    });

    return () => subscription.unsubscribe();
  }, [enabled]);

  // Attach activity listeners
  useEffect(() => {
    if (!enabled) return;

    ACTIVITY_EVENTS.forEach((event) =>
      document.addEventListener(event, recordActivity, { passive: true }),
    );

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        document.removeEventListener(event, recordActivity),
      );
    };
  }, [enabled, recordActivity]);

  // Periodic timeout check
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const now = Date.now();
      const lastActivity = lastActivityRef.current;
      const sessionStart = sessionStartRef.current;

      // Check absolute timeout (8 hours)
      if (sessionStart && now - sessionStart >= ABSOLUTE_TIMEOUT_MS) {
        forceLogout("absolute_timeout");
        return;
      }

      const idleTime = now - lastActivity;

      // Check idle timeout (15 minutes)
      if (idleTime >= IDLE_TIMEOUT_MS) {
        forceLogout("idle_timeout");
        return;
      }

      // Show warning at 13 minutes (2 min before timeout)
      if (idleTime >= IDLE_WARNING_MS && !isWarningVisible) {
        const remaining = Math.ceil(
          (IDLE_TIMEOUT_MS - idleTime) / 1000,
        );
        setSecondsRemaining(remaining);
        setIsWarningVisible(true);
      }

      // Update countdown if warning is visible
      if (isWarningVisible) {
        const remaining = Math.max(
          0,
          Math.ceil((IDLE_TIMEOUT_MS - idleTime) / 1000),
        );
        setSecondsRemaining(remaining);
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [enabled, forceLogout, isWarningVisible]);

  // Update session activity in DB periodically (every 60s of activity)
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_DEBOUNCE_MS) {
        // User was active recently, update session record
        await supabase
          .from("user_sessions")
          .update({ last_active_at: new Date().toISOString() })
          .eq("user_id", session.user.id)
          .eq("is_current", true);
      }
    }, ACTIVITY_DEBOUNCE_MS);

    return () => clearInterval(interval);
  }, [enabled]);

  // Cross-tab sync: listen for storage changes
  useEffect(() => {
    if (!enabled) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_LAST_ACTIVITY && e.newValue) {
        lastActivityRef.current = parseInt(e.newValue, 10);
        if (isWarningVisible) {
          setIsWarningVisible(false);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [enabled, isWarningVisible]);

  return {
    isWarningVisible,
    secondsRemaining,
    sessionStartedAt: sessionStartRef.current,
    lastActivityAt: lastActivityRef.current,
    extendSession,
  };
}
