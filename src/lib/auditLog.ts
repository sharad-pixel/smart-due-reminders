import { supabase } from "@/integrations/supabase/client";

export type AuditAction = 
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "view"
  | "send_email"
  | "send_sms"
  | "permission_change"
  | "config_change"
  | "export_data"
  | "bulk_action";

export type ResourceType =
  | "debtor"
  | "invoice"
  | "draft"
  | "workflow"
  | "task"
  | "profile"
  | "team_member"
  | "settings"
  | "ai_command"
  | "email_domain";

export interface AuditLogParams {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

export async function logAuditEvent({
  action,
  resourceType,
  resourceId,
  oldValues,
  newValues,
  metadata = {},
}: AuditLogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn("Cannot log audit event: No user session");
      return null;
    }

    const { data, error } = await supabase
      .from("audit_logs")
      .insert({
        user_id: user.id,
        action_type: action,
        resource_type: resourceType,
        resource_id: resourceId || null,
        old_values: oldValues || null,
        new_values: newValues || null,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to log audit event:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error logging audit event:", error);
    return null;
  }
}

export async function logSecurityEvent({
  eventType,
  userId,
  email,
  success,
  failureReason,
  metadata = {},
}: {
  eventType: string;
  userId?: string;
  email?: string;
  success: boolean;
  failureReason?: string;
  metadata?: Record<string, any>;
}) {
  try {
    const { data, error } = await supabase
      .from("security_events")
      .insert({
        event_type: eventType,
        user_id: userId || null,
        email: email || null,
        success,
        failure_reason: failureReason || null,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to log security event:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error logging security event:", error);
    return null;
  }
}
