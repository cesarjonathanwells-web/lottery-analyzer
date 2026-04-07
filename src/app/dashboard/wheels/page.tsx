"use client";

import { useState, useMemo, useCallback } from "react";
import { useGameStore } from "@/lib/store";
import { getGameById } from "@/lib/games";
import { NumberBall } from "@/components/lottery/number-ball";
import { AnalysisCard } from "@/components/lottery/analysis-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  findMatchingTemplates,
  mapTemplate,
  calculateWheelCost,
  type WheelTemplate,
  type GeneratedWheel,
} from "@/lib/wheels";
import {
  TargetIcon,
  SparklesIcon,
  Trash2Icon,
  ShuffleIcon,
  ZapIcon,
  DollarSignIcon,
  ShieldCheckIcon,
  InfoIcon,
  LoaderIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TicketIcon,
} from "lucide-react";

// ── Guarantee Presets ─────────────────────────────────────────────────────────

interface GuaranteePreset {
  label: string;
  match: number;
  ifDrawn: number;
}

const GUARANTEE_PRESETS: GuaranteePreset[] = [
  { label: "3-if-3", match: 3, ifDrawn: 3 },
  { label: "3-if-4", match: 3, ifDrawn: 4 },
  { label: "3-if-5", match: 3, ifDrawn: 5 },
  { label: "4-if-4", match: 4, ifDrawn: 4 },
  { label: "4-if-5", match: 4, ifDrawn: 5 },
  { label: "4-if-6", match: 4, ifDrawn: 6 },
  { label: "5-if-5", match: 5, ifDrawn: 5 },
  { label: "5-if-6", match: 5, ifDrawn: 6 },
];

// ── Page Component ────────────────────────────────────────────────────────────

export default function WheelsPage() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);

  // Number picker state
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);

  // Guarantee state
  const pickSize = game?.ballsDrawn ?? 6;
  const [guaranteeMatch, setGuaranteeMatch] = useState(3);
  const [guaranteeIfDrawn, setGuaranteeIfDrawn] = useState(4);

  // Generation state
  const [generatedWheel, setGeneratedWheel] = useState<GeneratedWheel | null>(
    null,
  );
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showAllTickets, setShowAllTickets] = useState(false);

  // Template state
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const numberRange = game?.numberRange ?? 69;

  // All numbers in game range
  const allNumbers = useMemo(
    () => Array.from({ length: numberRange }, (_, i) => i + 1),
    [numberRange],
  );

  const sortedSelected = useMemo(
    () => [...selectedNumbers].sort((a, b) => a - b),
    [selectedNumbers],
  );

  // Matching templates
  const matchingTemplates = useMemo(() => {
    const all = findMatchingTemplates(pickSize);
    // Show templates for current pick size; highlight exact pool matches
    return all.sort((a, b) => a.poolSize - b.poolSize || a.ticketCount - b.ticketCount);
  }, [pickSize]);

  // Cost calculation
  const costInfo = useMemo(() => {
    if (!generatedWheel) return null;
    return calculateWheelCost(
      generatedWheel.ticketCount,
      selectedNumbers.length,
      pickSize,
      2,
    );
  }, [generatedWheel, selectedNumbers.length, pickSize]);

  // Applicable guarantee presets (filter by pickSize)
  const applicablePresets = useMemo(
    () => GUARANTEE_PRESETS.filter((p) => p.match <= pickSize && p.ifDrawn <= pickSize),
    [pickSize],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleNumber = useCallback((num: number) => {
    setSelectedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num],
    );
    setGeneratedWheel(null);
    setActiveTemplateId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNumbers([]);
    setGeneratedWheel(null);
    setActiveTemplateId(null);
    setGenError(null);
  }, []);

  const quickPick = useCallback(
    (count: number) => {
      const available = Array.from({ length: numberRange }, (_, i) => i + 1);
      const picked: number[] = [];
      for (let i = 0; i < Math.min(count, numberRange); i++) {
        const idx = Math.floor(Math.random() * available.length);
        picked.push(available[idx]);
        available.splice(idx, 1);
      }
      setSelectedNumbers(picked.sort((a, b) => a - b));
      setGeneratedWheel(null);
      setActiveTemplateId(null);
      setGenError(null);
    },
    [numberRange],
  );

  const applyTemplate = useCallback(
    (template: WheelTemplate) => {
      if (selectedNumbers.length !== template.poolSize) {
        setGenError(
          `This template requires exactly ${template.poolSize} numbers. You have ${selectedNumbers.length} selected.`,
        );
        return;
      }
      try {
        const mapped = mapTemplate(template, sortedSelected);
        setGeneratedWheel({
          combinations: mapped,
          ticketCount: mapped.length,
          guarantee: `Guaranteed ${template.guaranteeMatch}-match if ${template.guaranteeIfDrawn} of your ${template.poolSize} numbers are drawn`,
          coveragePercent: 100,
        });
        setGuaranteeMatch(template.guaranteeMatch);
        setGuaranteeIfDrawn(template.guaranteeIfDrawn);
        setActiveTemplateId(template.id);
        setGenError(null);
        setShowAllTickets(false);
      } catch (err) {
        setGenError(err instanceof Error ? err.message : "Failed to apply template");
      }
    },
    [selectedNumbers.length, sortedSelected],
  );

  const handleGenerate = useCallback(async () => {
    if (selectedNumbers.length < pickSize) {
      setGenError(`Select at least ${pickSize} numbers to generate a wheel`);
      return;
    }
    if (selectedNumbers.length > 20) {
      setGenError("Maximum pool size is 20 numbers");
      return;
    }
    if (guaranteeMatch > pickSize) {
      setGenError(`Guarantee match (${guaranteeMatch}) cannot exceed pick size (${pickSize})`);
      return;
    }
    if (guaranteeIfDrawn > selectedNumbers.length) {
      setGenError(
        `Guarantee-if-drawn (${guaranteeIfDrawn}) cannot exceed pool size (${selectedNumbers.length})`,
      );
      return;
    }
    if (guaranteeIfDrawn < guaranteeMatch) {
      setGenError(
        `Guarantee-if-drawn (${guaranteeIfDrawn}) must be >= guarantee match (${guaranteeMatch})`,
      );
      return;
    }

    setGenerating(true);
    setGenError(null);
    setActiveTemplateId(null);

    try {
      // Run generation via API for isolation (could be heavy)
      const res = await fetch("/api/wheels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolNumbers: sortedSelected,
          pickSize,
          guaranteeMatch,
          guaranteeIfDrawn,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Generation failed");
      }

      const wheel: GeneratedWheel = await res.json();
      setGeneratedWheel(wheel);
      setShowAllTickets(false);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [selectedNumbers, sortedSelected, pickSize, guaranteeMatch, guaranteeIfDrawn]);

  // ── Render ────────────────────────────────────────────────────────────────

  const VISIBLE_TICKET_LIMIT = 20;
  const visibleTickets = generatedWheel
    ? showAllTickets
      ? generatedWheel.combinations
      : generatedWheel.combinations.slice(0, VISIBLE_TICKET_LIMIT)
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-dim)]">
          <TargetIcon className="h-5 w-5 text-[var(--background)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Wheel Generator
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            Build optimized lottery wheels with mathematical guarantees
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION A: Number Picker                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnalysisCard
        title="SELECT YOUR NUMBERS"
        subtitle={`${selectedNumbers.length} of ${numberRange} numbers selected${selectedNumbers.length > 20 ? " (max 20)" : ""}`}
      >
        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => quickPick(8)}
              className="gap-1.5 border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
            >
              <ShuffleIcon className="h-3.5 w-3.5" />
              Quick 8
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => quickPick(10)}
              className="gap-1.5 border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
            >
              <ShuffleIcon className="h-3.5 w-3.5" />
              Quick 10
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => quickPick(12)}
              className="gap-1.5 border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
            >
              <ShuffleIcon className="h-3.5 w-3.5" />
              Quick 12
            </Button>
            {selectedNumbers.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="gap-1.5 text-[var(--destructive)] hover:text-[var(--destructive)]"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            {/* Selected count badge */}
            {selectedNumbers.length > 0 && (
              <Badge
                variant="outline"
                className="ml-auto border-[var(--gold)]/30 text-[var(--gold)]"
              >
                {selectedNumbers.length} selected
              </Badge>
            )}
          </div>

          {/* Number Grid */}
          <div className="flex flex-wrap gap-1.5">
            {allNumbers.map((num) => {
              const isSelected = selectedNumbers.includes(num);
              const isOverLimit =
                !isSelected && selectedNumbers.length >= 20;
              return (
                <NumberBall
                  key={num}
                  number={num}
                  size="sm"
                  variant={
                    isSelected
                      ? "selected"
                      : isOverLimit
                        ? "disabled"
                        : "default"
                  }
                  onClick={
                    isOverLimit ? undefined : () => toggleNumber(num)
                  }
                />
              );
            })}
          </div>

          {/* Selected numbers display */}
          {selectedNumbers.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Your Pool
              </p>
              <div className="flex flex-wrap gap-2">
                {sortedSelected.map((num) => (
                  <NumberBall
                    key={num}
                    number={num}
                    size="md"
                    variant="warm"
                    onClick={() => toggleNumber(num)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </AnalysisCard>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION B: Guarantee Selector                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnalysisCard
        title="GUARANTEE LEVEL"
        subtitle={`Pick-${pickSize} game (${game?.name ?? "Unknown"})`}
      >
        <div className="space-y-4">
          {/* Preset buttons */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Quick Presets
            </p>
            <div className="flex flex-wrap gap-2">
              {applicablePresets.map((preset) => {
                const isActive =
                  guaranteeMatch === preset.match &&
                  guaranteeIfDrawn === preset.ifDrawn;
                return (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setGuaranteeMatch(preset.match);
                      setGuaranteeIfDrawn(preset.ifDrawn);
                      setGeneratedWheel(null);
                      setActiveTemplateId(null);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-mono transition-all ${
                      isActive
                        ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)] shadow-[0_0_12px_rgba(245,166,35,0.15)]"
                        : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/40 hover:text-[var(--foreground)]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom selectors */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Guarantee Match (t)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGuaranteeMatch(Math.max(1, guaranteeMatch - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--foreground)]"
                >
                  -
                </button>
                <div className="flex h-8 min-w-[3rem] items-center justify-center rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/5 font-mono text-sm font-bold text-[var(--gold)]">
                  {guaranteeMatch}
                </div>
                <button
                  onClick={() =>
                    setGuaranteeMatch(Math.min(pickSize, guaranteeMatch + 1))
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--foreground)]"
                >
                  +
                </button>
                <span className="text-xs text-[var(--muted-foreground)]">
                  numbers match
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                If Drawn (p)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setGuaranteeIfDrawn(
                      Math.max(guaranteeMatch, guaranteeIfDrawn - 1),
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--foreground)]"
                >
                  -
                </button>
                <div className="flex h-8 min-w-[3rem] items-center justify-center rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/5 font-mono text-sm font-bold text-[var(--gold)]">
                  {guaranteeIfDrawn}
                </div>
                <button
                  onClick={() =>
                    setGuaranteeIfDrawn(
                      Math.min(
                        selectedNumbers.length || 20,
                        guaranteeIfDrawn + 1,
                      ),
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--foreground)]"
                >
                  +
                </button>
                <span className="text-xs text-[var(--muted-foreground)]">
                  of your numbers drawn
                </span>
              </div>
            </div>
          </div>

          {/* Human-readable guarantee */}
          <div className="flex items-start gap-2 rounded-lg border border-[var(--electric-blue)]/20 bg-[var(--electric-blue)]/5 p-3">
            <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--electric-blue)]" />
            <p className="text-sm text-[var(--foreground)]">
              <span className="font-semibold text-[var(--electric-blue)]">
                Guarantee:
              </span>{" "}
              If{" "}
              <span className="font-bold text-[var(--gold)]">
                {guaranteeIfDrawn}
              </span>{" "}
              of your{" "}
              <span className="font-bold">
                {selectedNumbers.length || "N"}
              </span>{" "}
              pool numbers appear in the draw, at least one ticket will match{" "}
              <span className="font-bold text-[var(--gold)]">
                {guaranteeMatch}
              </span>{" "}
              or more numbers.
            </p>
          </div>
        </div>
      </AnalysisCard>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION C: Template Browser                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnalysisCard
        title="PRE-BUILT TEMPLATES"
        subtitle={`Optimized covering designs for Pick-${pickSize} games`}
      >
        <div className="space-y-2">
          {matchingTemplates.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
              No pre-built templates available for Pick-{pickSize} games.
            </p>
          ) : (
            matchingTemplates.map((tpl) => {
              const poolMatch = tpl.poolSize === selectedNumbers.length;
              const isActive = activeTemplateId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  className={`group flex flex-col gap-2 rounded-lg border p-3 transition-all sm:flex-row sm:items-center sm:justify-between ${
                    isActive
                      ? "border-[var(--gold)]/40 bg-[var(--gold)]/5"
                      : "border-[var(--border)] hover:border-[var(--border)]/60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {tpl.name}
                      </p>
                      {poolMatch && (
                        <Badge
                          variant="outline"
                          className="border-[var(--neon-green)]/30 text-[var(--neon-green)]"
                        >
                          Pool Match
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {tpl.description}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        <span className="font-mono text-[var(--foreground)]">
                          {tpl.ticketCount}
                        </span>{" "}
                        tickets
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        <span className="font-mono text-[var(--foreground)]">
                          {tpl.poolSize}
                        </span>{" "}
                        numbers
                      </span>
                      <span className="text-xs font-mono text-[var(--gold)]">
                        {tpl.guaranteeMatch}-if-{tpl.guaranteeIfDrawn}
                      </span>
                      <span className="text-xs font-mono text-[var(--muted-foreground)]">
                        L({tpl.poolSize},{tpl.pickSize},{tpl.guaranteeIfDrawn},{tpl.guaranteeMatch})
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(tpl)}
                    disabled={selectedNumbers.length !== tpl.poolSize}
                    className={`shrink-0 gap-1.5 ${
                      poolMatch
                        ? "border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/10"
                        : "border-[var(--border)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    <SparklesIcon className="h-3.5 w-3.5" />
                    {selectedNumbers.length !== tpl.poolSize
                      ? `Need ${tpl.poolSize}`
                      : "Use Template"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </AnalysisCard>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION D: Generated Wheel Display                                */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnalysisCard
        title="GENERATED WHEEL"
        subtitle={
          generatedWheel
            ? `${generatedWheel.ticketCount} tickets | ${generatedWheel.coveragePercent}% coverage`
            : "Select numbers and generate"
        }
      >
        <div className="space-y-4">
          {/* Generate button */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleGenerate}
              disabled={generating || selectedNumbers.length < pickSize}
              className="gap-1.5 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-dim)] font-semibold text-[var(--background)] shadow-[0_2px_12px_rgba(245,166,35,0.3)] transition-all hover:shadow-[0_4px_20px_rgba(245,166,35,0.4)] disabled:opacity-40 disabled:shadow-none"
            >
              {generating ? (
                <LoaderIcon className="h-4 w-4 animate-spin" />
              ) : (
                <ZapIcon className="h-4 w-4" />
              )}
              {generating ? "Generating..." : "Generate Custom Wheel"}
            </Button>
            {selectedNumbers.length < pickSize && (
              <span className="text-xs text-[var(--muted-foreground)]">
                Select at least {pickSize} numbers to generate
              </span>
            )}
          </div>

          {/* Error display */}
          {genError && (
            <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-3">
              <p className="text-sm text-[var(--destructive)]">{genError}</p>
            </div>
          )}

          {/* Wheel results */}
          {generatedWheel && (
            <>
              {/* Summary bar */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryBox
                  icon={<TicketIcon className="h-4 w-4" />}
                  label="Tickets"
                  value={generatedWheel.ticketCount.toString()}
                />
                <SummaryBox
                  icon={<DollarSignIcon className="h-4 w-4" />}
                  label="Total Cost"
                  value={costInfo ? `$${costInfo.totalCost}` : "--"}
                />
                <SummaryBox
                  icon={<ShieldCheckIcon className="h-4 w-4" />}
                  label="Coverage"
                  value={`${generatedWheel.coveragePercent}%`}
                />
                <SummaryBox
                  icon={<SparklesIcon className="h-4 w-4" />}
                  label="Savings"
                  value={costInfo ? `${costInfo.savingsPercent}%` : "--"}
                  subtitle={
                    costInfo
                      ? `vs ${costInfo.fullWheelTickets} full tickets`
                      : undefined
                  }
                />
              </div>

              {/* Guarantee description */}
              <div className="flex items-start gap-2 rounded-lg border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-3">
                <ShieldCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
                <p className="text-sm text-[var(--foreground)]">
                  {generatedWheel.guarantee}
                </p>
              </div>

              {/* Tickets table */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]">
                {/* Table header */}
                <div className="grid grid-cols-[3.5rem_1fr] border-b border-[var(--border)] px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    #
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Numbers
                  </span>
                </div>

                {/* Ticket rows */}
                {visibleTickets.map((ticket, idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-[3.5rem_1fr] items-center px-3 py-2 ${
                      idx < visibleTickets.length - 1
                        ? "border-b border-[var(--border)]/50"
                        : ""
                    } ${idx % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                  >
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">
                      {String(idx + 1).padStart(3, "0")}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ticket.map((num) => (
                        <NumberBall
                          key={num}
                          number={num}
                          size="sm"
                          variant="warm"
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Show more / less */}
                {generatedWheel.combinations.length > VISIBLE_TICKET_LIMIT && (
                  <button
                    onClick={() => setShowAllTickets(!showAllTickets)}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--border)] py-2.5 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--gold)]"
                  >
                    {showAllTickets ? (
                      <>
                        <ChevronUpIcon className="h-3.5 w-3.5" />
                        Show fewer
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                        Show all {generatedWheel.combinations.length} tickets
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </AnalysisCard>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SECTION E: Coverage Explanation                                    */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnalysisCard title="HOW WHEELS WORK" subtitle="Understanding coverage guarantees">
        <div className="space-y-4">
          <div className="space-y-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
            <div className="flex items-start gap-2.5">
              <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/10 text-[10px] font-bold text-[var(--gold)]">
                1
              </div>
              <p>
                <span className="font-semibold text-[var(--foreground)]">
                  Choose your pool
                </span>{" "}
                -- select more numbers than the game requires. For Powerball
                (pick 5), you might choose 10 numbers you believe will appear.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/10 text-[10px] font-bold text-[var(--gold)]">
                2
              </div>
              <p>
                <span className="font-semibold text-[var(--foreground)]">
                  Set your guarantee
                </span>{" "}
                -- a &quot;3-if-4&quot; guarantee means: if 4 of your pool
                numbers are in the winning draw, at least one of your tickets
                will match 3 numbers.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/10 text-[10px] font-bold text-[var(--gold)]">
                3
              </div>
              <p>
                <span className="font-semibold text-[var(--foreground)]">
                  Generate tickets
                </span>{" "}
                -- the algorithm finds the minimum set of tickets needed to
                fulfil your guarantee using a greedy set cover approach.
              </p>
            </div>
          </div>

          {/* Notation */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="flex items-start gap-2">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--electric-blue)]" />
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[var(--foreground)]">
                  Mathematical Notation
                </p>
                <p className="font-mono text-xs text-[var(--muted-foreground)]">
                  L(n, k, p, t) = B
                </p>
                <ul className="space-y-0.5 text-xs text-[var(--muted-foreground)]">
                  <li>
                    <span className="font-mono text-[var(--gold)]">n</span> = pool size
                    (your chosen numbers)
                  </li>
                  <li>
                    <span className="font-mono text-[var(--gold)]">k</span> = pick size
                    (numbers per ticket)
                  </li>
                  <li>
                    <span className="font-mono text-[var(--gold)]">p</span> = how many of
                    your pool must be drawn
                  </li>
                  <li>
                    <span className="font-mono text-[var(--gold)]">t</span> = guaranteed
                    minimum matches
                  </li>
                  <li>
                    <span className="font-mono text-[var(--gold)]">B</span> = number of
                    tickets needed
                  </li>
                </ul>
                {generatedWheel && (
                  <p className="mt-2 font-mono text-sm font-bold text-[var(--gold)]">
                    L({selectedNumbers.length}, {pickSize}, {guaranteeIfDrawn},{" "}
                    {guaranteeMatch}) = {generatedWheel.ticketCount} tickets
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Warning about filtered wheels */}
          <div className="flex items-start gap-2 rounded-lg border border-[var(--gold-dim)]/30 bg-[var(--gold-dim)]/5 p-3">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-dim)]" />
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              <span className="font-semibold text-[var(--gold-dim)]">
                Important:
              </span>{" "}
              Manually removing tickets from a generated wheel will break the
              mathematical guarantee. The coverage is only valid when all
              generated tickets are played together.
            </p>
          </div>
        </div>
      </AnalysisCard>
    </div>
  );
}

// ── Summary Box Sub-Component ─────────────────────────────────────────────────

function SummaryBox({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[var(--muted-foreground)]">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="font-mono text-lg font-bold text-[var(--gold)]">{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
          {subtitle}
        </p>
      )}
    </div>
  );
}
