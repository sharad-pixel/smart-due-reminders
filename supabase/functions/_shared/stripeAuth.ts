// Shared helpers for resolving a user's Stripe secret key & effective account.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

export async function decryptStripeKey(encryptedValue: string): Promise<string> {
  const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
  if (!encryptionKey) throw new Error("Encryption key not configured");

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const encryptedData = Uint8Array.from(atob(encryptedValue), (c) => c.charCodeAt(0));
  const iv = encryptedData.slice(0, 12);
  const data = encryptedData.slice(12);

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(encryptionKey).slice(0, 32),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return decoder.decode(decrypted);
}

export async function resolveStripeContext(authHeader: string | null) {
  if (!authHeader) throw new Error("No authorization header provided");
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error } = await supa.auth.getUser(token);
  if (error || !userData.user) throw new Error("Not authenticated");
  const user = userData.user;

  const { data: effective } = await supa.rpc("get_effective_account_id", { p_user_id: user.id });
  const accountId = (effective as string) || user.id;

  const { data: integ } = await supa
    .from("stripe_integrations")
    .select("stripe_secret_key_encrypted, is_connected, stripe_account_id")
    .eq("user_id", accountId)
    .maybeSingle();

  if (!integ?.is_connected || !integ.stripe_secret_key_encrypted) {
    throw new Error("Stripe is not connected for this account");
  }

  const stripeKey = await decryptStripeKey(integ.stripe_secret_key_encrypted);
  return { supa, user, accountId, stripeKey, stripeAccountId: integ.stripe_account_id as string | null };
}
