import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-[var(--gold)]">
          Lottery Analyzer
        </h1>
        <p className="mt-3 text-lg text-[var(--muted-foreground)]">
          Premium statistical analysis, wheeling systems, and pattern detection
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg bg-[var(--gold)] px-8 py-3 text-lg font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--gold-dim)]"
      >
        Open Dashboard
      </Link>
    </div>
  );
}
