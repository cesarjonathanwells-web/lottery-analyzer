"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/lib/store";
import { getGameById } from "@/lib/games";
import { AnimatedReveal } from "./animated-reveal";
import { AnalysisCard } from "./analysis-card";

interface DrawUpdate {
  gameId: string;
  numbers: number[];
  bonusNumbers: number[];
  drawDate: string;
  drawTime: string | null;
  jackpot: number | null;
  status: string;
}

interface StatusUpdate {
  message: string;
  nextDraw: string;
  gameId: string;
  gameName: string;
}

export function LiveDrawWidget() {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);

  const [connected, setConnected] = useState(false);
  const [latestDraw, setLatestDraw] = useState<DrawUpdate | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("Connecting...");
  const [nextDrawTime, setNextDrawTime] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>("");
  const [showReveal, setShowReveal] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Connect to SSE
  useEffect(() => {
    if (!activeGameId) return;

    // Clean up previous connection
    eventSourceRef.current?.close();
    setConnected(false);
    setLatestDraw(null);
    setShowReveal(false);
    setStatusMsg("Connecting...");

    const es = new EventSource(`/api/live?game=${activeGameId}`);
    eventSourceRef.current = es;

    es.addEventListener("status", (event) => {
      try {
        const data: StatusUpdate = JSON.parse(event.data);
        setConnected(true);
        setStatusMsg(data.message);
        setNextDrawTime(data.nextDraw);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("draw_update", (event) => {
      try {
        const data: DrawUpdate = JSON.parse(event.data);
        setLatestDraw(data);
        setShowReveal(true);
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      setConnected(false);
      setStatusMsg("Reconnecting...");
    };

    return () => {
      es.close();
    };
  }, [activeGameId]);

  // Countdown timer
  useEffect(() => {
    if (!nextDrawTime) {
      setCountdown("");
      return;
    }

    function updateCountdown() {
      const now = new Date().getTime();
      const target = new Date(nextDrawTime!).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown("DRAWING NOW");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      parts.push(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      );
      setCountdown(parts.join(" "));
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextDrawTime]);

  const handleRevealComplete = useCallback(() => {
    // Keep showing the revealed numbers
  }, []);

  return (
    <AnalysisCard
      title="Live Draw"
      subtitle={game?.name ?? "Select a game"}
      className="relative overflow-hidden"
    >
      {/* LIVE badge */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-1">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              connected
                ? "bg-[var(--neon-green)] live-pulse-dot"
                : "bg-[var(--muted-foreground)]",
            )}
          />
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest",
              connected
                ? "text-[var(--neon-green)]"
                : "text-[var(--muted-foreground)]",
            )}
          >
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Game info + countdown */}
        <div className="flex flex-wrap items-center gap-4">
          {game && (
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: game.color }}
              />
              <span className="text-sm font-medium text-[var(--foreground)]">
                {game.name}
              </span>
            </div>
          )}

          {/* Countdown */}
          {countdown && !showReveal && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted-foreground)]">
                Next draw in
              </span>
              <span className="font-mono text-lg font-bold tracking-tight text-[var(--gold)] tabular-nums">
                {countdown}
              </span>
            </div>
          )}
        </div>

        {/* Status message */}
        {!showReveal && (
          <p className="text-xs text-[var(--muted-foreground)]">{statusMsg}</p>
        )}

        {/* Animated reveal when new draw arrives */}
        {showReveal && latestDraw && (
          <div className="pt-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--gold)]">
                Draw Results
              </span>
              {latestDraw.drawDate && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  {new Date(
                    latestDraw.drawDate + "T00:00:00",
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
            <AnimatedReveal
              numbers={latestDraw.numbers}
              bonusNumbers={
                latestDraw.bonusNumbers.length > 0
                  ? latestDraw.bonusNumbers
                  : undefined
              }
              onComplete={handleRevealComplete}
              autoPlay
              delay={600}
            />
          </div>
        )}
      </div>
    </AnalysisCard>
  );
}
