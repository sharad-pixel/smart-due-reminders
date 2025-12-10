import { useState, useEffect, useCallback } from 'react';

export type CookieCategory = 'necessary' | 'functional' | 'analytics' | 'marketing';

export interface CookiePreferences {
  necessary: boolean; // Always true, cannot be disabled
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

const COOKIE_CONSENT_KEY = 'recouply_cookie_consent';

const defaultPreferences: CookiePreferences = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
  timestamp: '',
};

export function useCookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CookiePreferences;
        setPreferences(parsed);
        setShowBanner(false);
      } else {
        setShowBanner(true);
      }
    } catch {
      setShowBanner(true);
    }
    setIsLoading(false);
  }, []);

  const savePreferences = useCallback((newPreferences: Omit<CookiePreferences, 'necessary' | 'timestamp'>) => {
    const fullPreferences: CookiePreferences = {
      ...newPreferences,
      necessary: true, // Always required
      timestamp: new Date().toISOString(),
    };
    
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(fullPreferences));
    setPreferences(fullPreferences);
    setShowBanner(false);
    setShowPreferences(false);
  }, []);

  const acceptAll = useCallback(() => {
    savePreferences({
      functional: true,
      analytics: true,
      marketing: true,
    });
  }, [savePreferences]);

  const rejectAll = useCallback(() => {
    savePreferences({
      functional: false,
      analytics: false,
      marketing: false,
    });
  }, [savePreferences]);

  const hasConsent = useCallback((category: CookieCategory): boolean => {
    if (!preferences) return category === 'necessary';
    return preferences[category] ?? false;
  }, [preferences]);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    setPreferences(null);
    setShowBanner(true);
  }, []);

  return {
    preferences,
    isLoading,
    showBanner,
    showPreferences,
    setShowPreferences,
    savePreferences,
    acceptAll,
    rejectAll,
    hasConsent,
    resetConsent,
  };
}
