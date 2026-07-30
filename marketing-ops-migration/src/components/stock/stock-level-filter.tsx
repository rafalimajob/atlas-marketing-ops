"use client";

import { CHART_COLORS } from "@/lib/theme-colors";
import { STOCK_LEVEL_LABEL, type StockLevel } from "@/lib/stock-level";

const LEVEL_ORDER: StockLevel[] = ["crit", "warn", "ok"];
const NEUTRAL = CHART_COLORS.slate;

export function StockLevelFilter({
  value,
  onChange,
  counts,
}: {
  value: StockLevel | "TODOS";
  onChange: (value: StockLevel | "TODOS") => void;
  counts: Record<StockLevel, number>;
}) {
  const total = counts.crit + counts.warn + counts.ok;

  return (
    <div className="flex flex-wrap gap-1.5">
      <FilterPill active={value === "TODOS"} color={NEUTRAL} label="Todos" count={total} onClick={() => onChange("TODOS")} />
      {LEVEL_ORDER.map((level) => (
        <FilterPill
          key={level}
          active={value === level}
          color={CHART_COLORS[level]}
          label={STOCK_LEVEL_LABEL[level]}
          count={counts[level]}
          onClick={() => onChange(level)}
        />
      ))}
    </div>
  );
}

function FilterPill({
  active,
  color,
  label,
  count,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-transparent"
          : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      }`}
      style={active ? { backgroundColor: `${color}1A`, color } : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? color : "currentColor" }} />
      {label}
      <span className={active ? "font-semibold" : "text-zinc-400 dark:text-zinc-500"}>{count}</span>
    </button>
  );
}
