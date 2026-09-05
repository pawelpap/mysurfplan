import { useEffect, useRef, useState } from "react";
import {
  Button,
  SelectField,
  Message,
  Loading,
  PageHeading,
  useData,
  isPlatform,
} from "../workspace/ui";
import {
  dateKey,
  hourLabel,
  weatherLabel,
  finite,
} from "../../lib/conditions/model.mjs";
import {
  useForecast,
  Score,
  Experience,
  Direction,
  ForecastFooter,
  TideReference,
  Metric,
  value,
} from "./shared";
import SpotForm from "./spot-form";
const dayLabel = (day, weekday = "short") =>
  new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday,
    day: "numeric",
    month: "short",
  });
export default function Conditions({ session, query, go }) {
  const spots = useData("/api/spots");
  const selected =
    spots.data.find((s) => s.id === query.spot || s.slug === query.spot) ||
    spots.data.find((s) => s.slug === "sao-pedro-bico") ||
    spots.data[0];
  const [notice, setNotice] = useState("");
  const admin = isPlatform(session.role);
  if (query.action === "new-spot" && admin)
    return (
      <SpotForm
        onCancel={() => go({ spot: selected?.slug })}
        onSaved={(spot) => {
          spots.reload();
          setNotice("Surf spot added.");
          go({ spot: spot.slug });
        }}
      />
    );
  if (spots.loading) return <Loading label="Loading surf spots…" />;
  if (spots.error)
    return (
      <>
        <Message>{spots.error}</Message>
        <Button onClick={spots.reload}>Try again</Button>
      </>
    );
  if (query.action === "edit-spot" && selected && admin)
    return (
      <SpotForm
        key={selected.id}
        spot={selected}
        onCancel={() => go({ spot: selected.slug })}
        onSaved={(spot) => {
          spots.reload();
          setNotice("Surf spot saved.");
          go({ spot: spot.slug });
        }}
      />
    );
  return (
    <>
      <PageHeading
        title="Conditions"
        description="Choose a spot, compare the next 16 days, then check the hours you plan to surf."
        action={
          admin && (
            <Button onClick={() => go({ action: "new-spot" })}>
              + Add spot
            </Button>
          )
        }
      />
      <Message success>{notice}</Message>
      <div className="forecast-controls">
        <SelectField
          label="Surf spot"
          value={selected?.slug || ""}
          onChange={(e) => {
            setNotice("");
            go({ spot: e.target.value });
          }}
          options={spots.data.map((s) => ({
            value: s.slug,
            label: `${s.name} · ${s.region}, ${s.countryCode}`,
          }))}
        />
        {admin && selected && (
          <Button
            onClick={() => go({ spot: selected.slug, action: "edit-spot" })}
          >
            Edit spot
          </Button>
        )}
      </div>
      {selected ? (
        <SpotForecast
          key={selected.id + ":" + selected.version}
          spot={selected}
          date={query.date}
          onDate={(date) => go({ spot: selected.slug, date })}
        />
      ) : (
        <p>No spots yet. A platform admin can add the first one.</p>
      )}
    </>
  );
}
function SpotForecast({ spot, date, onDate }) {
  const source = useForecast(
    "/api/conditions?spot=" + encodeURIComponent(spot.slug),
  );
  const [allHours, setAllHours] = useState(false);
  const d = source.data;
  if (source.loading)
    return <Loading label="Fetching waves, wind and tide predictions…" />;
  if (source.error && !d)
    return (
      <>
        <Message>{source.error}</Message>
        <Button onClick={source.reload}>Try again</Button>
      </>
    );
  if (!d) return null;
  const selected = d.dates.includes(date) ? date : d.dates[0];
  const hours = d.hours.filter(
    (h) => dateKey(h.time, spot.timezone) === selected,
  );
  const midday = (day) =>
    d.hours
      .filter((h) => dateKey(h.time, spot.timezone) === day)
      .find((h) => hourLabel(h.time, spot.timezone) === "12:00");
  const snapshot = midday(selected),
    daysAhead = d.dates.indexOf(selected);
  const daylight = hours.filter((h) => h.isDay === 1);
  const visible = allHours ? hours : daylight.length ? daylight : hours;
  return (
    <div className="forecast-screen">
      <div className="spot-intro">
        <div>
          <h2>{spot.name}</h2>
          <p>
            {spot.breakType} · {spot.region}, {spot.countryCode} ·{" "}
            {spot.timezone}
          </p>
        </div>
        <a
          href={`https://www.openstreetmap.org/?mlat=${spot.latitude}&mlon=${spot.longitude}#map=16/${spot.latitude}/${spot.longitude}`}
          target="_blank"
          rel="noreferrer"
        >
          View location ↗
        </a>
      </div>
      <div className="forecast-reading-note">
        <strong>Surf quality ≠ experience level.</strong> A green score can
        still require advanced skills. Scores are initial local estimates; an
        instructor must confirm conditions at the beach.
      </div>
      {source.error && <Message>{source.error}</Message>}
      {d.issues.map((issue) => (
        <div className="forecast-notice" key={issue}>
          {issue}
        </div>
      ))}
      <section aria-label="16-day outlook">
        <div className="section-heading">
          <div>
            <h2>16-day outlook</h2>
            <p>Midday snapshots. Select a day for hourly changes.</p>
          </div>
          <Button tone="quiet" onClick={source.reload}>
            Check for updates
          </Button>
        </div>
        <div className="outlook-grid">
          {d.dates.map((day, i) => {
            const h = midday(day);
            return (
              <button
                key={day}
                className={`outlook-day ${selected === day ? "selected" : ""}`}
                aria-pressed={selected === day}
                onClick={() => onDate(day)}
                aria-label={`${dayLabel(day)}, surf ${h?.quality || "unavailable"}, ${h?.level || "not assessed"}`}
              >
                <strong>
                  {i === 0
                    ? "Today"
                    : new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", {
                        timeZone: "UTC",
                        weekday: "short",
                      })}
                </strong>
                <small>
                  {new Date(day + "T12:00Z").toLocaleDateString("en-GB", {
                    timeZone: "UTC",
                    day: "numeric",
                    month: "short",
                  })}
                </small>
                <Score condition={h} compact />
                <span className="outlook-waves">
                  {finite(h?.surfMin)
                    ? `${value(h.surfMin)}–${value(h.surfMax)} m`
                    : "No wave data"}
                </span>
                <Experience level={h?.level} />
                {i >= 7 && <small>Long-range</small>}
              </button>
            );
          })}
        </div>
      </section>
      <section
        className="surface padded selected-forecast"
        aria-label="Selected day forecast"
      >
        <div className="section-heading">
          <div>
            <h2>{dayLabel(selected, "long")}</h2>
            <p>
              {daysAhead >= 7
                ? "Long-range outlook · low confidence. Recheck nearer the lesson."
                : daysAhead >= 3
                  ? "Medium-range outlook · conditions may change."
                  : "Near-term outlook · still confirm conditions locally."}
            </p>
          </div>
        </div>
        <div className="day-summary">
          <div>
            <small>Surf quality at 12:00</small>
            <Score condition={snapshot} />
          </div>
          <div>
            <small>Required experience at 12:00</small>
            <Experience level={snapshot?.level} />
          </div>
        </div>
        <dl className="condition-metrics">
          <Metric label="Estimated surf at 12:00" note="Initial local range">
            {finite(snapshot?.surfMin)
              ? `${value(snapshot.surfMin)}–${value(snapshot.surfMax)} m`
              : "Unavailable"}
          </Metric>
          <Metric
            label="Offshore swell at 12:00"
            note={
              finite(snapshot?.swellPeriod)
                ? `${value(snapshot.swellPeriod, " s")} period`
                : undefined
            }
          >
            {value(snapshot?.swellHeight, " m")}
            <Direction degrees={snapshot?.swellDirection} />
          </Metric>
          <Metric label="Wind at 12:00" note={snapshot?.windType}>
            {value(snapshot?.windSpeed, " km/h", 0)}
            <Direction degrees={snapshot?.windDirection} />
          </Metric>
          <Metric
            label="Weather at 12:00"
            note={weatherLabel(snapshot?.weatherCode)}
          >
            {value(snapshot?.temperature, " °C")}
            {finite(snapshot?.precipitation) && (
              <small>{value(snapshot.precipitation, "%", 0)} rain chance</small>
            )}
          </Metric>
        </dl>
        {snapshot && <p className="muted-note">{snapshot.reasons.join(" ")}</p>}
        <TideChart key={selected} data={d} day={selected} />
        <TideReference data={d} />
      </section>
      <section aria-label="Hourly conditions">
        <div className="section-heading">
          <div>
            <h2>Hourly conditions</h2>
            <p>
              Arrows show travel direction; degrees and compass labels show
              where wind or swell comes from.
            </p>
          </div>
          <Button onClick={() => setAllHours((v) => !v)}>
            {allHours ? "Daylight hours" : "All hours"}
          </Button>
        </div>
        {visible.length ? (
          <div className="surface forecast-table-wrap">
            <table className="forecast-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Quality / experience</th>
                  <th>Estimated surf</th>
                  <th>Offshore swell</th>
                  <th>Wind</th>
                  <th>Tide · MSL</th>
                  <th>Weather</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((h) => (
                  <tr key={h.time}>
                    <th scope="row">{hourLabel(h.time, spot.timezone)}</th>
                    <td>
                      <Score condition={h} compact />
                      <Experience level={h.level} />
                    </td>
                    <td data-label="Estimated surf">
                      {finite(h.surfMin)
                        ? `${value(h.surfMin)}–${value(h.surfMax)} m`
                        : "Unavailable"}
                    </td>
                    <td data-label="Offshore swell">
                      <strong>
                        {value(h.swellHeight, " m")} ·{" "}
                        {value(h.swellPeriod, " s")}
                      </strong>
                      <Direction degrees={h.swellDirection} />
                    </td>
                    <td data-label="Wind">
                      <strong>{value(h.windSpeed, " km/h", 0)}</strong>
                      <Direction degrees={h.windDirection} />
                      <small>
                        {h.windType}
                        {finite(h.windGusts)
                          ? ` · gusts ${Math.round(h.windGusts)}`
                          : ""}
                      </small>
                    </td>
                    <td data-label="Tide">
                      <strong>{value(h.tide?.height, " m", 2)}</strong>
                      <small>
                        {h.tide
                          ? `${h.tide.stage} · ${h.tide.trend}`
                          : "Unavailable"}
                      </small>
                    </td>
                    <td data-label="Weather">
                      <strong>{value(h.temperature, " °C")}</strong>
                      <small>{weatherLabel(h.weatherCode)}</small>
                      <small>
                        {finite(h.precipitation)
                          ? `${Math.round(h.precipitation)}% rain`
                          : ""}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="forecast-notice">
            Hourly wave and weather data is unavailable for this day. Tide
            predictions are shown above where available.
          </div>
        )}
      </section>
      <details className="surface padded spot-details">
        <summary>About this spot and the estimates</summary>
        <p>{spot.notes}</p>
        <p>
          The surf estimate adjusts offshore swell for direction, period and the
          spot’s exposure. The score also considers wind and preferred tide.
          Sandbanks, refraction, currents and breaking-wave shape are not
          resolved by this initial model. The displayed surf range is a
          heuristic range, not a statistical confidence interval.
        </p>
        <p>
          Experience labels consider estimated wave size, period, wind and break
          type. They do not certify safety. Local settings version{" "}
          {spot.version}; calibration is {spot.calibration.status}.
        </p>
        <ul>
          {spot.sources.map((s, i) => (
            <li key={i}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              ) : (
                s.title
              )}
              {s.note ? `: ${s.note}` : ""}
            </li>
          ))}
        </ul>
      </details>
      <ForecastFooter data={d} />
    </div>
  );
}
function TideChart({ data, day }) {
  const chart = useRef(null);
  const [width, setWidth] = useState(740);
  useEffect(() => {
    if (!chart.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(chart.current);
    return () => observer.disconnect();
  }, [day, data.tides.length]);
  const zone = data.spot.timezone;
  const points = data.tides.filter((p) => dateKey(p.time, zone) === day);
  const events = data.extremes.filter((p) => dateKey(p.time, zone) === day);
  const [index, setIndex] = useState(24);
  if (points.length < 2)
    return (
      <div className="forecast-notice">
        No tide curve is available for this day.
      </div>
    );
  const current = points[Math.min(index, points.length - 1)],
    lo = Math.floor(Math.min(...points.map((p) => p.height)) * 2) / 2 - 0.2,
    hi = Math.ceil(Math.max(...points.map((p) => p.height)) * 2) / 2 + 0.2;
  const x = (p) =>
      48 +
      ((p.time - points[0].time) / (points.at(-1).time - points[0].time)) *
        (width - 64),
    y = (p) => 170 - ((p.height - lo) / (hi - lo)) * 135;
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(p)},${y(p)}`)
    .join(" ");
  return (
    <div className="tide-chart" ref={chart}>
      <div className="section-heading">
        <div>
          <h3>Tide through the day</h3>
          <p>
            {hourLabel(current.time, zone)} ·{" "}
            {value(current.height, " m MSL", 2)}
          </p>
        </div>
        <span className="muted">Astronomical prediction</span>
      </div>
      <svg
        viewBox={`0 0 ${width} 210`}
        height="210"
        role="img"
        aria-label={`Tide curve for ${day}. ${events.map((e) => `${e.type} tide ${hourLabel(e.time, zone)}, ${e.height.toFixed(2)} metres relative to mean sea level`).join(". ")}`}
      >
        <title>Tide height relative to mean sea level</title>
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line
              x1="48"
              x2={width - 16}
              y1={y({ height: v })}
              y2={y({ height: v })}
              stroke="#dce6e8"
            />
            <text x="3" y={y({ height: v }) + 4} fill="#5d7077" fontSize="11">
              {v.toFixed(1)} m
            </text>
          </g>
        ))}
        <path d={`${line} L${width - 16},170 L48,170 Z`} fill="#e6f2f1" />
        <path d={line} fill="none" stroke="#096b75" strokeWidth="3" />
        {points
          .filter(
            (_, i) =>
              i % (width < 450 ? 24 : 12) === 0 || i === points.length - 1,
          )
          .map((p) => (
            <text
              key={p.time}
              x={x(p)}
              y="194"
              textAnchor={p === points.at(-1) ? "end" : "middle"}
              fill="#5d7077"
              fontSize="11"
            >
              {hourLabel(p.time, zone)}
            </text>
          ))}
        <line
          x1={x(current)}
          x2={x(current)}
          y1="24"
          y2="170"
          stroke="#efab43"
          strokeDasharray="4 4"
        />
        <circle
          cx={x(current)}
          cy={y(current)}
          r="5"
          fill="#096b75"
          stroke="white"
          strokeWidth="2"
        />
      </svg>
      <label className="tide-scrubber">
        Explore tide time
        <input
          type="range"
          min="0"
          max={points.length - 1}
          step="1"
          value={Math.min(index, points.length - 1)}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={`${hourLabel(current.time, zone)}, ${current.height.toFixed(2)} metres relative to mean sea level`}
        />
      </label>
      <div className="tide-events">
        {events.map((e) => (
          <div key={e.time}>
            <strong>{e.type} tide</strong>
            <span>
              {hourLabel(e.time, zone)} · {value(e.height, " m", 2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
