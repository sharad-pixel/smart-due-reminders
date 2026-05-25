import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from "lucide-react";

interface Field {
  field_key: string;
  field_value: string | null;
}

interface Props {
  fields: Field[];
}

const BILLING_KEYS: Array<{ key: RegExp; label: string }> = [
  { key: /billing_frequency|invoice_frequency|billing_cadence/i, label: "Billing Frequency" },
  { key: /payment_terms/i, label: "Payment Terms" },
  { key: /invoice_delivery|invoice_method|delivery_method/i, label: "Invoice Delivery" },
  { key: /billing_email|invoice_email|remit_to_email/i, label: "Billing Email" },
  { key: /po_number|purchase_order|po_required/i, label: "PO Required" },
  { key: /late_fee|interest_on_late/i, label: "Late Fee" },
  { key: /dispute_window|dispute_period/i, label: "Dispute Window" },
  { key: /payment_method|accepted_payment/i, label: "Accepted Methods" },
  { key: /currency/i, label: "Currency" },
  { key: /billing_address|remit_to/i, label: "Remit-To Address" },
  { key: /invoice_format|w9|tax_id/i, label: "Tax / Format Requirements" },
];

export const ContractBillingRequirements = ({ fields }: Props) => {
  const rows = useMemo(() => {
    const out: { label: string; value: string }[] = [];
    for (const { key, label } of BILLING_KEYS) {
      const match = fields.find((f) => key.test(f.field_key) && f.field_value);
      if (match) out.push({ label, value: match.field_value as string });
    }
    return out;
  }, [fields]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" /> Billing Requirements
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No billing requirements detected in this contract yet.</p>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between border-b py-1.5">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="font-medium text-right break-words max-w-[60%]">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractBillingRequirements;
