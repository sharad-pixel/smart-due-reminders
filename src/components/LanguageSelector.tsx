import { Globe } from "lucide-react";

const LanguageSelector = () => {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
      <Globe className="h-4 w-4" />
      <div id="google_translate_element" className="[&_.goog-te-gadget-simple]:!bg-transparent [&_.goog-te-gadget-simple]:!border-none" />
    </div>
  );
};

export default LanguageSelector;
