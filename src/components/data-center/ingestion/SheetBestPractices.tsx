import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BookOpen,
  ChevronDown,
  ArrowUpCircle,
  ArrowDownCircle,
  ShieldCheck,
  AlertTriangle,
  Columns,
  Lightbulb,
  CreditCard,
} from "lucide-react";

const sections = [
  {
    icon: Lightbulb,
    title: "Recommended Workflow",
    items: [
      "Use Push to export your Recouply data to Google Sheets — this is your master copy.",
      "Edit data directly in Google Sheets (add rows, update balances, fix contacts).",
      "Use Pull to sync your changes back into Recouply.",
      "Push again after Pull to confirm the sheet reflects the latest state.",
      "Only changed rows are synced — large sheets stay fast.",
    ],
  },
  {
    icon: ArrowUpCircle,
    title: "Push (Recouply → Sheet)",
    items: [
      "Overwrites the sheet with current Recouply data.",
      "Incremental: only new/changed rows are updated for speed.",
      "Safe to run anytime — it never modifies your Recouply data.",
      "Use after approving new imports or recording payments.",
    ],
  },
  {
    icon: ArrowDownCircle,
    title: "Pull (Sheet → Recouply)",
    items: [
      "Matches rows by RAID (Recouply Account ID) for accounts, or Reference ID for invoices/payments.",
      "Rows without a RAID are staged as new accounts for your review.",
      "Pull never deletes records — it only creates or updates.",
      "Sync-protected accounts are skipped automatically.",
    ],
  },
  {
    icon: Columns,
    title: "Sheet Schema",
    items: [
      "Accounts: RAID · Company Name · Type · Contact Name · Email · Phone · Address · Balance · Source · Risk Score · Risk Tier",
      "Invoices (Open & Paid tabs): Account RAID · SS Invoice # · Amounts · Dates · Status · Line # · Line Type (item/tax) · Description · Qty · Unit Price · Line Total",
      "Payments — Payment Template tab: Pre-populated with open invoices + line items. Just fill in Payment Amount, Payment Reference & Payment Date to reconcile.",
      "Payments — Recorded Payments tab: History of all recorded payments with reconciliation status.",
    ],
  },
  {
    icon: CreditCard,
    title: "Payment Reconciliation (Simplified)",
    items: [
      "Push the Payments template → opens a pre-populated sheet with all open invoices broken down by line item and tax.",
      "Each row shows: Account · Invoice # · Recouply Ref · Line # · Type (item/tax) · Description · Line Amount · Invoice Total Outstanding.",
      "To record a payment: fill in Payment Amount, Payment Reference, and Payment Date on the relevant rows.",
      "You can pay at invoice level (one row) or line level (individual item/tax rows) — both are supported.",
      "Pull the sheet back → Recouply automatically aggregates payments per invoice, updates balances, and marks invoices as Paid or PartiallyPaid.",
      "The Recorded Payments tab is read-only and shows your full payment history.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Common Pitfalls",
    items: [
      "Don't rename or reorder column headers — the sync relies on exact header names.",
      "Don't delete the first header row in any sheet.",
      "Avoid duplicate RAIDs — each account must have a unique identifier.",
      "Don't paste formatted data from other spreadsheets — use Paste Values Only.",
      "If a Pull seems to skip rows, check that the RAID column isn't blank.",
      "Don't edit columns marked 'DO NOT EDIT' — these are Recouply reference IDs used for matching.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Sync Protection",
    items: [
      "Toggle sync protection on any account's detail page to freeze it from Pull updates.",
      "Protected accounts are reported in sync results but never modified.",
      "Use this for accounts under dispute or legal review.",
    ],
  },
];

export function SheetBestPractices() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors text-left">
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium flex-1">Best Practices & Schema Guide</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {sections.map(({ icon: Icon, title, items }) => (
          <div key={title} className="px-3 py-2.5 rounded-md border bg-card">
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground/80">{title}</span>
            </div>
            <ul className="space-y-1 pl-5">
              {items.map((item, i) => (
                <li key={i} className="text-[11px] text-muted-foreground leading-relaxed list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
