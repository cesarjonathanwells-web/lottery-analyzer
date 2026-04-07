"use client";

import type { FrequencyResult } from "@/lib/types";
import { NumberBall } from "./number-ball";
import { Flame, Snowflake } from "lucide-react";

interface HotColdPanelProps {
  frequencies: FrequencyResult[];
  topN?: number;
}

export function HotColdPanel({ frequencies, topN = 10 }: HotColdPanelProps) {
  const sorted = [...frequencies].sort((a, b) => b.count - a.count);
  const hotNumbers = sorted.slice(0, topN);
  const coldNumbers = sorted.slice(-topN).reverse();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Hot Numbers */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-[var(--hot)]" />
          <h3 className="text-sm font-semibold text-[var(--hot)]">
            Hottest Numbers
          </h3>
        </div>
        <div className="flex flex-col gap-2">
          {hotNumbers.map((f, i) => (
            <div
              key={f.number}
              className="flex items-center justify-between rounded-md px-2 py-1 transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-right text-xs font-mono text-[var(--muted-foreground)]">
                  {i + 1}
                </span>
                <NumberBall number={f.number} size="sm" variant="hot" />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-[var(--foreground)]">
                  {f.count}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {f.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cold Numbers */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Snowflake className="h-4 w-4 text-[var(--cold)]" />
          <h3 className="text-sm font-semibold text-[var(--cold)]">
            Coldest Numbers
          </h3>
        </div>
        <div className="flex flex-col gap-2">
          {coldNumbers.map((f, i) => (
            <div
              key={f.number}
              className="flex items-center justify-between rounded-md px-2 py-1 transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-right text-xs font-mono text-[var(--muted-foreground)]">
                  {i + 1}
                </span>
                <NumberBall number={f.number} size="sm" variant="cold" />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-[var(--foreground)]">
                  {f.count}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {f.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
