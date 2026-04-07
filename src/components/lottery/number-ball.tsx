"use client";

import { cn } from "@/lib/utils";

interface NumberBallProps {
  number: number;
  size?: "sm" | "md" | "lg";
  variant?:
    | "default"
    | "hot"
    | "cold"
    | "warm"
    | "bonus"
    | "selected"
    | "disabled";
  onClick?: () => void;
  showLabel?: boolean;
  label?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base font-semibold",
} as const;

const variantStyles = {
  default:
    "bg-[#1e293b] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.4)]",
  hot: "bg-gradient-to-br from-[#ef4444] to-[#dc2626] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_8px_rgba(239,68,68,0.4)]",
  cold: "bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_8px_rgba(59,130,246,0.4)]",
  warm: "bg-gradient-to-br from-[#f5a623] to-[#d97706] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_8px_rgba(245,166,35,0.4)]",
  bonus:
    "bg-[#0a0e1a] text-[var(--gold)] border-2 border-[var(--gold)] shadow-[0_0_12px_rgba(245,166,35,0.25)]",
  selected:
    "bg-[#1e293b] text-white ring-2 ring-[var(--electric-blue)] ring-offset-2 ring-offset-[#0a0e1a] shadow-[0_0_12px_rgba(59,130,246,0.3)]",
  disabled: "bg-[#1e293b]/40 text-white/30",
} as const;

export function NumberBall({
  number,
  size = "md",
  variant = "default",
  onClick,
  showLabel,
  label,
}: NumberBallProps) {
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={variant === "disabled"}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full font-mono tabular-nums transition-all duration-200 select-none",
          sizeMap[size],
          variantStyles[variant],
          onClick && variant !== "disabled"
            ? "cursor-pointer hover:scale-110 hover:brightness-110 active:scale-95"
            : "cursor-default",
        )}
      >
        {/* Radial highlight overlay */}
        <span
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full",
            variant !== "disabled" &&
              "bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.12)_0%,transparent_60%)]",
          )}
        />
        <span className="relative z-10">{number}</span>
      </button>
      {showLabel && label && (
        <span className="text-[10px] leading-none text-[var(--muted-foreground)]">
          {label}
        </span>
      )}
    </div>
  );
}
