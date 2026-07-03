import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Link2Off, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  debtorId: string | null;
  debtorName: string | null;
  stripeCustomerId: string | null;
}

/**
 * Explains the contract → Recouply account → Stripe customer chain and
 * surfaces exactly where to fix the link. Required before any Stripe push.
 */
export function ContractCustomerLinkCard({ debtorId, debtorName, stripeCustomerId }: Props) {
  const linked = !!stripeCustomerId;
  const noDebtor = !debtorId;

  return (
    <Card className={linked ? "" : "border-amber-500/40 bg-amber-500/5"}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            {linked ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            Customer link
          </span>
          {linked ? (
            <Badge variant="secondary">Linked</Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/50 text-amber-700">
              Required
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {noDebtor ? (
          <p className="text-muted-foreground">
            This contract isn't linked to a Recouply account yet. Approve the contract from
            the review screen — a customer record is created automatically as part of the
            approval flow.
          </p>
        ) : linked ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Billing this contract will use</span>
            <code className="px-2 py-1 rounded bg-muted text-xs">{stripeCustomerId}</code>
            <a
              href={`https://dashboard.stripe.com/customers/${stripeCustomerId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
            >
              View in Stripe <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <>
            <p className="text-foreground">
              <strong>{debtorName || "This account"}</strong> is not yet linked to a Stripe
              customer. We require an explicit link before syncing so the right customer is
              billed — no automatic email lookups, no accidental duplicates.
            </p>
            <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1">
              <li>Open the account page.</li>
              <li>In the <em>Stripe Customer</em> card, search for an existing customer or create a new one.</li>
              <li>Return here — the sync button unlocks once the link is saved.</li>
            </ol>
          </>
        )}

        <div className="flex items-center gap-2 pt-1">
          {debtorId && (
            <Button asChild size="sm" variant={linked ? "outline" : "default"}>
              <Link to={`/accounts/${debtorId}`}>
                {linked ? (
                  <>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    Manage link
                  </>
                ) : (
                  <>
                    <Link2Off className="h-3.5 w-3.5 mr-1.5" />
                    Link Stripe customer
                  </>
                )}
              </Link>
            </Button>
          )}
          <a
            href="/docs/stripe-customer-linking"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:underline"
          >
            How does linking work?
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
