# Linking Contracts to Stripe Customers

Recouply requires every contract to be linked to a **Recouply account** (the customer
record on your side), and that account to be linked to a **Stripe customer** (`cus_…`),
**before** any billing sync or invoice push runs.

We enforce this on purpose: silent email-based lookups were creating duplicate customers
in Stripe and, occasionally, billing the wrong company when two customers shared an
email. The link is now a one-time, deliberate choice — after that, every push uses the
same customer.

---

## The chain

```
Contract  ──►  Recouply account (debtor)  ──►  Stripe customer (cus_…)
```

Both links are required. If either is missing, sync and invoice-push buttons are
disabled and the UI tells you exactly which step is missing.

---

## Step 1 — Contract → Recouply account (automatic)

When you approve a contract from the review screen, Recouply automatically:

1. Tries to match the contract's customer to an existing account by name/email.
2. If nothing matches, **creates a new account** using the extracted customer details
   (company name, email, billing address, payment terms).
3. Writes that `debtor_id` back to the contract.

You don't do anything for this step other than approve the contract. If you ever see
"This contract isn't linked to a Recouply account", the contract skipped the standard
approval flow — re-open it and approve it.

## Step 2 — Recouply account → Stripe customer (one-click)

Open the account page. In the **Stripe Customer** card you have three options:

1. **Search** by email, company name, or `cus_…` id. Pick the right customer from the
   results and click **Link**. Recouply flags any candidate that's already linked to
   another Recouply account so you don't double-book.
2. **Create new in Stripe** — mints a fresh customer in your Stripe account with the
   Recouply account details. Before creating, we look up the email in Stripe: if a
   match exists we ask you to link it instead. You can override and force-create if
   you truly want a duplicate.
3. **Unlink** — clears the link if you attached the wrong one.

Once linked, the account carries `stripe_customer_id` and every future contract for
that account inherits the same Stripe customer automatically.

## Step 3 — Sync or push

With both links in place:

- The **Sync to Stripe** button on the contract's Billing Sync panel unlocks.
- The **Push to Stripe** action on individual invoices works.
- Both paths use the Stripe customer from the linked account. No email lookup, no
  auto-create, no ambiguity.

---

## What can go wrong (and what the error tells you)

| Error code | Meaning | Fix |
|---|---|---|
| `contract_not_linked_to_debtor` | Contract was never approved through the standard flow. | Re-open the contract and approve it. |
| `debtor_not_linked_to_stripe` | Account exists but has no `stripe_customer_id`. | Open the account → Stripe Customer card → Search or Create. |
| `invoice_not_linked_to_debtor` | An invoice was created without a debtor (unusual — usually a manual insert). | Attach the invoice to the correct account first. |

Every error returned by `push-invoice-to-stripe` and `stripe-billing-sync` includes a
`code` and (when relevant) the `debtor_id` you need to open — the UI uses these to
deep-link you to the right screen.

---

## Why we don't auto-lookup by email anymore

Two reasons:

1. **Duplicates in Stripe.** `customers.list({ email })` frequently returns multiple
   matches (test data, historical duplicates, personal vs. work email reuse). Grabbing
   `[0]` billed the wrong one.
2. **Silent auto-create.** A single typo in a contract's `customer_email` used to spawn
   a brand-new Stripe customer, orphaned from the Recouply record — invisible until
   reconciliation.

The one-time explicit link removes both failure modes and gives you a clean
`debtors.stripe_customer_id ↔ cus_…` mapping that reverse-sync (webhooks for
`invoice.paid`, `customer.updated`, etc.) can rely on with zero ambiguity.
