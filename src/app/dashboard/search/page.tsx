"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { GAME_GROUPS, GAMES } from "@/lib/games";
import { NumberBall } from "@/components/lottery/number-ball";
import { AnalysisCard } from "@/components/lottery/analysis-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Loader2,
  Info,
} from "lucide-react";

import type {
  SearchMode,
  Position,
  SearchParams,
  SearchResult,
} from "@/lib/search/engine";

// ── Types ───────────────────────────────────────────────────────────────────

interface SearchState {
  numbers: string[];
  gameIds: string[];
  mode: SearchMode;
  position: Position;
  reversed: boolean;
  dateFilters: {
    days: number[];
    months: string[];
    years: number[];
  };
}

// ── Constants ───────────────────────────────────────────────────────────────

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const PAGE_SIZE = 20;

// ── Combination Helpers (client-side mirror) ────────────────────────────────

function reverseNumber(n: number): number {
  if (n < 10) return n;
  const s = String(n);
  return parseInt(s.split("").reverse().join(""), 10);
}

function expandWithReversed(numbers: number[]): number[] {
  const set = new Set<number>(numbers);
  for (const n of numbers) set.add(reverseNumber(n));
  return Array.from(set);
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 1) return arr.map((x) => [x]);
  if (k === arr.length) return [arr];
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i];
    const tailCombos = getCombinations(arr.slice(i + 1), k - 1);
    for (const tail of tailCombos) {
      result.push([head, ...tail]);
    }
  }
  return result;
}

// ── Fetch Function ──────────────────────────────────────────────────────────

async function fetchSearchResults(
  params: SearchParams,
): Promise<{
  results: SearchResult[];
  totalMatches: number;
  gameBreakdown: Record<string, number>;
}> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Search failed" }));
    throw new Error(err.error ?? "Search failed");
  }
  return res.json();
}

// ── Multi-Select Toggle Chip ────────────────────────────────────────────────

function ToggleChip({
  label,
  selected,
  onClick,
  size = "default",
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  size?: "sm" | "default";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border font-mono transition-all",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        selected
          ? "border-[var(--gold)]/50 bg-[var(--gold)]/15 text-[var(--gold)]"
          : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/30 hover:text-[var(--foreground)]",
      )}
    >
      {label}
    </button>
  );
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function SearchPage() {
  // Search state
  const [search, setSearch] = useState<SearchState>({
    numbers: [""],
    gameIds: [],
    mode: "quiniela",
    position: 0,
    reversed: false,
    dateFilters: { days: [], months: [], years: [] },
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(0);
  const [submitted, setSubmitted] = useState<SearchParams | null>(null);

  // Parsed valid numbers
  const validNumbers = useMemo(
    () =>
      search.numbers
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n) && n >= 0),
    [search.numbers],
  );

  // Combination info (client-side preview)
  const combinationInfo = useMemo(() => {
    if (validNumbers.length === 0) return null;

    const expanded = search.reversed
      ? expandWithReversed(validNumbers)
      : [...validNumbers];

    if (search.mode === "quiniela") {
      return {
        count: expanded.length,
        descriptions: expanded.map(String),
        label: "quinielas",
      };
    }
    if (search.mode === "pale") {
      if (expanded.length < 2) return null;
      const combos = getCombinations(expanded, 2);
      return {
        count: combos.length,
        descriptions: combos.map((c) => c.join("-")),
        label: "pales",
      };
    }
    // tripleta
    if (expanded.length < 3) return null;
    const combos = getCombinations(expanded, 3);
    return {
      count: combos.length,
      descriptions: combos.map((c) => c.join("-")),
      label: "tripletas",
    };
  }, [validNumbers, search.mode, search.reversed]);

  // Build query params for the current submission
  const queryParams = useMemo(() => {
    if (!submitted) return null;
    return { ...submitted, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  }, [submitted, page]);

  // React Query for search results
  const {
    data: searchData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["search", queryParams],
    queryFn: () => fetchSearchResults(queryParams!),
    enabled: !!queryParams,
  });

  // Handlers
  const handleNumberChange = useCallback(
    (index: number, value: string) => {
      setSearch((prev) => {
        const next = [...prev.numbers];
        // Only allow numeric input
        next[index] = value.replace(/[^0-9]/g, "");
        return { ...prev, numbers: next };
      });
    },
    [],
  );

  const addNumberField = useCallback(() => {
    setSearch((prev) => {
      if (prev.numbers.length >= 10) return prev;
      return { ...prev, numbers: [...prev.numbers, ""] };
    });
  }, []);

  const removeNumberField = useCallback((index: number) => {
    setSearch((prev) => {
      if (prev.numbers.length <= 1) return prev;
      return { ...prev, numbers: prev.numbers.filter((_, i) => i !== index) };
    });
  }, []);

  const toggleGame = useCallback((gameId: string) => {
    setSearch((prev) => {
      const next = prev.gameIds.includes(gameId)
        ? prev.gameIds.filter((id) => id !== gameId)
        : [...prev.gameIds, gameId];
      return { ...prev, gameIds: next };
    });
  }, []);

  const selectAllGames = useCallback(() => {
    setSearch((prev) => ({ ...prev, gameIds: [] }));
  }, []);

  const toggleDay = useCallback((day: number) => {
    setSearch((prev) => {
      const days = prev.dateFilters.days.includes(day)
        ? prev.dateFilters.days.filter((d) => d !== day)
        : [...prev.dateFilters.days, day];
      return { ...prev, dateFilters: { ...prev.dateFilters, days } };
    });
  }, []);

  const toggleMonth = useCallback((month: string) => {
    setSearch((prev) => {
      const months = prev.dateFilters.months.includes(month)
        ? prev.dateFilters.months.filter((m) => m !== month)
        : [...prev.dateFilters.months, month];
      return { ...prev, dateFilters: { ...prev.dateFilters, months } };
    });
  }, []);

  const toggleYear = useCallback((year: number) => {
    setSearch((prev) => {
      const years = prev.dateFilters.years.includes(year)
        ? prev.dateFilters.years.filter((y) => y !== year)
        : [...prev.dateFilters.years, year];
      return { ...prev, dateFilters: { ...prev.dateFilters, years } };
    });
  }, []);

  const handleSearch = useCallback(() => {
    if (validNumbers.length === 0) return;

    // Mode validation
    if (search.mode === "pale" && validNumbers.length < 2) return;
    if (search.mode === "tripleta" && validNumbers.length < 3) return;

    const params: SearchParams = {
      numbers: validNumbers,
      gameIds: search.gameIds,
      mode: search.mode,
      position: search.position,
      reversed: search.reversed,
      dateFilters:
        search.dateFilters.days.length > 0 ||
        search.dateFilters.months.length > 0 ||
        search.dateFilters.years.length > 0
          ? search.dateFilters
          : undefined,
    };

    setPage(0);
    setSubmitted(params);
  }, [search, validNumbers]);

  const handleClear = useCallback(() => {
    setSearch({
      numbers: [""],
      gameIds: [],
      mode: "quiniela",
      position: 0,
      reversed: false,
      dateFilters: { days: [], months: [], years: [] },
    });
    setSubmitted(null);
    setPage(0);
  }, []);

  const canSearch =
    validNumbers.length > 0 &&
    (search.mode === "quiniela" ||
      (search.mode === "pale" && validNumbers.length >= 2) ||
      (search.mode === "tripleta" && validNumbers.length >= 3));

  const totalPages = searchData
    ? Math.ceil(searchData.totalMatches / PAGE_SIZE)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--gold)]">
          Number Search
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Search historical draws by number, pale, or tripleta across all games
        </p>
      </div>

      {/* ── Section A: Search Controls ─────────────────────────────────── */}
      <AnalysisCard title="Search Parameters" subtitle="Configure your search">
        <div className="flex flex-col gap-5">
          {/* Number Inputs */}
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--muted-foreground)]">
              Numbers
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {search.numbers.map((val, i) => (
                <div key={i} className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={val}
                    onChange={(e) =>
                      handleNumberChange(i, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    placeholder="00"
                    className="h-10 w-16 text-center font-mono text-base tabular-nums bg-[var(--secondary)] border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/40"
                    maxLength={3}
                  />
                  {search.numbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeNumberField(i)}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--destructive)] text-white text-[10px] hover:brightness-110"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
              {search.numbers.length < 10 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addNumberField}
                  className="h-10 w-10 border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--muted-foreground)]">
              Search Mode
            </label>
            <div className="flex gap-2">
              {(
                [
                  { value: "quiniela", label: "Quiniela", desc: "Single number" },
                  { value: "pale", label: "Pale", desc: "Pair of numbers" },
                  { value: "tripleta", label: "Tripleta", desc: "Three numbers" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setSearch((prev) => ({ ...prev, mode: opt.value }))
                  }
                  className={cn(
                    "flex flex-col rounded-lg border px-4 py-2.5 text-left transition-all",
                    search.mode === opt.value
                      ? "border-[var(--gold)]/50 bg-[var(--gold)]/10 text-[var(--gold)]"
                      : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/30",
                  )}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-[10px] opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Position Filter (quiniela only) */}
          {search.mode === "quiniela" && (
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--muted-foreground)]">
                Position
              </label>
              <div className="flex gap-2">
                {(
                  [
                    { value: 0, label: "All" },
                    { value: 1, label: "1ra" },
                    { value: 2, label: "2da" },
                    { value: 3, label: "3ra" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setSearch((prev) => ({
                        ...prev,
                        position: opt.value as Position,
                      }))
                    }
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
                      search.position === opt.value
                        ? "border-[var(--electric-blue)]/50 bg-[var(--electric-blue)]/10 text-[var(--electric-blue)]"
                        : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:border-[var(--electric-blue)]/30",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reversed Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setSearch((prev) => ({ ...prev, reversed: !prev.reversed }))
              }
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                search.reversed
                  ? "bg-[var(--gold)]"
                  : "bg-[var(--secondary)]",
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm",
                  search.reversed && "translate-x-5",
                )}
              />
            </button>
            <div>
              <span className="text-sm text-[var(--foreground)]">
                Include reversed numbers
              </span>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                e.g., searching 12 also matches 21
              </p>
            </div>
          </div>

          {/* Game Selector */}
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--muted-foreground)]">
              Games
            </label>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={selectAllGames}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-all w-fit",
                  search.gameIds.length === 0
                    ? "border-[var(--gold)]/50 bg-[var(--gold)]/10 text-[var(--gold)]"
                    : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/30",
                )}
              >
                All Games
              </button>
              {GAME_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.games.map((game) => (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => toggleGame(game.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-all",
                          search.gameIds.includes(game.id)
                            ? "border-[var(--gold)]/50 bg-[var(--gold)]/10 text-[var(--gold)]"
                            : "border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/30 hover:text-[var(--foreground)]",
                        )}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: game.color }}
                        />
                        {game.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Filters (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              {showAdvanced ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Advanced Filters
              {(search.dateFilters.days.length > 0 ||
                search.dateFilters.months.length > 0 ||
                search.dateFilters.years.length > 0) && (
                <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--gold)]/20 text-[10px] text-[var(--gold)]">
                  {search.dateFilters.days.length +
                    search.dateFilters.months.length +
                    search.dateFilters.years.length}
                </span>
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                {/* Day of Month */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Day of Month
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {DAYS.map((day) => (
                      <ToggleChip
                        key={day}
                        label={String(day)}
                        selected={search.dateFilters.days.includes(day)}
                        onClick={() => toggleDay(day)}
                        size="sm"
                      />
                    ))}
                  </div>
                </div>

                {/* Month */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Month
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {MONTHS.map((month) => (
                      <ToggleChip
                        key={month}
                        label={month}
                        selected={search.dateFilters.months.includes(month)}
                        onClick={() => toggleMonth(month)}
                      />
                    ))}
                  </div>
                </div>

                {/* Year */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Year
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {YEARS.map((year) => (
                      <ToggleChip
                        key={year}
                        label={String(year)}
                        selected={search.dateFilters.years.includes(year)}
                        onClick={() => toggleYear(year)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSearch}
              disabled={!canSearch || isLoading}
              className="gap-2 bg-[var(--gold)] text-[var(--primary-foreground)] hover:bg-[var(--gold-dim)] disabled:opacity-40"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              className="gap-2 border-[var(--border)] text-[var(--muted-foreground)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
      </AnalysisCard>

      {/* ── Section C: Combination Info ─────────────────────────────────── */}
      {combinationInfo && validNumbers.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--electric-blue)]/20 bg-[var(--electric-blue)]/5 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--electric-blue)]" />
          <div className="text-sm">
            <span className="text-[var(--foreground)]">
              Searching{" "}
              <span className="font-semibold text-[var(--electric-blue)]">
                {combinationInfo.count}
              </span>{" "}
              {combinationInfo.label}
            </span>
            {combinationInfo.count <= 20 && (
              <p className="mt-1 flex flex-wrap gap-1">
                {combinationInfo.descriptions.map((desc, i) => (
                  <span
                    key={i}
                    className="rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-xs text-[var(--muted-foreground)]"
                  >
                    {desc}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Section B: Results ─────────────────────────────────────────── */}
      {submitted && (
        <AnalysisCard
          title="Search Results"
          subtitle={
            searchData
              ? `${searchData.totalMatches.toLocaleString()} match${searchData.totalMatches !== 1 ? "es" : ""} found`
              : undefined
          }
          loading={isLoading}
        >
          {isError && (
            <div className="rounded-md bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]">
              {(error as Error)?.message ?? "Search failed"}
            </div>
          )}

          {searchData && (
            <div className="flex flex-col gap-4">
              {/* Game Breakdown */}
              {Object.keys(searchData.gameBreakdown).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(searchData.gameBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([gameName, count]) => {
                      const game = GAMES.find((g) => g.name === gameName);
                      return (
                        <div
                          key={gameName}
                          className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1"
                        >
                          {game && (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: game.color }}
                            />
                          )}
                          <span className="text-xs text-[var(--foreground)]">
                            {gameName}
                          </span>
                          <span className="font-mono text-xs font-semibold text-[var(--gold)]">
                            ({count})
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Results Table */}
              {searchData.results.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                          Date
                        </th>
                        <th className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                          Game
                        </th>
                        <th className="pb-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                          Numbers
                        </th>
                        <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                          Position
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchData.results.map((result, idx) => {
                        const game = GAMES.find(
                          (g) => g.id === result.draw.gameId,
                        );
                        return (
                          <tr
                            key={`${result.draw.id}-${idx}`}
                            className="border-b border-[var(--border)]/50 last:border-0"
                          >
                            <td className="py-2.5 pr-4 align-middle">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs text-[var(--foreground)]">
                                  {new Date(
                                    result.draw.drawDate + "T00:00:00",
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                                {result.draw.drawTime && (
                                  <span className="text-[10px] text-[var(--muted-foreground)]">
                                    {result.draw.drawTime}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 align-middle">
                              <div className="flex items-center gap-1.5">
                                {game && (
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor: game.color,
                                    }}
                                  />
                                )}
                                <span className="text-xs text-[var(--foreground)]">
                                  {result.draw.gameName}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 align-middle">
                              <div className="flex items-center gap-1.5">
                                {result.draw.numbers.map((num, i) => {
                                  const isMatched =
                                    result.matchedNumbers.includes(num) &&
                                    result.matchedPositions.includes(i + 1);
                                  return (
                                    <NumberBall
                                      key={i}
                                      number={num}
                                      size="sm"
                                      variant={
                                        isMatched ? "warm" : "default"
                                      }
                                    />
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-2.5 align-middle">
                              <div className="flex gap-1">
                                {result.matchedPositions.map((pos, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="bg-[var(--gold)]/10 text-[var(--gold)] text-[10px] font-mono"
                                  >
                                    {pos === 1
                                      ? "1ra"
                                      : pos === 2
                                        ? "2da"
                                        : `${pos}ra`}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                !isLoading && (
                  <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                    No matches found for your search criteria.
                  </div>
                )
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Page {page + 1} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="border-[var(--border)] text-[var(--muted-foreground)]"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="border-[var(--border)] text-[var(--muted-foreground)]"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </AnalysisCard>
      )}
    </div>
  );
}
