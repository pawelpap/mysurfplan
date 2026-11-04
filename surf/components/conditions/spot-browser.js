import { useLocale } from "../locale";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, SelectField, request } from "../workspace/ui";
import { useSpotLocation } from "../spot-select";
import { distanceLabel, orderSpots } from "../../lib/spot-order.mjs";
import {
  finite,
  hourLabel,
  weatherLabel,
} from "../../lib/conditions/model.mjs";
import {
  filterSpots,
  meaningfulExperience,
  weatherIcon,
} from "../../lib/conditions/presentation.mjs";
import { createSummaryCache, summaryContextLabel, summaryTimeLabel } from "../../lib/conditions/spot-summaries.mjs";
import Icon from "../icon";
import { localCompass, useForecastDisplay } from "./shared";

export function useConditionsClock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    update();
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}

export function TileExperience({ level }) {
  const { t } = useLocale();
  const text = meaningfulExperience(level);
  return (
    <span className="tile-experience">
      {text && (
        <>
          <Icon name="surfing" />
          <span>{t(text)}</span>
        </>
      )}
    </span>
  );
}
export function TileWeather({ condition }) {
  const { t } = useLocale();
  const icon = weatherIcon(condition?.weatherCode);
  return icon ? <span className="tile-weather"><Icon name={icon} label={t(weatherLabel(condition?.weatherCode))} /></span> : null;
}

export function TileDirections({ condition: h }) {
  const { locale, t, value } = useForecastDisplay();
  const energy = h?.energy;
  const partial = finite(energy?.energyKjM2) && !energy.complete;
  return (
    <span className="tile-directions">
      {[
        ["waves", "Swell", h?.swellDirection, value(energy?.energyKjM2, " kJ/m²"), "tile-swell-energy", partial ? "Offshore swell energy (partial)" : "Offshore swell energy"],
        ["wind", "Wind", h?.windDirection, value(h?.windSpeed, " km/h", 0), "tile-wind-speed", "Wind speed"],
      ].map(([name, label, degrees, measure, className, measureLabel]) => (
        <span key={name} className="tile-direction">
          <Icon name={name} />
          <span className="sr-only">{t("{1} from ", { 1: t(label) })}</span>
          <span
            className="tile-arrow"
            aria-hidden="true"
            style={finite(degrees) ? { transform: `rotate(${degrees + 180}deg)` } : undefined}
          >
            {finite(degrees) ? "↑" : "–"}
          </span>
          <span className="tile-bearing">
            {finite(degrees) ? `${Math.round(degrees)}° ${localCompass(degrees, locale)}` : "–"}
          </span>
          <span className={`tile-inline-measure ${className}`} title={t(measureLabel)}>
            <span className="sr-only">{`${t(measureLabel)}: `}</span>
            <span>{`${measure}${name === "waves" && partial ? "*" : ""}`}</span>
          </span>
        </span>
      ))}
      {partial && <span className="tile-data-note">{t("* Partial energy")}</span>}
    </span>
  );
}

// Keep loaded cards visible while the shared cache revalidates in batches.
function useSummaries(ids, now, refreshVersion, day) {
  const cache = useRef(null);
  const [data, setData] = useState({ day: null, values: {} });
  useEffect(() => {
    const store = createSummaryCache({
      onChange: (values, scope) => setData({ day: scope, values }),
      fetchBatch: (spots, refresh, signal, scope) => {
        const query = new URLSearchParams({ spots: spots.join(","), day: scope });
        if (refresh.length) query.set("refresh", refresh.join(","));
        return request(`/api/conditions/summaries?${query}`, { signal });
      },
    });
    cache.current = store;
    return () => store.dispose();
  }, []);
  const key = ids.join(",");
  useEffect(() => {
    const update = () => {
      if (now && day) cache.current?.update(
        document.visibilityState === "visible" && key ? key.split(",") : [],
        refreshVersion,
        day,
      );
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [key, now, refreshVersion, day]);
  return data.day === day ? data.values : {};
}

function SpotCard({ entry, summary, selected, onChoose, now }) {
  const { locale, t, value } = useForecastDisplay();
  const { spot, distance } = entry;
  const h = summary?.condition;
  const quality = h?.quality || "Unavailable";
  return (
    <button
      type="button"
      className={`spot-card quality-tile ${summary?.stale ? "unknown" : h?.tone || "unknown"} ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      onClick={() => onChoose(spot, summary)}
      data-spot-id={spot.id}
    >
      <span className="spot-card-heading">
        <strong className="spot-card-name">{spot.name}</strong>
        <TileWeather condition={h} />
      </span>
      <span className="spot-card-location">
        {`${spot.region} · ${distance != null ? distanceLabel(distance, locale) : spot.countryCode}`}
      </span>
      <span className="spot-card-time" title={spot.timezone}>
        {summaryTimeLabel(summary, spot, now, { locale, t })}
      </span>
      <span className="spot-card-condition">
        <Icon name="waves" />
        {!summary ? (
          // A translator may replace text nodes. Keep the loading text inside
          // a React-owned element so the async update never removes that text.
          <span>{t("Loading…")}</span>
        ) : (
          <span>
            <span>{t(quality)}</span>
            {finite(h?.surfMin) && (
              <>
                <span className="spot-card-separator"> · </span>
                <span className="spot-card-surf">
                  {`${value(h.surfMin)}–${value(h.surfMax)} m`}
                </span>
              </>
            )}
          </span>
        )}
      </span>
      {h && <TileDirections condition={h} />}
      {summary?.stale && (
        <small className="spot-stale">
          {t("Previous forecast · {1}", { 1: summary.fetchedAt ? hourLabel(summary.fetchedAt, spot.timezone) : t("update unavailable") })}
        </small>
      )}
      {h && (
        <span className="sr-only">
          {t("Best daylight window for {1}: {2}. Colour and values at the window’s weakest hour: {3} in {4}.", { 1: summary.day, 2: summary.window?.label, 3: hourLabel(summary.at, spot.timezone), 4: spot.timezone })}
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
  day,
  refreshVersion = 0,
}) {
  const { locale, t } = useLocale();
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
  const choose = (spot, summary) => {
    initialDone.current = true;
    onChoose(spot, summary);
  };
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
    now,
    refreshVersion + revision,
    day,
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
    <div className="spot-sort" role="group" aria-label={t("Sort surf spots")}>
      <button
        type="button"
        aria-pressed={location.order === "nearest"}
        onClick={location.locate}
        disabled={location.pending}
      >{t("Nearest to me")}</button>
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
      aria-label={catalogue ? t("All surf spots") : t("Compare surf spots")}
    >
      <div className="spot-browser-heading">
        <div>
          <h2>{catalogue ? t("All spots") : t("Surf spots")}</h2>
          <p className="spot-comparison-time">
            {t("{1} · Local times", { 1: summaryContextLabel(displayed, summaries, now, day, { locale, t }) })}
          </p>
        </div>
        <div className="actions">
          {!catalogue && (
            <div className="carousel-arrows">
              <Button
                aria-label={t("Previous spots")}
                disabled={range.start === 0}
                onClick={() => advance(-1)}
              >
                <Icon name="chevron-right" className="icon-back" />
              </Button>
              <Button
                aria-label={t("Next spots")}
                disabled={range.end}
                onClick={() => advance(1)}
              >
                <Icon name="chevron-right" />
              </Button>
            </div>
          )}
          <Button onClick={onCatalogue}>
            {catalogue ? t("Back to forecast") : t("All spots")}
          </Button>
        </div>
      </div>
      <div className="spot-browser-controls">{sorting}</div>
      {(location.pending || location.error) && (
        <p className="spot-location-status" role="status">
          {location.pending ? t("Finding your location…") : t(location.error)}
        </p>
      )}
      {catalogue ? (
        <>
          <div className="catalogue-search">
            <Field
              label={t("Search spots")}
              type="search"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder={t("Spot, region or country")}
            />
            <Button
              aria-expanded={filtersOpen}
              aria-controls="spot-filters"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              {t("Filters{1}", { 1: Object.entries(filters).filter(([k, v]) => k !== "search" && v)
                .length
                ? ` (${Object.entries(filters).filter(([k, v]) => k !== "search" && v).length})`
                : "" })}
            </Button>
          </div>
          <div
            id="spot-filters"
            className={`catalogue-filters ${filtersOpen ? "open" : ""}`}
          >
            <SelectField
              label={t("Region")}
              value={filters.region}
              onChange={(e) => setFilter("region", e.target.value)}
              options={[
                { value: "", label: t("All regions") },
                ...regions.map((r) => ({ value: r, label: r })),
              ]}
            />
            <SelectField
              label={t("Distance")}
              value={filters.distance}
              disabled={!location.position}
              onChange={(e) => setFilter("distance", e.target.value)}
              options={[
                {
                  value: "",
                  label: location.position
                    ? t("Any distance")
                    : t("Enable location first"),
                },
                ...[5, 10, 25, 50, 100].map((n) => ({
                  value: String(n),
                  label: t("Within {1} km", { 1: n }),
                })),
              ]}
            />
            <SelectField
              label={t("Surf quality")}
              value={filters.quality}
              onChange={(e) => setFilter("quality", e.target.value)}
              options={[
                { value: "", label: t("Any quality") },
                { value: "good", label: t("Good") },
                { value: "fair", label: t("Fair") },
                { value: "poor", label: t("Poor") },
                { value: "bad", label: t("Unfavourable / too small") },
              ]}
            />
            <SelectField
              label={t("Required experience")}
              value={filters.level}
              onChange={(e) => setFilter("level", e.target.value)}
              options={[
                { value: "", label: t("Any experience") },
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
            >{t("Clear filters")}</Button>
          </div>
          <div className="catalogue-status">
            <p role="status">
              {loading
                ? t("Checking conditions…")
                : t("{1} spots{2}", { 1: matching.length, 2: scope.length > limit ? t(" in the first {1} checked", { 1: limit }) : "" })}
            </p>
            <Button tone="quiet" onClick={() => setRevision((v) => v + 1)}>{t("Refresh spots")}</Button>
          </div>
          <div className="spot-catalogue-grid">
            {matching.map((entry) => (
              <SpotCard
                key={entry.spot.id}
                entry={entry}
                now={now}
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
              <h3>{t("No spots match these filters")}</h3>
              <p>{t("Try a wider area or fewer filters.")}</p>
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
              >{t("Clear filters")}</Button>
            </div>
          )}
          {scope.length > limit && (
            <Button onClick={() => setLimit((v) => v + 24)}>
                {t("Check the next {1} spots", { 1: Math.min(24, scope.length - limit) })}
            </Button>
          )}
        </>
      ) : (
        <div className="spot-carousel" ref={strip}>
          {entries.map((entry) => (
            <SpotCard
              key={entry.spot.id}
              entry={entry}
              now={now}
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
