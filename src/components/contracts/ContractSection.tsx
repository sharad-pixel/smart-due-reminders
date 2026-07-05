import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  id?: string;
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
  children: ReactNode;
}

/**
 * Aggregated, collapsible section wrapper used on the Contract Details page
 * so each functional area (Finance, Term & Dates, Risk, Invoicing, etc.)
 * can be collapsed to reduce visual load and progressively expanded.
 */
export function ContractSection({
  id,
  title,
  icon,
  defaultOpen = true,
  right,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="scroll-mt-16">
      <div className="flex items-center justify-between gap-3 py-2 border-b border-border/60">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors group"
          aria-expanded={open}
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
          />
          {icon}
          <span>{title}</span>
        </button>
        {right}
      </div>
      {open && <div className="space-y-3 pt-3">{children}</div>}
    </section>
  );
}
