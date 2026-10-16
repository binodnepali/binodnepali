import { useEffect, useState } from "preact/hooks";

// Loads event count after paint so /calendar does not block on a full ICS scrape.
export default function FeedEventCount(
  { feedJsonUrl }: { feedJsonUrl: string },
) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(feedJsonUrl);
        if (!res.ok) return;
        const data = await res.json();
        const eventCount = data?.feed?.eventCount;
        if (!cancelled && typeof eventCount === "number") {
          setCount(eventCount);
        }
      } catch {
        /* leave placeholder */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [feedJsonUrl]);

  return (
    <dd class="text-lg font-semibold">
      {count == null ? "—" : count.toLocaleString("en-US")}
    </dd>
  );
}
