import { useDemoContext, DemoStep } from "@/contexts/DemoContext";

const STEPS: { key: DemoStep; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "activate", label: "Activate" },
  { key: "drafts", label: "Drafts" },
  { key: "sending", label: "Sending" },
  { key: "payments", label: "Payments" },
  { key: "results", label: "Results" },
];

export const DemoProgressBar = () => {
  const { step } = useDemoContext();
  const currentIdx = STEPS.findIndex(s => s.key === step);

  return (
    <div className="hidden md:flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div
            className={`h-2 w-8 rounded-full transition-all duration-500 ${
              i <= currentIdx ? "bg-primary" : "bg-muted"
            }`}
          />
        </div>
      ))}
    </div>
  );
};
