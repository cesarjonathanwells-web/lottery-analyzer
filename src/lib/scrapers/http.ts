import axios, { type AxiosResponse } from "axios";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
};

/**
 * Fetch a page (HTML string) with retry logic and user-agent spoofing.
 * Throws after exhausting retries.
 */
export async function fetchPage(
  url: string,
  retries = 2,
): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      const { data }: AxiosResponse<string> = await axios.get(url, {
        headers: HEADERS,
        timeout: 15_000,
        responseType: "text",
      });

      if (typeof data === "string" && data.trim().length === 0) {
        throw new Error(`Empty response body from ${url}`);
      }

      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 2_000 * (i + 1)));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

/**
 * Fetch JSON from a URL with retry logic (used for APIs like SODA).
 */
export async function fetchJson<T = unknown>(
  url: string,
  retries = 2,
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      const { data }: AxiosResponse<T> = await axios.get<T>(url, {
        headers: {
          ...HEADERS,
          Accept: "application/json",
        },
        timeout: 15_000,
      });

      return data;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 2_000 * (i + 1)));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch JSON from ${url}`);
}
