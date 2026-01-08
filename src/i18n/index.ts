import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import de from './locales/de.json';
import it from './locales/it.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

const STORAGE_KEY = 'recouply_language';

const resources = {
  en: { translation: en },
  de: { translation: de },
  it: { translation: it },
  es: { translation: es },
  pt: { translation: pt },
};

// Get saved language or default to English
const savedLanguage = localStorage.getItem(STORAGE_KEY) || 'en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

// Save language to localStorage whenever it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
export { STORAGE_KEY };
