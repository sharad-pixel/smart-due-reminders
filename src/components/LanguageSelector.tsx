import { Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

    const checkInterval = setInterval(() => {
      if (window.google?.translate?.TranslateElement) {
        clearInterval(checkInterval);
        initTranslate();
      }
    }, 100);

    const timeout = setTimeout(() => clearInterval(checkInterval), 10000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-[90]">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          >
            <Globe className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="start" 
          className="w-auto p-3"
        >
          <p className="text-xs text-muted-foreground mb-2">Translate page</p>
          <div id="google_translate_element" className="min-w-[120px]" />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default LanguageSelector;
