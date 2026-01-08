import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import de from './locales/de.json';
import it from './locales/it.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

export const STORAGE_KEY = 'recouply_language';

const resources = {
  en: { translation: en },
  de: { translation: de },
  it: { translation: it },
  es: { translation: es },
  pt: { translation: pt },
};

// Get saved language or default to English
const getSavedLanguage = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

// Save language to localStorage whenever it changes
i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lng);
  }
});

export default i18n;
