const TIMEZONE = "America/New_York";

/** Today's date as YYYY-MM-DD in Eastern time. */
export function getToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** Current Date object adjusted to Eastern time. */
export function getNowEST(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: TIMEZONE }),
  );
}

/** Parse "H:MM AM/PM" into 24h hours + minutes. Returns null if invalid. */
export function parseDrawTime(
  timeStr: string,
): { hours: number; minutes: number } | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return { hours, minutes };
}

/** True if the given draw time has already passed today (Eastern). */
export function hasTimePassed(timeStr: string): boolean {
  const parsed = parseDrawTime(timeStr);
  if (!parsed) return true;
  const now = getNowEST();
  return (
    now.getHours() * 60 + now.getMinutes() >=
    parsed.hours * 60 + parsed.minutes
  );
}

/** True if dateStr equals today in Eastern time. */
export function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return dateStr === getToday();
}

/** True if dateStr is today or yesterday in Eastern time. */
export function isRecent(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  if (isToday(dateStr)) return true;
  const yesterday = new Date(getNowEST());
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    dateStr ===
    yesterday.toLocaleDateString("en-CA", { timeZone: "America/New_York" })
  );
}

/** Pad numbers to 2-digit strings. */
export function padNumbers(arr: string[]): string[] {
  return arr.map((n) => String(n).padStart(2, "0"));
}

/** Simple in-memory TTL cache. */
const cacheStore = new Map<string, { data: unknown; ts: number }>();

export async function cachedFetch<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const entry = cacheStore.get(key);
  if (entry && Date.now() - entry.ts < ttl) {
    return entry.data as T;
  }
  const data = await fetcher();
  cacheStore.set(key, { data, ts: Date.now() });
  return data;
}

/** Timestamped scraper log message. */
export function log(msg: string): void {
  const ts = new Date().toLocaleTimeString("en-US", { timeZone: TIMEZONE });
  console.log(`[Scraper ${ts}] ${msg}`);
}

/** True if today is Sunday in Eastern time. */
export function isSunday(): boolean {
  return getNowEST().getDay() === 0;
}
