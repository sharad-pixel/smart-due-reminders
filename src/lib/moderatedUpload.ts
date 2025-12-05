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
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/moderated-image-upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Upload failed",
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
