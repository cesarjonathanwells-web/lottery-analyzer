"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { GAMES } from "@/lib/games";
import type { Draw, GameType } from "@/lib/types";

import { AnalysisCard } from "@/components/lottery/analysis-card";
import { DrawHistory } from "@/components/lottery/draw-history";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { History, Search } from "lucide-react";
import { useState } from "react";

// ── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchAllDraws(
  gameId: string,
  from?: string,
  to?: string,
): Promise<Draw[]> {
  const params = new URLSearchParams({ game: gameId, limit: "500" });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await fetch(`/api/results?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch draws");
  const json = await res.json();
  return json.draws ?? json.data ?? [];
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [gameId, setGameId] = useQueryState("game", {
    defaultValue: "powerball",
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState<string | undefined>();
  const [appliedTo, setAppliedTo] = useState<string | undefined>();

  const game = GAMES.find((g) => g.id === gameId);

  const { data: draws, isLoading } = useQuery({
    queryKey: ["history", gameId, appliedFrom, appliedTo],
    queryFn: () => fetchAllDraws(gameId, appliedFrom, appliedTo),
    enabled: !!gameId,
  });

  function applyFilter() {
    setAppliedFrom(dateFrom || undefined);
    setAppliedTo(dateTo || undefined);
  }

  // Group games for select
  const caribbean = GAMES.filter(
    (g) => g.country === "AI" || g.country === "DO",
  );
  const usState = GAMES.filter(
    (g) =>
      g.country === "US" &&
      g.gameType !== "powerball" &&
      g.gameType !== "mega",
  );
  const usMajor = GAMES.filter(
    (g) =>
      g.country === "US" &&
      (g.gameType === "powerball" || g.gameType === "mega"),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <History className="h-6 w-6 text-[var(--gold)]" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--gold)]">
            Draw History
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Browse historical lottery results
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        {/* Game Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Game
          </label>
          <Select
            value={gameId}
            onValueChange={(val) => setGameId(val)}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select a game" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Caribbean</SelectLabel>
                {caribbean.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>US State</SelectLabel>
                {usState.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>US Major</SelectLabel>
                {usMajor.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            From
          </label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            To
          </label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>

        {/* Apply */}
        <Button onClick={applyFilter} variant="default" size="default">
          <Search className="mr-1.5 h-3.5 w-3.5" />
          Filter
        </Button>
      </div>

      {/* Results */}
      <AnalysisCard
        title={`${game?.name ?? "Game"} Results`}
        subtitle={
          draws
            ? `${draws.length} draws found`
            : undefined
        }
        loading={isLoading}
      >
        {draws && game && (
          <DrawHistory
            draws={draws}
            gameType={game.gameType as GameType}
            pageSize={20}
          />
        )}
      </AnalysisCard>
    </div>
  );
}
