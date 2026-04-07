"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface AnimatedRevealProps {
  numbers: number[];
  bonusNumbers?: number[];
  onComplete?: () => void;
  autoPlay?: boolean;
  delay?: number; // ms between reveals, default 800
}

export function AnimatedReveal({
  numbers,
  bonusNumbers = [],
  onComplete,
  autoPlay = true,
  delay = 800,
}: AnimatedRevealProps) {
  const totalBalls = numbers.length + bonusNumbers.length;
  const [revealedCount, setRevealedCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allComplete = revealedCount >= totalBalls;

  const revealNext = useCallback(() => {
    setRevealedCount((prev) => {
      const next = prev + 1;
      if (next >= totalBalls) {
        setShowConfetti(true);
        onComplete?.();
      }
      return Math.min(next, totalBalls);
    });
  }, [totalBalls, onComplete]);

  // Auto-play timer
  useEffect(() => {
    if (!autoPlay || allComplete) return;

    timerRef.current = setTimeout(revealNext, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoPlay, revealedCount, delay, revealNext, allComplete]);

  const revealAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRevealedCount(totalBalls);
    setShowConfetti(true);
    onComplete?.();
  }, [totalBalls, onComplete]);

  // Reset when numbers change
  useEffect(() => {
    setRevealedCount(0);
    setShowConfetti(false);
  }, [numbers, bonusNumbers]);

  return (
    <div className="relative">
      {/* Confetti overlay */}
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="confetti-particle absolute block"
              style={{
                left: `${4 + Math.random() * 92}%`,
                animationDelay: `${Math.random() * 0.6}s`,
                backgroundColor:
                  i % 5 === 0
                    ? "var(--gold)"
                    : i % 5 === 1
                      ? "var(--electric-blue)"
                      : i % 5 === 2
                        ? "var(--neon-green)"
                        : i % 5 === 3
                          ? "var(--hot)"
                          : "#8b5cf6",
              }}
            />
          ))}
        </div>
      )}

      {/* Number balls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Main numbers */}
        {numbers.map((num, idx) => {
          const isRevealed = idx < revealedCount;
          return (
            <RevealBall
              key={`main-${idx}`}
              number={num}
              revealed={isRevealed}
              variant="main"
              index={idx}
            />
          );
        })}

        {/* Separator for bonus */}
        {bonusNumbers.length > 0 && (
          <span className="mx-1 text-lg font-bold text-[var(--muted-foreground)]">
            +
          </span>
        )}

        {/* Bonus numbers */}
        {bonusNumbers.map((num, idx) => {
          const globalIdx = numbers.length + idx;
          const isRevealed = globalIdx < revealedCount;
          return (
            <RevealBall
              key={`bonus-${idx}`}
              number={num}
              revealed={isRevealed}
              variant="bonus"
              index={globalIdx}
            />
          );
        })}
      </div>

      {/* Controls */}
      {!allComplete && (
        <div className="mt-4 flex gap-3">
          {!autoPlay && (
            <button
              type="button"
              onClick={revealNext}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 py-2 text-xs font-medium text-[var(--foreground)] transition-all hover:bg-[var(--secondary)]/80 hover:text-[var(--gold)]"
            >
              Reveal Next
            </button>
          )}
          <button
            type="button"
            onClick={revealAll}
            className="rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-2 text-xs font-medium text-[var(--gold)] transition-all hover:bg-[var(--gold)]/20"
          >
            Reveal All
          </button>
        </div>
      )}
    </div>
  );
}

// ── Individual Ball with Reveal Animation ─────────────────────────────────

function RevealBall({
  number,
  revealed,
  variant,
  index,
}: {
  number: number;
  revealed: boolean;
  variant: "main" | "bonus";
  index: number;
}) {
  const isBonus = variant === "bonus";

  return (
    <div
      className="perspective-[600px]"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className={cn(
          "relative h-14 w-14 transition-all duration-500",
          revealed ? "reveal-ball-flip" : "",
        )}
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {/* Front face (hidden number / "?") */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full font-mono text-base font-semibold tabular-nums backface-hidden",
            "bg-[var(--secondary)] text-[var(--muted-foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.4)]",
            revealed && "pointer-events-none",
          )}
        >
          <span className="animate-pulse text-lg">?</span>
        </div>

        {/* Back face (revealed number) */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full font-mono text-base font-semibold tabular-nums backface-hidden",
            isBonus
              ? "border-2 border-[var(--gold)] bg-[#0a0e1a] text-[var(--gold)] shadow-[0_0_16px_rgba(245,166,35,0.4)]"
              : "bg-gradient-to-br from-[#1e293b] to-[#111827] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.5)]",
            revealed && isBonus && "reveal-gold-flash",
          )}
          style={{
            transform: "rotateY(180deg)",
          }}
        >
          {/* Radial highlight */}
          <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.12)_0%,transparent_60%)]" />
          <span className="relative z-10">{number}</span>
        </div>
      </div>
    </div>
  );
}
