import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Document {
  id: string;
  organization_id?: string;
  debtor_id?: string;
  uploaded_by_user_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  category: string;
  status: string;
  version: number;
  metadata?: any;
  notes?: string;
  verified_by_user_id?: string;
  verified_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export function useDocuments(organizationId?: string, debtorId?: string) {
  return useQuery({
    queryKey: ["documents", organizationId, debtorId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      } else if (debtorId) {
        query = query.eq("debtor_id", debtorId);
      } else {
        // Get user's organization and fetch org documents
        const { data: orgId } = await supabase.rpc('get_user_organization_id', {
          p_user_id: user.id
        });
        
        if (orgId) {
          query = query.eq("organization_id", orgId);
        } else {
          // Fallback to user's own documents
          query = query.eq("uploaded_by_user_id", user.id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Document[];
    },
  });
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp", "image/gif"];

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      category,
      organizationId,
      debtorId,
      notes,
    }: {
      file: File;
      category: string;
      organizationId?: string;
      debtorId?: string;
      notes?: string;
    }) => {
      const filePath = `${Date.now()}-${file.name}`;
      let uploadPath = filePath;

      // Check if file is an image type - use moderated upload
      if (IMAGE_TYPES.includes(file.type)) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("purpose", `document_${category}`);
        formData.append("bucket", "documents");
        formData.append("storagePath", filePath);

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

        const result = await response.json();
        if (!response.ok) {
          if (result.rejected) {
            throw new Error("Image was rejected due to inappropriate content. Please upload a different image.");
          }
          throw new Error(result.error || "Failed to upload image");
        }
        uploadPath = result.storagePath;
      } else {
        // Non-image files: direct upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        uploadPath = uploadData.path;
      }

      // Create document record
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Get user's organization ID if not provided
      let effectiveOrgId = organizationId;
      if (!effectiveOrgId && !debtorId) {
        const { data: orgId } = await supabase.rpc('get_user_organization_id', {
          p_user_id: user.user.id
        });
        effectiveOrgId = orgId;
      }

      const insertData: any = {
        uploaded_by_user_id: user.user.id,
        file_url: uploadPath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        category,
        notes,
        organization_id: effectiveOrgId || null,
        debtor_id: debtorId || null,
      };

      const { data: document, error: docError } = await supabase
        .from("documents")
        .insert(insertData)
        .select()
        .single();

      if (docError) throw docError;

      // Log the upload action
      await supabase.rpc("log_document_access", {
        p_document_id: document.id,
        p_action: "upload",
      });

      // Trigger AI analysis
      try {
        await supabase.functions.invoke("analyze-document", {
          body: {
            documentId: document.id,
            category,
            fileName: file.name,
          },
        });
      } catch (aiError) {
        console.error("AI analysis failed:", aiError);
        // Don't fail the upload if AI analysis fails
      }

      return document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload document: ${error.message}`);
    },
  });
}

export function useUpdateDocumentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      status,
      notes,
    }: {
      documentId: string;
      status: string;
      notes?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const updates: any = { status, notes };

      if (status === "verified") {
        updates.verified_by_user_id = user.user.id;
        updates.verified_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("documents")
        .update(updates)
        .eq("id", documentId)
        .select()
        .single();

      if (error) throw error;

      // Log the status change
      await supabase.rpc("log_document_access", {
        p_document_id: documentId,
        p_action: status === "verified" ? "verify" : "status_change",
        p_metadata: { new_status: status },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document status updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update document: ${error.message}`);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      // Get document to get file path
      const { data: document } = await supabase
        .from("documents")
        .select("file_url")
        .eq("id", documentId)
        .single();

      if (document) {
        // Delete from storage
        await supabase.storage.from("documents").remove([document.file_url]);
      }

      // Delete document record
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;

      // Log the deletion
      await supabase.rpc("log_document_access", {
        p_document_id: documentId,
        p_action: "delete",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
}

export function useDocumentUrl(filePath: string | null | undefined) {
  return useQuery({
    queryKey: ["document-url", filePath],
    queryFn: async () => {
      if (!filePath) return null;

      const { data } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      // Log the view action
      const { data: document } = await supabase
        .from("documents")
        .select("id")
        .eq("file_url", filePath)
        .single();

      if (document) {
        await supabase.rpc("log_document_access", {
          p_document_id: document.id,
          p_action: "view",
        });
      }

      return data.publicUrl;
    },
    enabled: !!filePath,
  });
}
