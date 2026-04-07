"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GAME_GROUPS } from "@/lib/games";
import { useGameStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Dices,
  LayoutDashboard,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/analysis", label: "Analysis", icon: BarChart3 },
] as const;

// ── Sidebar Content ──────────────────────────────────────────────────────────

function SidebarContent() {
  const { activeGameId, setActiveGameId } = useGameStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  function toggle(label: string) {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <div className="flex h-full flex-col">
      {/* Branding */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <Dices className="h-5 w-5 text-[var(--gold)]" />
        <span className="text-base font-bold tracking-tight text-[var(--gold)]">
          Lottery Analyzer
        </span>
      </div>

      {/* Navigation links */}
      <nav className="flex flex-col gap-0.5 px-2 pb-3">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all",
                isActive
                  ? "bg-[var(--gold)]/10 text-[var(--gold)] font-medium"
                  : "text-[var(--muted-foreground)] hover:bg-white/[0.04] hover:text-[var(--foreground)]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-2 border-t border-[var(--border)]" />

      {/* Game list */}
      <ScrollArea className="flex-1 px-2">
        <nav className="flex flex-col gap-1 pb-4">
          {GAME_GROUPS.map((group) => {
            const isCollapsed = collapsed[group.label] ?? false;
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggle(group.label)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {group.label}
                </button>

                {!isCollapsed && (
                  <div className="ml-1 flex flex-col gap-0.5">
                    {group.games.map((game) => {
                      const isActive = game.id === activeGameId;
                      return (
                        <button
                          key={game.id}
                          type="button"
                          onClick={() => setActiveGameId(game.id)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-all",
                            isActive
                              ? "bg-[var(--gold)]/10 text-[var(--gold)] font-medium"
                              : "text-[var(--muted-foreground)] hover:bg-white/[0.04] hover:text-[var(--foreground)]",
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              isActive && "ring-2 ring-[var(--gold)]/30",
                            )}
                            style={{ backgroundColor: game.color }}
                          />
                          <span className="truncate">{game.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-[var(--border)] px-4 py-3">
        <p className="text-[10px] text-[var(--muted-foreground)]/60">
          Statistical analysis tool. Not gambling advice.
        </p>
      </div>
    </div>
  );
}

// ── Desktop Sidebar ──────────────────────────────────────────────────────────

export function Sidebar() {
  return (
    <aside className="hidden h-full w-60 shrink-0 border-r border-[var(--border)] bg-[var(--sidebar)] lg:flex lg:flex-col">
      <SidebarContent />
    </aside>
  );
}

// ── Mobile Sidebar (Sheet) ───────────────────────────────────────────────────

export function MobileSidebarTrigger() {
  const { sidebarOpen, setSidebarOpen } = useGameStore();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 bg-[var(--sidebar)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
