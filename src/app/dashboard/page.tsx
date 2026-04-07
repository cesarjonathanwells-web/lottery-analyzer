"use client";

import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import { getGameById } from "@/lib/games";
import type { FrequencyResult, Draw } from "@/lib/types";

import { AnalysisCard } from "@/components/lottery/analysis-card";
import { FrequencyGrid } from "@/components/lottery/frequency-grid";
import { HotColdPanel } from "@/components/lottery/hot-cold-panel";
import { FrequencyChart } from "@/components/charts/frequency-chart";
import { NumberBall } from "@/components/lottery/number-ball";
import { DrawHistory } from "@/components/lottery/draw-history";
import { LiveDrawWidget } from "@/components/lottery/live-draw-widget";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { JackpotChart } from "@/components/charts/jackpot-chart";
import {
  BarChart3,
  Clock,
  Hash,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

// ── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchFrequencies(gameId: string): Promise<FrequencyResult[]> {
  const res = await fetch(
    `/api/analysis?game=${gameId}&type=frequency`,
  );
  if (!res.ok) throw new Error("Failed to fetch frequencies");
  const json = await res.json();
  return json.payload?.data ?? json.data ?? [];
}

async function fetchDraws(gameId: string, limit = 5): Promise<Draw[]> {
  const res = await fetch(
    `/api/results?game=${gameId}&limit=${limit}`,
  );
  if (!res.ok) throw new Error("Failed to fetch draws");
  const json = await res.json();
  return json.draws ?? json.data ?? [];
}

// ── Quick Stat Card ──────────────────────────────────────────────────────────

function QuickStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <span className="shrink-0" style={{ color: accent ?? "var(--muted-foreground)" }}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        <p className="font-mono text-lg font-semibold text-[var(--foreground)]">
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);
  const [selectedNumber, setSelectedNumber] = useState<number | undefined>();

  const {
    data: frequencies,
    isLoading: freqLoading,
  } = useQuery({
    queryKey: ["frequency", activeGameId],
    queryFn: () => fetchFrequencies(activeGameId),
    enabled: !!activeGameId,
  });

  const {
    data: recentDraws,
    isLoading: drawsLoading,
  } = useQuery({
    queryKey: ["draws", activeGameId, 5],
    queryFn: () => fetchDraws(activeGameId, 5),
    enabled: !!activeGameId,
  });

  // Derived stats
  const drawCount = frequencies?.length ?? 0;
  const mostOverdue = frequencies
    ? [...frequencies].sort((a, b) => b.gapCurrent - a.gapCurrent)[0]
    : null;
  const latestDraw = recentDraws?.[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Live Draw Widget */}
      <LiveDrawWidget />

      {/* Latest Draw */}
      <AnalysisCard
        title="Latest Draw"
        subtitle={
          latestDraw
            ? new Date(latestDraw.drawDate + "T00:00:00").toLocaleDateString(
                "en-US",
                { weekday: "long", month: "long", day: "numeric", year: "numeric" },
              )
            : undefined
        }
        loading={drawsLoading}
      >
        {latestDraw && (
          <div className="flex flex-wrap items-center gap-3">
            {latestDraw.numbers.map((n, i) => (
              <NumberBall key={i} number={n} size="lg" variant="default" />
            ))}
            {latestDraw.bonusNumbers.length > 0 && (
              <>
                <span className="text-[var(--muted-foreground)]">+</span>
                {latestDraw.bonusNumbers.map((n, i) => (
                  <NumberBall key={`b${i}`} number={n} size="lg" variant="bonus" />
                ))}
              </>
            )}
          </div>
        )}
      </AnalysisCard>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <QuickStat
          icon={BarChart3}
          label="Numbers Tracked"
          value={drawCount}
          accent="var(--gold)"
        />
        <QuickStat
          icon={Hash}
          label="Balls Drawn"
          value={game?.ballsDrawn ?? "-"}
          accent="var(--electric-blue)"
        />
        <QuickStat
          icon={Clock}
          label="Most Overdue"
          value={mostOverdue ? `#${mostOverdue.number}` : "-"}
          accent="var(--hot)"
        />
        <QuickStat
          icon={TrendingUp}
          label="Number Range"
          value={game ? `1-${game.numberRange}` : "-"}
          accent="var(--neon-green)"
        />
      </div>

      {/* Hot/Cold Panel */}
      <AnalysisCard title="Hot & Cold Numbers" loading={freqLoading}>
        {frequencies && <HotColdPanel frequencies={frequencies} />}
      </AnalysisCard>

      {/* Frequency Chart */}
      <AnalysisCard title="Frequency Distribution" loading={freqLoading}>
        {frequencies && <FrequencyChart frequencies={frequencies} />}
      </AnalysisCard>

      {/* Frequency Grid */}
      <AnalysisCard
        title="Number Grid"
        subtitle="Click a number to highlight it across all views"
        loading={freqLoading}
      >
        {frequencies && game && (
          <FrequencyGrid
            frequencies={frequencies}
            numberRange={game.numberRange}
            onNumberClick={setSelectedNumber}
            selectedNumber={selectedNumber}
          />
        )}
      </AnalysisCard>

      {/* Recent Draws */}
      <AnalysisCard title="Recent Draws" loading={drawsLoading}>
        {recentDraws && game && (
          <DrawHistory draws={recentDraws} gameType={game.gameType} pageSize={5} />
        )}
      </AnalysisCard>

      {/* Calendar Heatmap */}
      <CalendarHeatmap gameId={activeGameId} />

      {/* Jackpot Tracker (only meaningful for major lotteries) */}
      <JackpotChart gameId={activeGameId} />
    </div>
  );
}
