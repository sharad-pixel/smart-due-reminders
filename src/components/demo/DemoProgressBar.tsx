import { useDemoContext, DEMO_STEPS } from "@/contexts/DemoContext";

export const DemoProgressBar = () => {
  const { step, completedSteps } = useDemoContext();
  const currentIdx = DEMO_STEPS.findIndex(s => s.key === step);
  // Skip email_gate in display
  const visibleSteps = DEMO_STEPS.filter(s => s.key !== "email_gate");

  return (
    <div className="hidden lg:flex items-center gap-0.5">
      {visibleSteps.map((s, _i) => {
        const realIdx = DEMO_STEPS.findIndex(st => st.key === s.key);
        const isActive = realIdx === currentIdx;
        const isDone = completedSteps.includes(s.key) || realIdx < currentIdx;
        return (
          <div
            key={s.key}
            className={`h-1.5 w-5 rounded-full transition-all duration-500 ${
              isActive ? "bg-primary w-8" : isDone ? "bg-primary/60" : "bg-muted"
            }`}
            title={s.label}
          />
        );
      })}
    </div>
  );
};
