import { useState, useEffect } from 'react';

interface NicolasPreferences {
  assistantEnabled: boolean;
  onboardingCompleted: boolean;
  dismissedPageTips: string[];
}

const DEFAULT_PREFERENCES: NicolasPreferences = {
  assistantEnabled: true,
  onboardingCompleted: false,
  dismissedPageTips: [],
};

const STORAGE_KEY = 'nicolas_preferences';

export const useNicolasPreferences = () => {
  const [preferences, setPreferences] = useState<NicolasPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...parsed,
        });
      }
    } catch (error) {
      console.error('Error loading Nicolas preferences:', error);
    }
    setIsLoaded(true);
  }, []);

  const savePreferences = (newPrefs: NicolasPreferences) => {
    setPreferences(newPrefs);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
    } catch (error) {
      console.error('Error saving Nicolas preferences:', error);
    }
  };

  const toggleAssistant = (enabled: boolean) => {
    savePreferences({ ...preferences, assistantEnabled: enabled });
  };

  const completeOnboarding = () => {
    savePreferences({ ...preferences, onboardingCompleted: true });
  };

  const dismissPageTip = (pagePath: string) => {
    if (!preferences.dismissedPageTips.includes(pagePath)) {
      savePreferences({
        ...preferences,
        dismissedPageTips: [...preferences.dismissedPageTips, pagePath],
      });
    }
  };

  const resetOnboarding = () => {
    savePreferences({
      ...DEFAULT_PREFERENCES,
      assistantEnabled: preferences.assistantEnabled,
    });
  };

  return {
    preferences,
    isLoaded,
    toggleAssistant,
    completeOnboarding,
    dismissPageTip,
    resetOnboarding,
  };
};
