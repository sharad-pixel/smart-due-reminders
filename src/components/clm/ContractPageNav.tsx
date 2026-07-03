import { useEffect, useState } from "react";
import { TrendingUp, CalendarClock, ShieldAlert, FileText, Zap, ListTree, CreditCard } from "lucide-react";
import { useStripeConnected } from "@/hooks/useStripeConnected";
import { cn } from "@/lib/utils";

type Section = { id: string; label: string; group: string; icon: any; stripeOnly?: boolean };

const BASE_SECTIONS: Section[] = [
  { id: "finance",      label: "Finance",             group: "Commercial",       icon: TrendingUp },
  { id: "term-dates",   label: "Term & Dates",        group: "Term & Risk",      icon: CalendarClock },
  { id: "risk",         label: "Risk & Readiness",    group: "Term & Risk",      icon: ShieldAlert },
  { id: "invoicing",    label: "Invoicing & Collectibility", group: "Revenue",   icon: FileText },
  { id: "triggers",     label: "Custom Triggers",     group: "Automation",       icon: Zap },
  { id: "billing-sync", label: "Billing Sync",        group: "Automation",       icon: CreditCard, stripeOnly: true },
  { id: "all-terms",    label: "All Terms",           group: "Reference",        icon: ListTree },
];

export const ContractPageNav = () => {
  const { connected } = useStripeConnected();
  const sections = BASE_SECTIONS.filter((s) => !s.stripeOnly || connected);
  const [active, setActive] = useState<string>(sections[0]?.id || "");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop);
        if (visible[0]) setActive((visible[0].target as HTMLElement).id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0.01 }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections.length]);

  // Group sections by category for a cleaner review experience
  const grouped = sections.reduce<Record<string, Section[]>>((acc, s) => {
    (acc[s.group] = acc[s.group] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="sticky top-0 z-30 -mx-2 px-2 py-2 bg-background/90 backdrop-blur border-b">
      <nav className="flex gap-3 overflow-x-auto no-scrollbar items-center">
        {Object.entries(grouped).map(([group, items], idx) => (
          <div key={group} className="flex items-center gap-1">
            {idx > 0 && <span className="text-muted-foreground/40 px-1">·</span>}
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 pr-1">{group}</span>
            {items.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  active === id
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
};

export default ContractPageNav;
