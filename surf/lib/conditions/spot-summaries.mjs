import { dateKey, hourLabel } from "./model.mjs";

export const summaryTtl = 5 * 60000;
export const summaryBatchLimit = 24;

export function summaryTimeLabel(summary, spot, now) {
  if (!Number.isFinite(summary?.at)) return "";
  const day = dateKey(summary.at, spot.timezone);
  const today = dateKey(now, spot.timezone);
  const tomorrow = new Date(Date.parse(today + "T12:00Z") + 86400000)
    .toISOString().slice(0, 10);
  const date = day === today ? "Today" : day === tomorrow ? "Tomorrow"
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: spot.timezone }).format(summary.at);
  const time = hourLabel(summary.at, spot.timezone);
  if (summary.timing === "sunrise") return `${date} · Sunrise · ${time}`;
  if (summary.timing === "night") return `${date} · Night · ${time}`;
  return `${day === today && now - summary.at < summaryTtl ? "Now" : date} · ${time}`;
}

export function summaryContextLabel(entries, summaries, now) {
  const contexts = entries.map(({ spot }) => {
    const summary = summaries[spot.id];
    const label = summaryTimeLabel(summary, spot, now);
    if (!label) return null;
    const [day, time] = label.split(" · ");
    if (summary.timing === "sunrise") return `${day} at sunrise`;
    if (summary.timing === "night") return `${day} at night`;
    return day === "Now" ? "Now" : `${day} at ${time}`;
  }).filter(Boolean);
  // Distant regions may genuinely have different contexts. Keep their local
  // times on the cards rather than labelling every beach with one sunrise.
  return contexts.length ? [...new Set(contexts)].join(" · ") : "Loading…";
}

// One in-flight batch per browser. Scrolling changes the pending set without
// cancelling server work already started. Only unmount aborts a running fetch.
export function createSummaryCache({ fetchBatch, onChange, clock = Date.now }) {
  const cache = new Map();
  const forced = new Set();
  let wanted = [], version = null, timer, running = false, disposed = false;
  const controller = new AbortController();
  const fresh = (entry, now) => entry && entry.version === version && now < entry.expires;
  const publish = () => onChange(Object.fromEntries([...cache].map(([id, entry]) => [id, entry.data])));
  const missing = () => wanted.filter((id) => !fresh(cache.get(id), clock()));
  function schedule() {
    clearTimeout(timer);
    if (!running && !disposed && missing().length) timer = setTimeout(run, 500);
  }
  async function run() {
    if (disposed || running) return;
    const ids = missing().slice(0, summaryBatchLimit);
    if (!ids.length) return;
    running = true;
    const requestedVersion = version;
    const refresh = ids.filter((id) => forced.has(id));
    let results;
    try {
      results = await fetchBatch(ids, refresh, controller.signal);
    } catch {
      results = {};
    }
    if (disposed) return;
    const saved = clock();
    for (const id of ids) {
      const result = results[id] || { error: "Conditions are unavailable." };
      const old = cache.get(id)?.data;
      const data = result.error && old?.condition
        ? { ...old, stale: true, error: result.error } : result;
      const ttl = data.stale || data.error || !data.condition ? 60000 : summaryTtl;
      // A response can cross sunset in flight, or the device clock can be ahead.
      // Bound retries even when the server boundary is already in the local past.
      const boundary = !result.error && Number.isFinite(data.validUntil)
        ? (data.validUntil > saved ? data.validUntil : saved + 60000)
        : Infinity;
      cache.delete(id);
      cache.set(id, { data, saved, version: requestedVersion, expires: Math.min(saved + ttl, boundary) });
      if (requestedVersion === version) forced.delete(id);
    }
    while (cache.size > 250) cache.delete(cache.keys().next().value);
    running = false;
    publish();
    schedule();
  }
  return {
    update(ids, nextVersion) {
      wanted = [...new Set(ids)];
      if (version === null) version = nextVersion;
      if (nextVersion !== version) {
        version = nextVersion;
        forced.clear();
        wanted.forEach((id) => forced.add(id));
      }
      schedule();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    },
  };
}
