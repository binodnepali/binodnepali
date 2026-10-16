// Orchestrates scraping, caching and ICS building for the calendar feeds.
// Ported from the Node/Express server, using Deno KV so scraped data persists
// across (ephemeral) Deno Deploy isolates, with a per-isolate in-memory
// fallback for runtimes where the (unstable) KV API is unavailable.

import { CalendarDay } from "../../types/CalendarDay.ts";
import { getCurrentBsYear, scrapeMonth } from "./scrape.ts";
import { buildCalendar } from "./buildIcs.ts";

const MONTHS_PER_YEAR = 12;
// Bound parallel Hamro Patro fetches so cold year scrapes finish faster
// without opening all 12 connections at once.
const MONTH_SCRAPE_CONCURRENCY = 6;

const DAYS_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// Re-check the current Nepali year a few times a day so the subscription
// endpoint rolls over automatically around Nepali new year (mid-April).
const CURRENT_YEAR_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export const MIN_YEAR = 1970;
export const MAX_YEAR = 2200;

// --- Logging ---------------------------------------------------------------
const LOG_PREFIX = "[calendar]";
function log(...args: unknown[]): void {
  console.log(LOG_PREFIX, ...args);
}
function warn(...args: unknown[]): void {
  console.warn(LOG_PREFIX, ...args);
}

// --- Cache layer -----------------------------------------------------------
// Prefer Deno KV (shared across isolates). If the runtime doesn't expose the
// KV API, transparently fall back to a per-isolate in-memory TTL store so the
// endpoints still work (just without cross-isolate persistence).

type CacheBackend = "kv" | "memory";
let cacheBackend: CacheBackend = "memory";

let kvPromise: Promise<Deno.Kv | null> | null = null;
function getKv(): Promise<Deno.Kv | null> {
  if (!kvPromise) {
    kvPromise = (async () => {
      if (typeof Deno.openKv !== "function") {
        cacheBackend = "memory";
        warn(
          "Deno KV API unavailable; using IN-MEMORY cache fallback " +
            "(per-isolate only, no cross-isolate persistence).",
        );
        return null;
      }
      try {
        const kv = await Deno.openKv();
        cacheBackend = "kv";
        log("Cache backend: Deno KV (persistent, shared across isolates).");
        return kv;
      } catch (err) {
        cacheBackend = "memory";
        warn(
          "Failed to open Deno KV; using IN-MEMORY cache fallback " +
            "(per-isolate only). Reason:",
          err instanceof Error ? err.message : err,
        );
        return null;
      }
    })();
  }
  return kvPromise;
}

const memCache = new Map<string, { value: unknown; expiresAt: number }>();

interface CacheResult<T> {
  value: T | null;
  hit: boolean;
}

async function cacheGet<T>(key: (string | number)[]): Promise<CacheResult<T>> {
  const kv = await getKv();
  if (kv) {
    const res = await kv.get<T>(key);
    return { value: res.value ?? null, hit: res.value != null };
  }
  const entry = memCache.get(JSON.stringify(key));
  if (entry && entry.expiresAt > Date.now()) {
    return { value: entry.value as T, hit: true };
  }
  return { value: null, hit: false };
}

async function cacheSet<T>(
  key: (string | number)[],
  value: T,
  ttlMs: number,
): Promise<void> {
  const kv = await getKv();
  if (kv) {
    try {
      await kv.set(key, value, { expireIn: ttlMs });
      log(`cache STORE ${JSON.stringify(key)} (kv)`);
    } catch (err) {
      // Never let a cache-write failure (e.g. an unexpectedly large value)
      // break the response; just serve the freshly scraped data.
      warn(`cache STORE FAILED ${JSON.stringify(key)} (kv):`, err);
    }
    return;
  }
  memCache.set(JSON.stringify(key), { value, expiresAt: Date.now() + ttlMs });
  log(`cache STORE ${JSON.stringify(key)} (memory)`);
}

// Dedupe concurrent scrapes for the same month within a single isolate.
const inFlight = new Map<string, Promise<CalendarDay[]>>();

// Caching is done per month rather than per year: a full year of days with
// panchanga text exceeds Deno KV's 64KB per-value limit, whereas a single
// month comfortably fits. Both the single-year and subscription feeds reuse
// the same per-month scrapes.
interface MonthResult {
  days: CalendarDay[];
  hit: boolean;
}

async function getDaysForMonth(
  year: number,
  month: number,
): Promise<MonthResult> {
  const key = ["calendar", "days", year, month];
  const label = `${year}/${month}`;

  const cached = await cacheGet<CalendarDay[]>(key);
  if (cached.hit && cached.value && cached.value.length > 0) {
    log(`days ${label}: HIT (${cacheBackend}, ${cached.value.length} days)`);
    return { days: cached.value, hit: true };
  }
  log(`days ${label}: MISS -> scraping`);

  const inFlightKey = `${year}-${month}`;
  const existing = inFlight.get(inFlightKey);
  if (existing) {
    log(`days ${label}: joining in-flight scrape`);
    return { days: await existing, hit: false };
  }

  const promise = (async () => {
    const start = Date.now();
    try {
      const days = await scrapeMonth(year, month);
      log(
        `days ${label}: scraped ${days.length} days in ${Date.now() - start}ms`,
      );
      // Only cache non-empty results so a transient/empty scrape is retried.
      if (days.length > 0) {
        await cacheSet(key, days, DAYS_TTL_MS);
      }
      return days;
    } finally {
      inFlight.delete(inFlightKey);
    }
  })();

  inFlight.set(inFlightKey, promise);
  return { days: await promise, hit: false };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function getDaysForYear(year: number): Promise<CalendarDay[]> {
  const start = Date.now();
  const months = Array.from({ length: MONTHS_PER_YEAR }, (_, i) => i + 1);

  const results = await mapPool(
    months,
    MONTH_SCRAPE_CONCURRENCY,
    (month) => getDaysForMonth(year, month),
  );

  const allDays: CalendarDay[] = [];
  let cachedMonths = 0;
  for (const { days, hit } of results) {
    if (hit) cachedMonths++;
    allDays.push(...days);
  }

  log(
    `year ${year}: ${allDays.length} days, ` +
      `${cachedMonths}/${MONTHS_PER_YEAR} months from cache, ` +
      `${Date.now() - start}ms`,
  );
  return allDays;
}

export async function getCurrentYear(): Promise<number> {
  const key = ["calendar", "currentYear"];

  const cached = await cacheGet<number>(key);
  if (cached.hit && cached.value) {
    log(`currentYear: HIT (${cacheBackend}, ${cached.value})`);
    return cached.value;
  }
  log("currentYear: MISS -> resolving from hamropatro");

  const year = await getCurrentBsYear();
  if (!year) {
    throw new Error("Could not determine the current Nepali year");
  }

  await cacheSet(key, year, CURRENT_YEAR_TTL_MS);
  return year;
}

export async function getIcsForYear(year: number): Promise<string> {
  const start = Date.now();
  const days = await getDaysForYear(year);
  const { ics, eventCount } = buildCalendar(`Nepali Patro ${year}`, days);

  if (eventCount === 0) {
    throw new Error(`No calendar data found for year ${year}`);
  }

  log(`ics ${year}: ${eventCount} events served in ${Date.now() - start}ms`);
  return ics;
}

export interface SubscriptionFeed {
  ics: string;
  currentYear: number;
  nextYear: number;
  hasNext: boolean;
  eventCount: number;
}

// Builds the stable subscription feed: the current Nepali year plus the next
// year so the calendar stays continuous across the new-year boundary. The next
// year is best-effort; if it isn't available yet we serve the current year only.
export async function getSubscriptionIcs(): Promise<SubscriptionFeed> {
  const start = Date.now();
  const currentYear = await getCurrentYear();
  const nextYear = currentYear + 1;

  const currentDays = await getDaysForYear(currentYear);

  let nextDays: CalendarDay[] = [];
  try {
    nextDays = await getDaysForYear(nextYear);
  } catch (err) {
    warn(
      `Next year ${nextYear} unavailable, serving ${currentYear} only:`,
      err instanceof Error ? err.message : err,
    );
  }

  const allDays = [...currentDays, ...nextDays];
  const { ics, eventCount } = buildCalendar("Nepali Patro", allDays);

  if (eventCount === 0) {
    throw new Error("No calendar data found for the current year");
  }

  log(
    `subscription: ${eventCount} events ` +
      `(${currentYear}${nextDays.length > 0 ? `+${nextYear}` : ""}) ` +
      `served in ${Date.now() - start}ms`,
  );
  return {
    ics,
    currentYear,
    nextYear,
    hasNext: nextDays.length > 0,
    eventCount,
  };
}
