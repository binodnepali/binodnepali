// Scrapes Nepali calendar data (Bikram Sambat) from hamropatro.com.
// The site embeds month data in <script id="hp-bootstrap"> JSON (SSR), so we
// parse that payload with no JS execution — suitable for Deno Deploy.

import { CalendarDay } from "../../types/CalendarDay.ts";

const MONTHS_PER_YEAR = 12;
const BASE_URL = "https://www.hamropatro.com/calendar";
// A browser-like UA avoids being served a stripped-down/blocked response.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const AD_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

interface BootstrapDay {
  year_ad: number;
  month_ad: number;
  day_ad: number;
  year_bs: number;
  month_bs: number;
  day_bs: number;
  dayOfWeek: number;
  inMonth: boolean;
  dayBsNp: string;
  tithiShort?: string;
  patroEvent?: { titleNp?: string; titleEn?: string } | null;
}

interface BootstrapMonth {
  yearBs: number;
  monthBs: number;
  monthNameNp: string;
  monthNameEn: string;
  yearBsNp: string;
  daysInMonth: number;
  weekdayHeaders: { np: string; en: string }[];
  days: BootstrapDay[];
}

interface BootstrapPayload {
  page?: string;
  today?: { year_bs?: number };
  data?: {
    calendar?: {
      initialMonths?: BootstrapMonth[];
    };
  };
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

// Extract the bootstrap JSON without parsing the full ~1.5MB document tree.
const BOOTSTRAP_RE = /<script id="hp-bootstrap"[^>]*>([\s\S]*?)<\/script>/;

function extractBootstrap(html: string): BootstrapPayload | null {
  const match = html.match(BOOTSTRAP_RE);
  const raw = match?.[1]?.trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as BootstrapPayload;
  } catch {
    return null;
  }
}

function formatAdFullDate(
  yearAd: number,
  monthAd: number,
  dayAd: number,
): string {
  const monthName = AD_MONTH_NAMES[monthAd - 1];
  if (!monthName) return "";
  return `${monthName} ${dayAd}, ${yearAd}`;
}

function mapDay(
  day: BootstrapDay,
  month: BootstrapMonth,
): CalendarDay | null {
  if (!day.inMonth) return null;

  const weekday = month.weekdayHeaders[day.dayOfWeek]?.np ?? "";
  const bsFullDate = [
    day.dayBsNp,
    month.monthNameNp,
    month.yearBsNp,
  ].filter(Boolean).join(" ") + (weekday ? `, ${weekday}` : "");

  const event = day.patroEvent?.titleNp?.trim() ?? "";

  return {
    bsDay: day.dayBsNp,
    bsFullDate,
    adFullDate: formatAdFullDate(day.year_ad, day.month_ad, day.day_ad),
    tithi: day.tithiShort?.trim() ?? "",
    panchanga: "",
    event,
  };
}

function parseMonthDays(
  html: string,
  year: number,
  month: number,
): CalendarDay[] {
  const payload = extractBootstrap(html);
  const months = payload?.data?.calendar?.initialMonths ?? [];
  const target = months.find((m) => m.yearBs === year && m.monthBs === month);
  if (!target) return [];

  const days: CalendarDay[] = [];
  for (const day of target.days) {
    const mapped = mapDay(day, target);
    if (mapped) days.push(mapped);
  }
  return days;
}

export async function scrapeMonth(
  year: number,
  month: number,
): Promise<CalendarDay[]> {
  const html = await fetchHtml(`${BASE_URL}/${year}/${month}`);
  return parseMonthDays(html, year, month);
}

export async function scrapeYear(year: number): Promise<CalendarDay[]> {
  const allDays: CalendarDay[] = [];

  // Sequential month-by-month scraping for reliability over speed.
  for (let month = 1; month <= MONTHS_PER_YEAR; month++) {
    const monthData = await scrapeMonth(year, month);
    allDays.push(...monthData);
  }

  return allDays;
}

// Resolves the current Bikram Sambat year from hamropatro's bootstrap payload
// (`today.year_bs`). Used by the stable subscription endpoint so users never
// have to pass a year.
export async function getCurrentBsYear(): Promise<number | null> {
  const html = await fetchHtml(BASE_URL);
  const payload = extractBootstrap(html);
  const year = payload?.today?.year_bs;
  return typeof year === "number" && year > 0 ? year : null;
}
