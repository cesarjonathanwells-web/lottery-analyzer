"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AnalysisCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}

export function AnalysisCard({
  title,
  subtitle,
  children,
  loading,
  className,
}: AnalysisCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-[var(--border)] bg-[var(--card)]",
        className,
      )}
    >
      {/* Gold accent bar */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[var(--gold)] via-[var(--gold-dim)] to-transparent" />

      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm font-semibold tracking-wide text-[var(--foreground)]">
          {title}
        </CardTitle>
        {subtitle && (
          <CardDescription className="text-xs text-[var(--muted-foreground)]">
            {subtitle}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-3/4 bg-[var(--secondary)]" />
            <Skeleton className="h-4 w-1/2 bg-[var(--secondary)]" />
            <Skeleton className="h-20 w-full bg-[var(--secondary)]" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
