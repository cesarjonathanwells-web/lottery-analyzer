"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useGameStore } from "@/lib/store";
import { getGameById } from "@/lib/games";
import { AnalysisCard } from "@/components/lottery/analysis-card";
import { NumberBall } from "@/components/lottery/number-ball";
import { ScoreRing } from "@/components/lottery/score-ring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Scale,
  Flame,
  Snowflake,
  GitBranch,
  Dice5,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import type { Strategy, GeneratorConfig, GeneratedSet } from "@/lib/generator/engine";

// ── Strategy Definitions ─────────────────────────────────────────────────────

const STRATEGIES: {
  id: Strategy;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  explanation: string;
}[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Numbers near expected frequency",
    icon: Scale,
    explanation:
      "The balanced strategy weights each number proportionally to how close its historical frequency is to the statistically expected frequency. Numbers that appear at near-expected rates get the highest selection weight, while extreme outliers (both hot and cold) are down-weighted. This produces sets that mirror the overall statistical profile of the game.",
  },
  {
    id: "hot_bias",
    label: "Hot Bias",
    description: "Favor frequently drawn numbers",
    icon: Flame,
    explanation:
      "Hot bias weights numbers that have appeared more frequently than expected. Hot numbers receive 3x weight, warm numbers 2x, and cold numbers 1x. This strategy assumes recent trends may continue, though mathematically each draw is independent.",
  },
  {
    id: "cold_bias",
    label: "Cold Bias",
    description: "Favor overdue numbers",
    icon: Snowflake,
    explanation:
      "Cold bias is the inverse of hot bias. Cold (infrequent) numbers receive 3x weight, warm numbers 2x, and hot numbers 1x. This strategy is based on the gambler's intuition that 'due' numbers are more likely, though statistically this is a fallacy in truly random systems.",
  },
  {
    id: "delta",
    label: "Delta System",
    description: "Generate via number differences",
    icon: GitBranch,
    explanation:
      "The delta system generates numbers by picking a starting value and then adding small differences (deltas) to build the sequence. Smaller deltas are weighted higher, matching the observed distribution in real lottery draws where adjacent numbers tend to cluster. The result is converted to actual numbers via cumulative summation.",
  },
  {
    id: "random",
    label: "Random",
    description: "Pure random with filters",
    icon: Dice5,
    explanation:
      "Pure random selection where every eligible number has equal probability. Pattern filters (odd/even balance, sum range, decade spread, etc.) are still applied to shape the output, but no frequency weighting is used.",
  },
];

// ── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 transition-all hover:border-[var(--gold)]/30"
    >
      <div
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-[var(--gold)]" : "bg-[var(--secondary)]",
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </div>
      <span className="text-sm text-[var(--foreground)]">{label}</span>
    </button>
  );
}

// ── Number Picker Grid ───────────────────────────────────────────────────────

function NumberPickerGrid({
  numberRange,
  selected,
  onToggle,
  label,
  variant,
}: {
  numberRange: number;
  selected: Set<number>;
  onToggle: (n: number) => void;
  label: string;
  variant: "selected" | "hot";
}) {
  const minNumber = 1;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {Array.from(
          { length: numberRange - minNumber + 1 },
          (_, i) => i + minNumber,
        ).map((n) => (
          <NumberBall
            key={n}
            number={n}
            size="sm"
            variant={selected.has(n) ? variant : "default"}
            onClick={() => onToggle(n)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Typical Sum Range ────────────────────────────────────────────────────────

function getTypicalSumRange(
  numberRange: number,
  ballsDrawn: number,
): { min: number; max: number } {
  // Approximate typical sum range based on game parameters
  const midNum = Math.ceil(numberRange / 2);
  const expectedSum = midNum * ballsDrawn;
  const spread = Math.round(expectedSum * 0.35);
  return {
    min: Math.max(ballsDrawn, expectedSum - spread),
    max: Math.min(numberRange * ballsDrawn, expectedSum + spread),
  };
}

// ── Generated Set Row ────────────────────────────────────────────────────────

function GeneratedSetRow({
  set,
  index,
  onRegenerate,
  isRegenerating,
}: {
  set: GeneratedSet;
  index: number;
  onRegenerate: (index: number) => void;
  isRegenerating: boolean;
}) {
  return (
    <div className="group relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all hover:border-[var(--gold)]/20">
      {/* Set number label */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Set {index + 1}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onRegenerate(index)}
          disabled={isRegenerating}
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")}
          />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Numbers */}
        <div className="flex flex-wrap items-center gap-2">
          {set.numbers.map((n, i) => (
            <NumberBall key={i} number={n} size="lg" variant="warm" />
          ))}
          {set.bonusNumber != null && (
            <>
              <span className="mx-1 text-[var(--muted-foreground)]">+</span>
              <NumberBall number={set.bonusNumber} size="lg" variant="bonus" />
            </>
          )}
        </div>

        {/* Score ring */}
        <div className="ml-auto">
          <ScoreRing score={set.score} size="md" label="Quality" />
        </div>
      </div>

      {/* Breakdown stats */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--border)] pt-3">
        <BreakdownStat label="Odd/Even" value={set.breakdown.oddEven} />
        <BreakdownStat label="High/Low" value={set.breakdown.highLow} />
        <BreakdownStat label="Sum" value={String(set.breakdown.sum)} />
        <BreakdownStat
          label="Consecutives"
          value={String(set.breakdown.consecutives)}
        />
        <BreakdownStat
          label="Decades"
          value={String(set.breakdown.decadeSpread)}
        />
      </div>
    </div>
  );
}

function BreakdownStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </span>
      <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
        {value}
      </span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GeneratorPage() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);

  // Strategy state
  const [strategy, setStrategy] = useState<Strategy>("balanced");

  // Filter state
  const [oddEvenBalance, setOddEvenBalance] = useState(true);
  const [useSumRange, setUseSumRange] = useState(false);
  const [sumMin, setSumMin] = useState(0);
  const [sumMax, setSumMax] = useState(0);
  const [noConsecutive, setNoConsecutive] = useState(false);
  const [decadeSpread, setDecadeSpread] = useState(true);
  const [setCount, setSetCount] = useState(5);

  // Number pickers
  const [mustInclude, setMustInclude] = useState<Set<number>>(new Set());
  const [excludeNumbers, setExcludeNumbers] = useState<Set<number>>(new Set());

  // Number picker visibility
  const [showMustInclude, setShowMustInclude] = useState(false);
  const [showExclude, setShowExclude] = useState(false);

  // Results
  const [results, setResults] = useState<GeneratedSet[]>([]);

  // Strategy explanation
  const [showExplanation, setShowExplanation] = useState(false);

  // Typical sum range for the game
  const typicalRange = game
    ? getTypicalSumRange(game.numberRange, game.ballsDrawn)
    : { min: 0, max: 0 };

  // Initialize sum range when it hasn't been set
  const effectiveSumMin = useSumRange
    ? sumMin || typicalRange.min
    : typicalRange.min;
  const effectiveSumMax = useSumRange
    ? sumMax || typicalRange.max
    : typicalRange.max;

  // ── Mutation for generating numbers ────────────────────────────────────────

  const generateMutation = useMutation({
    mutationFn: async (config: GeneratorConfig) => {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Generation failed");
      }
      const json = await res.json();
      return json.sets as GeneratedSet[];
    },
    onSuccess: (data) => {
      setResults(data);
    },
  });

  const handleGenerate = useCallback(() => {
    if (!game) return;

    const config: GeneratorConfig = {
      gameId: game.id,
      strategy,
      count: setCount,
      oddEvenBalance,
      noConsecutive,
      decadeSpread,
      excludeNumbers: [...excludeNumbers],
      mustInclude: [...mustInclude],
    };

    if (useSumRange) {
      config.sumRange = {
        min: effectiveSumMin,
        max: effectiveSumMax,
      };
    }

    generateMutation.mutate(config);
  }, [
    game,
    strategy,
    setCount,
    oddEvenBalance,
    noConsecutive,
    decadeSpread,
    excludeNumbers,
    mustInclude,
    useSumRange,
    effectiveSumMin,
    effectiveSumMax,
    generateMutation,
  ]);

  const handleRegenerate = useCallback(
    (index: number) => {
      if (!game) return;

      const config: GeneratorConfig = {
        gameId: game.id,
        strategy,
        count: 1,
        oddEvenBalance,
        noConsecutive,
        decadeSpread,
        excludeNumbers: [...excludeNumbers],
        mustInclude: [...mustInclude],
      };

      if (useSumRange) {
        config.sumRange = {
          min: effectiveSumMin,
          max: effectiveSumMax,
        };
      }

      fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.sets && json.sets.length > 0) {
            setResults((prev) => {
              const next = [...prev];
              next[index] = json.sets[0];
              return next;
            });
          }
        });
    },
    [
      game,
      strategy,
      oddEvenBalance,
      noConsecutive,
      decadeSpread,
      excludeNumbers,
      mustInclude,
      useSumRange,
      effectiveSumMin,
      effectiveSumMax,
    ],
  );

  const toggleMustInclude = useCallback(
    (n: number) => {
      setMustInclude((prev) => {
        const next = new Set(prev);
        if (next.has(n)) {
          next.delete(n);
        } else {
          // Remove from excludes if it was there
          setExcludeNumbers((ex) => {
            const exNext = new Set(ex);
            exNext.delete(n);
            return exNext;
          });
          next.add(n);
        }
        return next;
      });
    },
    [],
  );

  const toggleExclude = useCallback(
    (n: number) => {
      setExcludeNumbers((prev) => {
        const next = new Set(prev);
        if (next.has(n)) {
          next.delete(n);
        } else {
          // Remove from mustInclude if it was there
          setMustInclude((mi) => {
            const miNext = new Set(mi);
            miNext.delete(n);
            return miNext;
          });
          next.add(n);
        }
        return next;
      });
    },
    [],
  );

  const currentStrategy = STRATEGIES.find((s) => s.id === strategy)!;

  if (!game) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--muted-foreground)]">
          Select a game from the sidebar to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-[var(--gold)]" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Smart Number Generator
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Generate optimized number sets for {game.name}
          </p>
        </div>
      </div>

      {/* Section A: Strategy Selector */}
      <AnalysisCard title="Strategy" subtitle="Choose how numbers are weighted">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STRATEGIES.map((s) => {
            const Icon = s.icon;
            const isActive = strategy === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStrategy(s.id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                  isActive
                    ? "border-[var(--gold)] bg-[var(--gold)]/5 shadow-[0_0_20px_rgba(245,166,35,0.1)]"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--gold)]/30 hover:bg-[var(--gold)]/[0.02]",
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    isActive
                      ? "text-[var(--gold)]"
                      : "text-[var(--muted-foreground)]",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-semibold transition-colors",
                    isActive
                      ? "text-[var(--gold)]"
                      : "text-[var(--foreground)]",
                  )}
                >
                  {s.label}
                </span>
                <span className="text-center text-[10px] leading-tight text-[var(--muted-foreground)]">
                  {s.description}
                </span>
              </button>
            );
          })}
        </div>
      </AnalysisCard>

      {/* Section B: Filter Controls */}
      <AnalysisCard title="Filters" subtitle="Shape your number selection">
        <div className="space-y-5">
          {/* Toggle row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Toggle
              checked={oddEvenBalance}
              onChange={setOddEvenBalance}
              label="Balanced Odd/Even"
            />
            <Toggle
              checked={decadeSpread}
              onChange={setDecadeSpread}
              label="Spread Across Decades"
            />
            <Toggle
              checked={noConsecutive}
              onChange={setNoConsecutive}
              label="No Consecutive Numbers"
            />
            <Toggle
              checked={useSumRange}
              onChange={setUseSumRange}
              label="Sum Range Filter"
            />
          </div>

          {/* Sum range inputs */}
          {useSumRange && (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 px-4 py-3">
              <span className="text-xs text-[var(--muted-foreground)]">
                Sum between
              </span>
              <Input
                type="number"
                value={effectiveSumMin}
                onChange={(e) => setSumMin(Number(e.target.value))}
                className="w-20 bg-[var(--card)] text-center"
              />
              <span className="text-xs text-[var(--muted-foreground)]">
                and
              </span>
              <Input
                type="number"
                value={effectiveSumMax}
                onChange={(e) => setSumMax(Number(e.target.value))}
                className="w-20 bg-[var(--card)] text-center"
              />
              <span className="text-[10px] text-[var(--muted-foreground)]">
                (typical: {typicalRange.min} - {typicalRange.max})
              </span>
            </div>
          )}

          {/* Must Include picker */}
          <div>
            <button
              type="button"
              onClick={() => setShowMustInclude(!showMustInclude)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:text-[var(--gold)]"
            >
              {showMustInclude ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Must Include
              {mustInclude.size > 0 && (
                <span className="rounded-full bg-[var(--gold)]/20 px-2 py-0.5 text-xs text-[var(--gold)]">
                  {mustInclude.size}
                </span>
              )}
            </button>
            {showMustInclude && (
              <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3">
                <NumberPickerGrid
                  numberRange={game.numberRange}
                  selected={mustInclude}
                  onToggle={toggleMustInclude}
                  label="Click numbers that must appear in every set"
                  variant="selected"
                />
              </div>
            )}
          </div>

          {/* Exclude picker */}
          <div>
            <button
              type="button"
              onClick={() => setShowExclude(!showExclude)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:text-[var(--gold)]"
            >
              {showExclude ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Exclude Numbers
              {excludeNumbers.size > 0 && (
                <span className="rounded-full bg-[var(--hot)]/20 px-2 py-0.5 text-xs text-[var(--hot)]">
                  {excludeNumbers.size}
                </span>
              )}
            </button>
            {showExclude && (
              <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/30 p-3">
                <NumberPickerGrid
                  numberRange={game.numberRange}
                  selected={excludeNumbers}
                  onToggle={toggleExclude}
                  label="Click numbers to exclude from generation"
                  variant="hot"
                />
              </div>
            )}
          </div>

          {/* Set count + Generate button */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--muted-foreground)]">
                Sets to generate:
              </span>
              <select
                value={setCount}
                onChange={(e) => setSetCount(Number(e.target.value))}
                className="h-8 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--gold)]"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="ml-auto gap-2 bg-[var(--gold)] px-6 text-[var(--primary-foreground)] hover:bg-[var(--gold-dim)]"
              size="lg"
            >
              <Sparkles className="h-4 w-4" />
              {generateMutation.isPending ? "Generating..." : "Generate All"}
            </Button>
          </div>
        </div>
      </AnalysisCard>

      {/* Error display */}
      {generateMutation.isError && (
        <div className="rounded-lg border border-[var(--hot)]/30 bg-[var(--hot)]/5 px-4 py-3 text-sm text-[var(--hot)]">
          {generateMutation.error?.message ?? "Generation failed"}
        </div>
      )}

      {/* Section C: Generated Results */}
      {results.length > 0 && (
        <AnalysisCard
          title="Generated Numbers"
          subtitle={`${results.length} set${results.length !== 1 ? "s" : ""} using ${currentStrategy.label} strategy`}
        >
          <div className="flex flex-col gap-4">
            {results.map((set, i) => (
              <GeneratedSetRow
                key={`${i}-${set.numbers.join(",")}`}
                set={set}
                index={i}
                onRegenerate={handleRegenerate}
                isRegenerating={false}
              />
            ))}
          </div>
        </AnalysisCard>
      )}

      {/* Section D: Strategy Explanation */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowExplanation(!showExplanation)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
        >
          <Info className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            How does the {currentStrategy.label} strategy work?
          </span>
          {showExplanation ? (
            <ChevronUp className="ml-auto h-4 w-4 text-[var(--muted-foreground)]" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 text-[var(--muted-foreground)]" />
          )}
        </button>

        {showExplanation && (
          <div className="border-t border-[var(--border)] px-5 py-4">
            <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
              {currentStrategy.explanation}
            </p>
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--gold)]/20 bg-[var(--gold)]/5 px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
              <p className="text-xs leading-relaxed text-[var(--gold)]/80">
                These strategies organize your number selection based on
                historical patterns. They do not improve the probability of
                winning — every combination has equal odds.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
