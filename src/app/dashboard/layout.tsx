"use client";

import { Sidebar, MobileSidebarTrigger } from "@/components/layout/sidebar";
import { useGameStore } from "@/lib/store";
import { getGameById } from "@/lib/games";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const activeGameId = useGameStore((s) => s.activeGameId);
  const game = getGameById(activeGameId);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--sidebar)] px-4">
          <MobileSidebarTrigger />

          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold tracking-tight text-[var(--gold)] lg:hidden">
              Lottery Analyzer
            </h1>
            <span className="hidden text-sm font-medium text-[var(--foreground)] lg:inline">
              {game?.name ?? "Select a game"}
            </span>
            {game && (
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: game.color }}
              />
            )}
          </div>

          {game && (
            <span className="ml-auto text-xs text-[var(--muted-foreground)]">
              {game.drawSchedule}
            </span>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
