import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase as baseSupabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecouplyLogo } from "@/components/layout/RecouplyLogo";

// The Supabase JS `auth.oauth` namespace is beta and not in the exported types yet.
// Keep a small local typing so we can call the three helpers cleanly.
type AuthorizationDetails = {
  redirect_url?: string;
  redirect_to?: string;
  client?: { name?: string; client_uri?: string };
  redirect_uri?: string;
  scope?: string;
};
type OAuthResult<T = AuthorizationDetails> = { data: T | null; error: { message: string } | null };
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const supabase = baseSupabase as unknown as typeof baseSupabase & {
  auth: (typeof baseSupabase)["auth"] & { oauth: OAuthNamespace };
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      setUserEmail(sess.session.user?.email ?? null);
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <RecouplyLogo />
          </div>
          <CardTitle>
            {details?.client?.name
              ? `Connect ${details.client.name} to Recouply`
              : "Authorize application"}
          </CardTitle>
          <CardDescription>
            {userEmail ? `Signed in as ${userEmail}` : "Reviewing authorization request…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-destructive border border-destructive/30 rounded p-3">
              {error}
            </div>
          )}
          {!details && !error && (
            <div className="text-sm text-muted-foreground text-center py-6">Loading…</div>
          )}
          {details && (
            <>
              <div className="text-sm space-y-2">
                <p>
                  <strong>{details.client?.name ?? "This client"}</strong> will be able to call
                  Recouply's enabled tools while you are signed in.
                </p>
                <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1">
                  <li>Read your debtors, invoices, and collection tasks</li>
                  <li>Actions run under your row-level security &mdash; scoped to your data</li>
                  <li>Does not bypass Recouply's permissions or backend policies</li>
                </ul>
                {details.redirect_uri && (
                  <p className="text-xs text-muted-foreground pt-2">
                    Redirect: <code className="break-all">{details.redirect_uri}</code>
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => decide(false)}
                >
                  Cancel connection
                </Button>
                <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                  {busy ? "Working…" : "Approve"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
