import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, ImageIcon, ShieldCheck } from "lucide-react";
import { uploadModeratedImage } from "@/lib/moderatedUpload";

interface LogoUploadProps {
  currentLogoUrl: string | null;
  onLogoChange: (url: string | null) => void;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];

export function LogoUpload({ currentLogoUrl, onLogoChange }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, or SVG file");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File size must be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
      const storagePath = `${user.id}/logo.${fileExt}`;

      // Delete existing logo if any
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split("/org-logos/")[1];
        if (oldPath) {
          await supabase.storage.from("org-logos").remove([oldPath]);
        }
      }

      // Upload through moderated pipeline
      const result = await uploadModeratedImage({
        file,
        purpose: "org_logo",
        bucket: "org-logos",
        storagePath,
      });

      if (!result.success) {
        if (result.rejected) {
          toast.error(result.error || "Image was rejected due to inappropriate content");
        } else {
          toast.error(result.error || "Failed to upload logo");
        }
        return;
      }

      // Update branding settings
      const { error: updateError } = await supabase
        .from("branding_settings")
        .upsert({
          user_id: user.id,
          logo_url: result.publicUrl,
          business_name: "", // Required field, will be merged
        }, { onConflict: "user_id" });

      if (updateError) throw updateError;

      onLogoChange(result.publicUrl!);
      toast.success("Logo updated. It will appear on all outgoing message signatures.");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload logo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return;

    setRemoving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete from storage
      const path = currentLogoUrl.split("/org-logos/")[1];
      if (path) {
        await supabase.storage.from("org-logos").remove([path]);
      }

      // Clear from branding settings
      const { error } = await supabase
        .from("branding_settings")
        .update({ logo_url: null })
        .eq("user_id", user.id);

      if (error) throw error;

      onLogoChange(null);
      toast.success("Logo removed. Messages will use text-only signatures.");
    } catch (error: any) {
      console.error("Remove error:", error);
      toast.error(error.message || "Failed to remove logo");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-6">
          {currentLogoUrl ? (
            <div className="space-y-4 text-center">
              <div className="relative inline-block">
                <img
                  src={currentLogoUrl}
                  alt="Company logo"
                  className="max-w-[200px] max-h-[80px] object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Current logo preview
              </p>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No logo uploaded yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {currentLogoUrl ? "Change Logo" : "Upload Company Logo"}
        </Button>

        {currentLogoUrl && (
          <Button
            variant="destructive"
            onClick={handleRemoveLogo}
            disabled={removing}
          >
            {removing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Remove Logo
          </Button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
        <p>
          All uploads are automatically scanned for inappropriate content.
          This logo will appear in the footer/signature of all outbound Recouply.ai messages.
          Recommended: Transparent PNG or SVG with landscape orientation. Max 2MB.
        </p>
      </div>
    </div>
  );
}
