"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number; // 0-100
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeConfig = {
  sm: { svgSize: 48, strokeWidth: 3, radius: 18, fontSize: "text-xs" },
  md: { svgSize: 64, strokeWidth: 4, radius: 24, fontSize: "text-sm" },
  lg: { svgSize: 80, strokeWidth: 5, radius: 30, fontSize: "text-base" },
} as const;

function getScoreColor(score: number): string {
  if (score >= 90) return "#f5a623"; // gold
  if (score >= 70) return "#10b981"; // green
  if (score >= 50) return "#eab308"; // yellow
  return "#ef4444"; // red
}

export function ScoreRing({ score, size = "md", label }: ScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const progress = (animatedScore / 100) * circumference;
  const dashOffset = circumference - progress;
  const color = getScoreColor(score);

  useEffect(() => {
    // Animate from 0 to score
    const duration = 600;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedScore(Math.round(score * eased));
      if (t < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [score]);

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="relative" style={{ width: config.svgSize, height: config.svgSize }}>
        <svg
          width={config.svgSize}
          height={config.svgSize}
          viewBox={`0 0 ${config.svgSize} ${config.svgSize}`}
          className="rotate-[-90deg]"
        >
          {/* Background track */}
          <circle
            cx={config.svgSize / 2}
            cy={config.svgSize / 2}
            r={config.radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={config.strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={config.svgSize / 2}
            cy={config.svgSize / 2}
            r={config.radius}
            fill="none"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 0.1s ease-out",
              filter: `drop-shadow(0 0 4px ${color}40)`,
            }}
          />
        </svg>
        {/* Score number in center */}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-mono font-bold",
            config.fontSize,
          )}
          style={{ color }}
        >
          {animatedScore}
        </span>
      </div>
      {label && (
        <span className="text-[10px] text-[var(--muted-foreground)]">
          {label}
        </span>
      )}
    </div>
  );
}
