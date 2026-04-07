"use client";

import { useMemo } from "react";
import type { FrequencyResult, NumberClassification } from "@/lib/types";
import { NumberBall } from "./number-ball";

interface FrequencyGridProps {
  frequencies: FrequencyResult[];
  numberRange: number;
  onNumberClick?: (num: number) => void;
  selectedNumber?: number;
}

function classificationToVariant(
  cls: NumberClassification,
  isSelected: boolean,
): "hot" | "cold" | "warm" | "selected" {
  if (isSelected) return "selected";
  return cls;
}

export function FrequencyGrid({
  frequencies,
  numberRange,
  onNumberClick,
  selectedNumber,
}: FrequencyGridProps) {
  // Build a lookup from number -> frequency result
  const freqMap = useMemo(() => {
    const map = new Map<number, FrequencyResult>();
    for (const f of frequencies) {
      map.set(f.number, f);
    }
    return map;
  }, [frequencies]);

  // Count by classification
  const counts = useMemo(() => {
    const c = { hot: 0, warm: 0, cold: 0 };
    for (const f of frequencies) {
      c[f.classification]++;
    }
    return c;
  }, [frequencies]);

  // Generate all numbers 1..numberRange (or 0..numberRange for pick games)
  const allNumbers = useMemo(() => {
    const start = numberRange <= 9 ? 0 : 1;
    const end = numberRange;
    return Array.from({ length: end - start + 1 }, (_, i) => i + start);
  }, [numberRange]);

  return (
    <div className="flex flex-col gap-4">
      {/* Number grid */}
      <div className="flex flex-wrap gap-2">
        {allNumbers.map((num) => {
          const freq = freqMap.get(num);
          const cls = freq?.classification ?? "cold";
          const isSelected = selectedNumber === num;
          return (
            <NumberBall
              key={num}
              number={num}
              size="sm"
              variant={classificationToVariant(cls, isSelected)}
              onClick={onNumberClick ? () => onNumberClick(num) : undefined}
              showLabel={!!freq}
              label={freq ? `${freq.count}` : undefined}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 border-t border-[var(--border)] pt-3">
        <LegendItem color="var(--hot)" label="Hot" count={counts.hot} />
        <LegendItem color="var(--warm)" label="Warm" count={counts.warm} />
        <LegendItem color="var(--cold)" label="Cold" count={counts.cold} />
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>
        {label}{" "}
        <span className="font-mono text-[var(--foreground)]">({count})</span>
      </span>
    </div>
  );
}
