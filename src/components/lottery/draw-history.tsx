"use client";

import { useState, useMemo } from "react";
import type { Draw, GameType } from "@/lib/types";
import { NumberBall } from "./number-ball";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DrawHistoryProps {
  draws: Draw[];
  gameType: GameType;
  pageSize?: number;
}

export function DrawHistory({
  draws,
  gameType,
  pageSize = 15,
}: DrawHistoryProps) {
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () =>
      [...draws].sort(
        (a, b) =>
          new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime(),
      ),
    [draws],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const hasBonusBalls =
    gameType === "powerball" || gameType === "mega" || gameType === "loto";

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--secondary)]/50">
              <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                Date
              </th>
              {(gameType === "pick3" || gameType === "pick4") && (
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Period
                </th>
              )}
              <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                Numbers
              </th>
              {hasBonusBalls && (
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Bonus
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginated.map((draw, idx) => (
              <tr
                key={draw.id}
                className={
                  idx % 2 === 0
                    ? "bg-transparent"
                    : "bg-white/[0.02]"
                }
              >
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">
                  <div>{formatDate(draw.drawDate)}</div>
                  {draw.drawTime && (
                    <div className="text-[10px] text-[var(--muted-foreground)]/60">
                      {draw.drawTime}
                    </div>
                  )}
                </td>
                {(gameType === "pick3" || gameType === "pick4") && (
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs capitalize text-[var(--muted-foreground)]">
                    {draw.drawPeriod ?? "-"}
                  </td>
                )}
                <td className="px-4 py-2">
                  <div className="flex gap-1.5">
                    {draw.numbers.map((n, i) => (
                      <NumberBall key={i} number={n} size="sm" variant="default" />
                    ))}
                  </div>
                </td>
                {hasBonusBalls && (
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      {draw.bonusNumbers.map((n, i) => (
                        <NumberBall key={i} number={n} size="sm" variant="bonus" />
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={hasBonusBalls ? 4 : 3}
                  className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]"
                >
                  No draws found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted-foreground)]">
            Page {page + 1} of {totalPages} ({sorted.length} draws)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
