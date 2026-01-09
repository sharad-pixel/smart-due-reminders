import { supabase } from "@/integrations/supabase/client";

interface ModeratedUploadOptions {
  file: File;
  purpose: string;
  bucket: string;
  storagePath?: string;
}

interface ModeratedUploadResult {
  success: boolean;
  publicUrl?: string;
  storagePath?: string;
  error?: string;
  rejected?: boolean;
}

/**
 * Upload an image through the moderated upload pipeline.
 * All image uploads should go through this function to ensure content moderation.
 */
export async function uploadModeratedImage(
  options: ModeratedUploadOptions
): Promise<ModeratedUploadResult> {
  const { file, purpose, bucket, storagePath } = options;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", purpose);
  formData.append("bucket", bucket);
  if (storagePath) {
    formData.append("storagePath", storagePath);
  }

  try {
    // Use supabase.functions.invoke for reliable edge function calls
    const { data, error } = await supabase.functions.invoke("moderated-image-upload", {
      body: formData,
    });

    if (error) {
      console.error("Moderated upload error:", error);
      return {
        success: false,
        error: error.message || "Upload failed",
        rejected: false,
      };
    }

    if (data?.error) {
      return {
        success: false,
        error: data.error,
        rejected: data.rejected || false,
      };
    }

    return {
      success: true,
      publicUrl: data.publicUrl,
      storagePath: data.storagePath,
    };
  } catch (error) {
    console.error("Moderated upload error:", error);
    return {
      success: false,
      error: "Network error. Please try again.",
    };
  }
}
