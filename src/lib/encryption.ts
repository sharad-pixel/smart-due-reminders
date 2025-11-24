import { supabase } from "@/integrations/supabase/client";

/**
 * Encrypt sensitive data before storing in database
 * This calls a backend function that uses proper encryption
 */
export async function encryptField(value: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('encrypt-field', {
    body: { value }
  });
  
  if (error) throw error;
  return data.encrypted;
}

/**
 * Decrypt sensitive data when retrieving from database
 */
export async function decryptField(encryptedValue: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('decrypt-field', {
    body: { encrypted: encryptedValue }
  });
  
  if (error) throw error;
  return data.decrypted;
}

/**
 * Mask sensitive data for display (e.g., credit cards, SSN)
 */
export function maskSensitiveData(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars) return value;
  const masked = '*'.repeat(value.length - visibleChars);
  return masked + value.slice(-visibleChars);
}

/**
 * Check if user has permission to access specific resource
 */
export async function checkResourceAccess(
  resourceType: string,
  resourceId: string,
  action: 'read' | 'write' | 'delete'
): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('check-access', {
    body: { resourceType, resourceId, action }
  });
  
  if (error) return false;
  return data.hasAccess;
}
