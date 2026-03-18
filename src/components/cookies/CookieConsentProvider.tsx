import { createContext, useContext, ReactNode } from 'react';
import { useCookieConsent, type CookieCategory, type CookiePreferences } from '@/hooks/useCookieConsent';
import { CookieConsentBanner } from './CookieConsentBanner';
import { CookiePreferencesModal } from './CookiePreferencesModal';

interface CookieConsentContextValue {
  preferences: CookiePreferences | null;
  hasConsent: (category: CookieCategory) => boolean;
  openPreferences: () => void;
  resetConsent: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function useCookieConsentContext() {
  const context = useContext(CookieConsentContext);
  if (!context) {
    throw new Error('useCookieConsentContext must be used within CookieConsentProvider');
  }
  return context;
}

interface CookieConsentProviderProps {
  children: ReactNode;
}

export function CookieConsentProvider({ children }: CookieConsentProviderProps) {
  const {
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
  } = useCookieConsent();

  const contextValue: CookieConsentContextValue = {
    preferences,
    hasConsent,
    openPreferences: () => setShowPreferences(true),
    resetConsent,
  };

  if (isLoading) {
    return <>{children}</>;
  }

  return (
    <CookieConsentContext.Provider value={contextValue}>
      {children}
      
      {showBanner && (
        <CookieConsentBanner
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onManagePreferences={() => setShowPreferences(true)}
        />
      )}
      
      <CookiePreferencesModal
        open={showPreferences}
        onOpenChange={setShowPreferences}
        currentPreferences={preferences}
        onSave={savePreferences}
        onAcceptAll={acceptAll}
        onRejectAll={rejectAll}
      />
    </CookieConsentContext.Provider>
  );
}
