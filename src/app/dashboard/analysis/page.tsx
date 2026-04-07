"use client";

import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import { getGameById } from "@/lib/games";
import type { FrequencyResult, PairResult } from "@/lib/types";
import type {
  GapResult,
  ExtendedPatternResult,
  DeltaResult,
  ChiSquareResult,
} from "@/lib/analysis/types";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnalysisCard } from "@/components/lottery/analysis-card";
import { GapChart } from "@/components/charts/gap-chart";
import { PairHeatmap } from "@/components/charts/pair-heatmap";
import { PatternRadar } from "@/components/charts/pattern-radar";
import { DeltaChart } from "@/components/charts/delta-chart";
import { ChiSquareDisplay } from "@/components/lottery/chi-square-display";
import { PositionalChart } from "@/components/charts/positional-chart";

// ── Fetchers ────────────────────────────────────────────────────────────────

async function fetchAnalysis<T>(gameId: string, type: string): Promise<T> {
  // All analysis types now go through /api/analysis which uses EBG under the hood
  const res = await fetch(`/api/analysis?game=${gameId}&type=${type}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type} analysis`);
  const json = await res.json();
  return json.payload?.data ?? json.data;
}

// ── Empty State ─────────────────────────────────────────────────────────────

function NoData({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 h-12 w-12 rounded-full bg-[var(--secondary)] flex items-center justify-center">
        <span className="text-lg text-[var(--muted-foreground)]">--</span>
      </div>
      <p className="text-sm text-[var(--muted-foreground)]">
        {message ?? "No data available yet. Draws need to be imported first."}
      </p>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);
  const isPositional =
    game?.gameType === "pick3" || game?.gameType === "pick4";

  // Pattern analysis
  const { data: pattern, isLoading: patternLoading } = useQuery({
    queryKey: ["analysis", "pattern", activeGameId],
    queryFn: () =>
      fetchAnalysis<ExtendedPatternResult>(activeGameId, "pattern"),
    enabled: !!activeGameId,
  });

  // Gap analysis
  const { data: gaps, isLoading: gapsLoading } = useQuery({
    queryKey: ["analysis", "gap", activeGameId],
    queryFn: () => fetchAnalysis<GapResult[]>(activeGameId, "gap"),
    enabled: !!activeGameId,
  });

  // Pairs analysis
  const { data: pairs, isLoading: pairsLoading } = useQuery({
    queryKey: ["analysis", "pairs", activeGameId],
    queryFn: () => fetchAnalysis<PairResult[]>(activeGameId, "pairs"),
    enabled: !!activeGameId,
  });

  // Delta analysis
  const { data: delta, isLoading: deltaLoading } = useQuery({
    queryKey: ["analysis", "delta", activeGameId],
    queryFn: () => fetchAnalysis<DeltaResult>(activeGameId, "delta"),
    enabled: !!activeGameId,
  });

  // Chi-square analysis
  const { data: chiSquare, isLoading: chiLoading } = useQuery({
    queryKey: ["analysis", "chi_square", activeGameId],
    queryFn: () =>
      fetchAnalysis<ChiSquareResult>(activeGameId, "chi_square"),
    enabled: !!activeGameId,
  });

  // Positional analysis (only for pick3/pick4)
  const { data: positional, isLoading: positionalLoading } = useQuery({
    queryKey: ["analysis", "positional", activeGameId],
    queryFn: () =>
      fetchAnalysis<FrequencyResult[][]>(activeGameId, "positional"),
    enabled: !!activeGameId && isPositional,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-[var(--foreground)]">
          Deep Analysis
        </h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          Statistical breakdowns for {game?.name ?? "the selected game"}
        </p>
      </div>

      <Tabs defaultValue="patterns">
        <TabsList
          variant="line"
          className="w-full flex-wrap justify-start gap-0"
        >
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="gaps">Gaps</TabsTrigger>
          <TabsTrigger value="pairs">Pairs</TabsTrigger>
          <TabsTrigger value="delta">Delta</TabsTrigger>
          <TabsTrigger value="chi_square">Chi-Square</TabsTrigger>
          {isPositional && (
            <TabsTrigger value="positional">Positional</TabsTrigger>
          )}
        </TabsList>

        {/* Patterns Tab */}
        <TabsContent value="patterns">
          <AnalysisCard
            title="Pattern Analysis"
            subtitle="Odd/Even, High/Low distribution and sum statistics"
            loading={patternLoading}
          >
            {pattern ? (
              <PatternRadar pattern={pattern} />
            ) : (
              !patternLoading && <NoData />
            )}
          </AnalysisCard>
        </TabsContent>

        {/* Gaps Tab */}
        <TabsContent value="gaps">
          <AnalysisCard
            title="Gap / Skip Tracker"
            subtitle="How many draws since each number last appeared. Diamond markers show the average gap."
            loading={gapsLoading}
          >
            {gaps && gaps.length > 0 ? (
              <GapChart gaps={gaps} />
            ) : (
              !gapsLoading && <NoData />
            )}
          </AnalysisCard>
        </TabsContent>

        {/* Pairs Tab */}
        <TabsContent value="pairs">
          <AnalysisCard
            title="Pair Co-Occurrence Heatmap"
            subtitle="How often numbers appear together in the same draw"
            loading={pairsLoading}
          >
            {pairs && pairs.length > 0 ? (
              <PairHeatmap pairs={pairs} />
            ) : (
              !pairsLoading && <NoData />
            )}
          </AnalysisCard>
        </TabsContent>

        {/* Delta Tab */}
        <TabsContent value="delta">
          <AnalysisCard
            title="Delta Distribution"
            subtitle="Differences between consecutive sorted numbers in each draw"
            loading={deltaLoading}
          >
            {delta ? (
              <DeltaChart delta={delta} />
            ) : (
              !deltaLoading && <NoData />
            )}
          </AnalysisCard>
        </TabsContent>

        {/* Chi-Square Tab */}
        <TabsContent value="chi_square">
          <AnalysisCard
            title="Chi-Square Randomness Test"
            subtitle="Statistical test for uniform distribution of drawn numbers"
            loading={chiLoading}
          >
            {chiSquare ? (
              <ChiSquareDisplay result={chiSquare} />
            ) : (
              !chiLoading && <NoData />
            )}
          </AnalysisCard>
        </TabsContent>

        {/* Positional Tab (Pick 3/4 only) */}
        {isPositional && (
          <TabsContent value="positional">
            <AnalysisCard
              title="Positional Frequency"
              subtitle="Digit frequency broken down by draw position"
              loading={positionalLoading}
            >
              {positional && positional.length > 0 ? (
                <PositionalChart positions={positional} />
              ) : (
                !positionalLoading && <NoData />
              )}
            </AnalysisCard>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
