import { Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google: {
      translate: {
        TranslateElement: new (
          options: {
            pageLanguage: string;
            includedLanguages?: string;
            layout?: number;
            autoDisplay?: boolean;
          },
          elementId: string
        ) => void;
      };
    };
  }
}

const LanguageSelector = () => {
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (initialized.current) return;

    const initTranslate = () => {
      if (window.google?.translate?.TranslateElement && !initialized.current) {
        try {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              includedLanguages: 'en,es,fr,de,pt,zh-CN,ja,ko,ar,hi,it,nl,ru',
              autoDisplay: false
            },
            'google_translate_element'
          );
          initialized.current = true;
          setReady(true);
        } catch (e) {
          console.error('Google Translate init error:', e);
        }
      }
    };

    // Poll for Google Translate to be ready
    const checkInterval = setInterval(() => {
      if (window.google?.translate?.TranslateElement) {
        clearInterval(checkInterval);
        initTranslate();
      }
    }, 100);

    // Cleanup after 10 seconds
    const timeout = setTimeout(() => clearInterval(checkInterval), 10000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
      <Globe className="h-4 w-4" />
      <div id="google_translate_element" className="min-w-[60px]" />
    </div>
  );
};

export default LanguageSelector;
