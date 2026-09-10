import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, SelectField, request } from "../workspace/ui";
import { useSpotLocation } from "../spot-select";
import { distanceLabel, orderSpots } from "../../lib/spot-order.mjs";
import {
  dateKey,
  compass,
  finite,
  hourLabel,
  weatherLabel,
} from "../../lib/conditions/model.mjs";
import {
  filterSpots,
  meaningfulExperience,
  weatherIcon,
} from "../../lib/conditions/presentation.mjs";
import Icon from "../icon";
import { value } from "./shared";

export function useConditionsClock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  return now;
}

export function TileExperience({ level }) {
  const text = meaningfulExperience(level);
  return (
    <span className="tile-experience">
      {text && (
        <>
          <Icon name="surfing" />
          <span>{text}</span>
        </>
      )}
    </span>
  );
}
export function DirectionWeather({ condition: h, numeric = false }) {
  const icon = weatherIcon(h?.weatherCode);
  return (
    <span className="tile-directions">
      {[
        ["waves", "Swell", h?.swellDirection],
        ["wind", "Wind", h?.windDirection],
      ].map(([name, label, degrees]) => (
        <span
          key={name}
          className="tile-direction"
          title={
            finite(degrees)
              ? `${label} from ${Math.round(degrees)}° ${compass(degrees)}`
              : `${label} direction unavailable`
          }
        >
          <Icon name={name} />
          <span className="sr-only">{label}: </span>
          {finite(degrees) ? (
            <>
              <span
                className="tile-arrow"
                aria-hidden="true"
                style={{ transform: `rotate(${degrees + 180}deg)` }}
              >
                ↑
              </span>
              <span>
                {numeric ? `${Math.round(degrees)}°` : compass(degrees)}
              </span>
            </>
          ) : (
            <span>–</span>
          )}
        </span>
      ))}
      {icon && <Icon name={icon} label={weatherLabel(h?.weatherCode)} />}
    </span>
  );
}

// In-memory page cache only. Full forecast data remains on the server. At most
// three compact requests run together, and only the visible/browsed set is read.
function useSummaries(ids, at, refreshVersion) {
  const cache = useRef(new Map());
  const lastRefresh = useRef(refreshVersion);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") setTick((v) => v + 1);
    };
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  const [state, setState] = useState({ at: null, data: {} });
  const key = ids.join(",");
  useEffect(() => {
    if (!at || !key) return;
    const forceRefresh = refreshVersion !== lastRefresh.current;
    lastRefresh.current = refreshVersion;
    const controller = new AbortController();
    const queue = key.split(",");
    const data = {};
    for (const id of queue) {
      const stored = cache.current.get(`${id}:${at}`);
      if (
        stored &&
        Date.now() - stored.saved < (stored.data.stale ? 60000 : 5 * 60000) &&
        stored.version === refreshVersion
      )
        data[id] = stored.data;
    }
    setState((old) => ({
      at,
      data: { ...(old.at === at ? old.data : {}), ...data },
    }));
    const missing = queue.filter((id) => !data[id]);
    async function worker() {
      while (missing.length && !controller.signal.aborted) {
        const id = missing.shift();
        let result;
        try {
          result = await request(
            `/api/conditions/summary?spot=${encodeURIComponent(id)}&at=${at}${forceRefresh ? "&refresh=1" : ""}`,
            { signal: controller.signal },
          );
        } catch (e) {
          if (controller.signal.aborted) return;
          result = { condition: null, error: e.message };
        }
        if (controller.signal.aborted) return;
        if (!result.error)
          cache.current.set(`${id}:${at}`, {
            data: result,
            saved: Date.now(),
            version: refreshVersion,
          });
        // Bound the cache when people browse many days and regions.
        if (cache.current.size > 250)
          cache.current.delete(cache.current.keys().next().value);
        setState((old) => ({
          at,
          data: { ...(old.at === at ? old.data : {}), [id]: result },
        }));
      }
    }
    const timer = setTimeout(
      () =>
        Promise.all(
          Array.from({ length: Math.min(3, missing.length) }, worker),
        ),
      500,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, at, refreshVersion, tick]);
  return state.at === at ? state.data : {};
}

function SpotCard({ entry, summary, selected, onChoose }) {
  const { spot, distance } = entry;
  const h = summary?.condition;
  const quality = h?.quality || "Unavailable";
  return (
    <button
      type="button"
      className={`spot-card quality-tile ${summary?.stale ? "unknown" : h?.tone || "unknown"} ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      onClick={() => onChoose(spot)}
      data-spot-id={spot.id}
    >
      <strong className="spot-card-name">{spot.name}</strong>
      <span className="spot-card-location">
        {spot.region}
        {distance != null
          ? ` · ${distanceLabel(distance)}`
          : ` · ${spot.countryCode}`}
      </span>
      <span className="spot-card-condition">
        <Icon name="waves" />
        {!summary ? (
          "Loading…"
        ) : (
          <span>
            {quality}
            {finite(h?.surfMin)
              ? ` · ${value(h.surfMin)}–${value(h.surfMax)} m`
              : ""}
          </span>
        )}
      </span>
      {h && <DirectionWeather condition={h} />}
      {summary?.stale && (
        <small className="spot-stale">
          Previous forecast ·{" "}
          {summary.fetchedAt
            ? hourLabel(summary.fetchedAt, spot.timezone)
            : "update unavailable"}
        </small>
      )}
      {h && (
        <span className="sr-only">
          Conditions for {dateKey(summary.at, spot.timezone)} at{" "}
          {hourLabel(summary.at, spot.timezone)} in {spot.timezone}.
        </span>
      )}
      <TileExperience level={h?.level} />
    </button>
  );
}

export default function SpotBrowser({
  spots,
  selected,
  autoSelect,
  onChoose,
  catalogue,
  onCatalogue,
  now,
  refreshVersion = 0,
}) {
  const location = useSpotLocation();
  const strip = useRef(null);
  const initialDone = useRef(false);
  const [range, setRange] = useState({ start: 0, count: 4, end: false });
  const [filters, setFilters] = useState({
    search: "",
    region: "",
    distance: "",
    quality: "",
    level: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(24);
  const [revision, setRevision] = useState(0);
  const origin = location.order === "nearest" ? location.position : null;
  const entries = useMemo(() => orderSpots(spots, origin), [spots, origin]);
  const { initialise } = location;
  useEffect(() => initialise(), [initialise]);
  useEffect(() => {
    if (
      !initialDone.current &&
      autoSelect &&
      !location.pending &&
      (origin || location.order === "alphabetical") &&
      entries.length
    ) {
      initialDone.current = true;
      onChoose(entries[0].spot);
    }
  }, [autoSelect, location.order, location.pending, origin, entries, onChoose]);
  const choose = (spot) => {
    initialDone.current = true;
    onChoose(spot);
  };
  const zone =
    spots.find((s) => s.id === selected || s.slug === selected)?.timezone ||
    entries[0]?.spot.timezone ||
    "UTC";
  const at = now ? Math.floor(now / 60000) * 60000 : null;
  const distanceEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        distance:
          entry.distance ??
          orderSpots([entry.spot], location.position)[0].distance,
      })),
    [entries, location.position],
  );
  const scope = filterSpots(
    distanceEntries,
    {},
    { ...filters, quality: "", level: "" },
  );
  const displayed = catalogue
    ? scope.slice(0, limit)
    : entries.slice(range.start, range.start + range.count + 1);
  const summaries = useSummaries(
    displayed.map(({ spot }) => spot.id),
    at,
    refreshVersion + revision,
  );
  const matching = filterSpots(displayed, summaries, filters);
  const loading = displayed.some(({ spot }) => !summaries[spot.id]);
  const regions = [...new Set(spots.map((s) => s.region))].sort();
  const setFilter = (name, value) => {
    setFilters((f) => ({ ...f, [name]: value }));
    setLimit(24);
  };
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const update = () => {
      const card = el.firstElementChild;
      if (!card) return;
      const step = card.getBoundingClientRect().width + 12;
      setRange({
        start: Math.floor((el.scrollLeft + 2) / step),
        count: Math.ceil(el.clientWidth / step),
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [catalogue, entries.length]);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const card = [...el.children].find(
      (c) =>
        c.dataset.spotId ===
        spots.find((s) => s.id === selected || s.slug === selected)?.id,
    );
    if (card)
      el.scrollTo({
        left: card.offsetLeft - el.offsetLeft,
        behavior: "instant",
      });
  }, [selected, entries, spots, catalogue]);
  const advance = (direction) =>
    strip.current?.scrollBy({
      left: direction * strip.current.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  const sorting = (
    <div className="spot-sort" role="group" aria-label="Sort surf spots">
      <button
        type="button"
        aria-pressed={location.order === "nearest"}
        onClick={location.locate}
        disabled={location.pending}
      >
        Nearest to me
      </button>
      <button
        type="button"
        aria-pressed={location.order === "alphabetical"}
        onClick={location.alphabetically}
      >
        A–Z
      </button>
    </div>
  );
  return (
    <section
      className={`spot-browser ${catalogue ? "spot-catalogue" : ""}`}
      aria-label={catalogue ? "All surf spots" : "Compare surf spots"}
    >
      <div className="spot-browser-heading">
        <div>
          <h2>{catalogue ? "All spots" : "Surf spots"}</h2>
          <p className="spot-comparison-time">
            {at ? `Now · ${hourLabel(at, zone)} · ${zone}` : "Loading…"}
          </p>
        </div>
        <div className="actions">
          {!catalogue && (
            <div className="carousel-arrows">
              <Button
                aria-label="Previous spots"
                disabled={range.start === 0}
                onClick={() => advance(-1)}
              >
                <Icon name="chevron-right" className="icon-back" />
              </Button>
              <Button
                aria-label="Next spots"
                disabled={range.end}
                onClick={() => advance(1)}
              >
                <Icon name="chevron-right" />
              </Button>
            </div>
          )}
          <Button onClick={onCatalogue}>
            {catalogue ? "Back to forecast" : "All spots"}
          </Button>
        </div>
      </div>
      <div className="spot-browser-controls">{sorting}</div>
      {(location.pending || location.error) && (
        <p className="spot-location-status" role="status">
          {location.pending ? "Finding your location…" : location.error}
        </p>
      )}
      {catalogue ? (
        <>
          <div className="catalogue-search">
            <Field
              label="Search spots"
              type="search"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder="Spot, region or country"
            />
            <Button
              aria-expanded={filtersOpen}
              aria-controls="spot-filters"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              Filters
              {Object.entries(filters).filter(([k, v]) => k !== "search" && v)
                .length
                ? ` (${Object.entries(filters).filter(([k, v]) => k !== "search" && v).length})`
                : ""}
            </Button>
          </div>
          <div
            id="spot-filters"
            className={`catalogue-filters ${filtersOpen ? "open" : ""}`}
          >
            <SelectField
              label="Region"
              value={filters.region}
              onChange={(e) => setFilter("region", e.target.value)}
              options={[
                { value: "", label: "All regions" },
                ...regions.map((r) => ({ value: r, label: r })),
              ]}
            />
            <SelectField
              label="Distance"
              value={filters.distance}
              disabled={!location.position}
              onChange={(e) => setFilter("distance", e.target.value)}
              options={[
                {
                  value: "",
                  label: location.position
                    ? "Any distance"
                    : "Enable location first",
                },
                ...[5, 10, 25, 50, 100].map((n) => ({
                  value: String(n),
                  label: `Within ${n} km`,
                })),
              ]}
            />
            <SelectField
              label="Surf quality"
              value={filters.quality}
              onChange={(e) => setFilter("quality", e.target.value)}
              options={[
                { value: "", label: "Any quality" },
                { value: "good", label: "Good" },
                { value: "fair", label: "Fair" },
                { value: "poor", label: "Poor" },
                { value: "bad", label: "Unfavourable / too small" },
              ]}
            />
            <SelectField
              label="Required experience"
              value={filters.level}
              onChange={(e) => setFilter("level", e.target.value)}
              options={[
                { value: "", label: "Any experience" },
                ...["Beginner", "Intermediate", "Advanced"].map((l) => ({
                  value: l,
                  label: l,
                })),
              ]}
            />
            <Button
              tone="quiet"
              onClick={() =>
                setFilters({
                  search: "",
                  region: "",
                  distance: "",
                  quality: "",
                  level: "",
                })
              }
            >
              Clear filters
            </Button>
          </div>
          <div className="catalogue-status">
            <p role="status">
              {loading
                ? "Checking conditions…"
                : `${matching.length} spots${scope.length > limit ? ` in the first ${limit} checked` : ""}`}
            </p>
            <Button tone="quiet" onClick={() => setRevision((v) => v + 1)}>
              Refresh spots
            </Button>
          </div>
          <div className="spot-catalogue-grid">
            {matching.map((entry) => (
              <SpotCard
                key={entry.spot.id}
                entry={entry}
                summary={summaries[entry.spot.id]}
                selected={
                  entry.spot.id === selected || entry.spot.slug === selected
                }
                onChoose={choose}
              />
            ))}
          </div>
          {!matching.length && !loading && (
            <div className="surface padded">
              <h3>No spots match these filters</h3>
              <p>Try a wider area or fewer filters.</p>
              <Button
                onClick={() =>
                  setFilters({
                    search: "",
                    region: "",
                    distance: "",
                    quality: "",
                    level: "",
                  })
                }
              >
                Clear filters
              </Button>
            </div>
          )}
          {scope.length > limit && (
            <Button onClick={() => setLimit((v) => v + 24)}>
              Check the next {Math.min(24, scope.length - limit)} spots
            </Button>
          )}
        </>
      ) : (
        <div className="spot-carousel" ref={strip}>
          {entries.map((entry) => (
            <SpotCard
              key={entry.spot.id}
              entry={entry}
              summary={summaries[entry.spot.id]}
              selected={
                entry.spot.id === selected || entry.spot.slug === selected
              }
              onChoose={choose}
            />
          ))}
        </div>
      )}
    </section>
  );
}
