import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import venmoLogo from "@/assets/venmo-logo.png";
import paypalLogo from "@/assets/paypal-logo.png";
import cashappLogo from "@/assets/cashapp-logo.png";

const LOGOS: Record<string, string> = {
  Venmo: venmoLogo,
  PayPal: paypalLogo,
  "Cash App": cashappLogo,
};

interface QrCodeUploadFieldProps {
  label: string;
  value: string;
  effectiveAccountId: string | null;
  onChange: (url: string) => void;
}

export const QrCodeUploadField = ({
  label,
  value,
  effectiveAccountId,
  onChange,
}: QrCodeUploadFieldProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!effectiveAccountId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File must be under 2MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${effectiveAccountId}/qr-${label.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("org-logos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("org-logos")
        .getPublicUrl(path);

      onChange(urlData.publicUrl);
      toast.success(`${label} QR code uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const logo = LOGOS[label];

  return (
    <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 mb-1">
        {logo && (
          <img
            src={logo}
            alt={`${label} logo`}
            className="h-6 w-6 object-contain"
            loading="lazy"
          />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt={`${label} QR Code`}
            className="h-24 w-24 rounded-md border object-contain bg-white"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
            onClick={() => onChange("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="w-full h-20 border-dashed"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            {uploading ? "Uploading…" : "Upload QR Code"}
          </Button>
        </div>
      )}
    </div>
  );
};
