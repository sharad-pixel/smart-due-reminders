import { TrendingUp, CalendarClock, ShieldAlert, FileText, Zap, ListTree, CreditCard } from "lucide-react";
import { useStripeConnected } from "@/hooks/useStripeConnected";

const BASE_SECTIONS = [
  { id: "finance", label: "Finance", icon: TrendingUp },
  { id: "term-dates", label: "Term & Dates", icon: CalendarClock },
  { id: "risk", label: "Risk & Readiness", icon: ShieldAlert },
  { id: "invoicing", label: "Invoicing & Collectibility", icon: FileText },
  { id: "triggers", label: "Custom Triggers", icon: Zap },
  { id: "billing-sync", label: "Billing Sync", icon: CreditCard, stripeOnly: true },
  { id: "all-terms", label: "All Terms", icon: ListTree },
];

export const ContractPageNav = () => {
  const { connected } = useStripeConnected();
  const sections = BASE_SECTIONS.filter((s) => !(s as any).stripeOnly || connected);
  return (
    <div className="sticky top-0 z-30 -mx-2 px-2 py-2 bg-background/85 backdrop-blur border-b">
      <nav className="flex gap-1 overflow-x-auto no-scrollbar">
        {sections.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
};

export default ContractPageNav;

