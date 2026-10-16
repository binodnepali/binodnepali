import Card from "./ui/Card.tsx";
import { Link } from "./ui/Link.tsx";
import CopyFeedUrl from "../islands/CopyFeedUrl.tsx";
import FeedEventCount from "../islands/FeedEventCount.tsx";
import {
  CalendarPageData,
  ICAL_FEED_PATH,
} from "../src/server/calendar/feedView.ts";

export default function CalendarFeed(
  { meta, links, years }: CalendarPageData,
) {
  const coverage = meta.hasNext
    ? `${meta.currentYear}–${meta.nextYear} BS`
    : `${meta.currentYear} BS`;
  const generated = new Date(meta.generatedAt).toUTCString();

  return (
    <div class="flex flex-col gap-6 w-full">
      <section>
        <h1 class="text-3xl font-bold text-teal-500">{meta.name}</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-300">
          Nepali calendar (Bikram Sambat) as a subscribable feed — festivals,
          tithis and panchanga for {coverage}.
        </p>
      </section>

      <Card>
        <div>
          <h2 class="text-xl font-semibold mb-2">Subscribe</h2>
          <p class="text-slate-600 dark:text-slate-300 mb-4">
            Add this URL to your calendar app — it rolls over at Nepali new
            year, so you never need to change it.
          </p>
          <div class="flex items-start gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <code class="flex-1 text-sm break-all font-mono">
              {links.subscribeUrl}
            </code>
            <CopyFeedUrl url={links.subscribeUrl} />
          </div>
          <div class="flex flex-wrap gap-3 mt-4">
            <a
              href={links.webcalUrl}
              class="inline-block px-4 py-2 rounded-lg bg-teal-500 text-white font-semibold hover:bg-teal-600"
            >
              Subscribe (webcal)
            </a>
            <a
              href={links.downloadUrl}
              class="inline-block px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 font-semibold hover:opacity-90"
            >
              Download .ics
            </a>
          </div>
          <ol class="mt-4 list-decimal list-inside space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <li>
              <strong>Google Calendar:</strong>{" "}
              Other calendars → From URL → paste the URL above.
            </li>
            <li>
              <strong>Apple Calendar:</strong>{" "}
              File → New Calendar Subscription → paste the URL.
            </li>
            <li>
              <strong>Outlook:</strong>{" "}
              Add calendar → Subscribe from web → paste the URL.
            </li>
          </ol>
        </div>
      </Card>

      <Card>
        <div>
          <h2 class="text-xl font-semibold mb-4">Feed details</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-500">
                Covers
              </dt>
              <dd class="text-lg font-semibold">{coverage}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-500">
                Events
              </dt>
              <FeedEventCount
                feedJsonUrl={`${links.subscribeUrl}?format=json`}
              />
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-500">
                Generated
              </dt>
              <dd class="text-lg font-semibold">{generated}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        <div>
          <h2 class="text-xl font-semibold mb-2">Download a single year</h2>
          <p class="text-slate-600 dark:text-slate-300 mb-4">
            Prefer a one-off file instead of a live subscription?
          </p>
          <ul class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {years.map((y) => (
              <li key={y.year}>
                <Link
                  href={y.url}
                  class="text-teal-500 hover:underline font-medium"
                >
                  {y.year} BS
                </Link>
                <span class="text-xs text-slate-500 ml-1">.ics</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <p class="text-sm text-slate-500 dark:text-slate-400">
        Data scraped from Hamro Patro ·{" "}
        <Link href={links.downloadUrl} class="underline">raw feed</Link> ·{" "}
        <Link href={`${links.subscribeUrl}?format=json`} class="underline">
          JSON
        </Link>{" "}
        · feed URL <code class="text-xs">{ICAL_FEED_PATH}</code>
      </p>
    </div>
  );
}
