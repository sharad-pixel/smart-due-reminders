interface Props {
  value: number; // 0-100
  size?: number;
  label?: string;
}

/**
 * Circular SVG progress gauge for contract OCR scanning.
 * Color shifts from amber (early) → blue (mid) → emerald (near done).
 */
export const ScanProgressGauge = ({ value, size = 40, label }: Props) => {
  const pct = Math.max(0, Math.min(100, value));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  const color =
    pct >= 90 ? "hsl(142 71% 45%)" // emerald
    : pct >= 40 ? "hsl(217 91% 60%)" // blue
    : "hsl(38 92% 50%)"; // amber

  const phase = label ?? (
    pct < 30 ? "Preparing"
    : pct < 70 ? "OCR"
    : pct < 95 ? "Extracting"
    : "Finalizing"
  );

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 600ms ease, stroke 400ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold tabular-nums">
          {Math.round(pct)}%
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{phase}</span>
    </div>
  );
};
