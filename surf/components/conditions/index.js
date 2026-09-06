import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Message,
  Loading,
  PageHeading,
  useData,
} from "../workspace/ui";
import {
  dateKey,
  hourLabel,
  weatherLabel,
  finite,
  forecastViewingHours,
  interpolateHour,
  scoreConditions,
  tideAt,
} from "../../lib/conditions/model.mjs";
import {
  useForecast,
  Score,
  Experience,
  experienceLabel,
  Direction,
  SwellDetails,
  SwellComponents,
  OceanMetrics,
  AssessmentMetrics,
  OceanMetricsHelp,
  ForecastFooter,
  Metric,
  value,
} from "./shared";
import SpotForm from "./spot-form";
import SpotSelect from "../spot-select";
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
    spots.data[0];
  const [notice, setNotice] = useState("");
  const admin = session.role === "platform_admin";
  if (["new-spot", "edit-spot"].includes(query.action) && !admin)
    return (
      <>
        <PageHeading title="Spot settings" />
        <Message>Spot settings are available only to platform admins.</Message>
        <Button onClick={() => go({ spot: selected?.slug })}>
          Back to Conditions
        </Button>
      </>
    );
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
        <SpotSelect
          spots={spots.data}
          valueKey="slug"
          value={selected?.slug || ""}
          onChange={(e) => {
            setNotice("");
            go({ spot: e.target.value });
          }}
        />
        {admin && selected && (
          <Button
            onClick={() => go({ spot: selected.slug, action: "edit-spot" })}
          >
            Spot settings
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
  const [chosen, setChosen] = useState({ day: null, time: null });
  const d = source.data;
  const dailyHours = useMemo(() => {
    const grouped = new Map();
    for (const h of d?.hours || []) {
      const day = dateKey(h.time, spot.timezone);
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day).push(h);
    }
    return grouped;
  }, [d, spot.timezone]);
  if (source.loading) return <Loading label="Loading forecast…" />;
  if (source.error && !d)
    return (
      <>
        <Message>{source.error}</Message>
        <Button onClick={source.reload}>Try again</Button>
      </>
    );
  if (!d) return null;
  const selected = d.dates.includes(date) ? date : d.dates[0];
  const hours = dailyHours.get(selected) || [];
  const midday = (day) =>
    (dailyHours.get(day) || []).find(
      (h) => hourLabel(h.time, spot.timezone) === "12:00",
    );
  const selectedTime =
    chosen.day === selected ? chosen.time : midday(selected)?.time;
  const raw = finite(selectedTime)
    ? interpolateHour(d.hours, selectedTime)
    : null;
  const atTime = raw
    ? { ...raw, tide: tideAt(d.tides, selectedTime, d.spot.calibration) }
    : null;
  const snapshot = atTime
    ? { ...atTime, ...scoreConditions(atTime, d.spot.calibration) }
    : null;
  const selectedLabel = finite(selectedTime)
    ? hourLabel(selectedTime, spot.timezone)
    : "12:00";
  const daysAhead = d.dates.indexOf(selected);
  const chooseTime = (time) => setChosen({ day: selected, time });
  const sunlight = d.sunlight?.find((day) => day.day === selected);
  const visible = forecastViewingHours(
    hours,
    spot.timezone,
    sunlight,
    allHours,
  );
  return (
    <div className="forecast-screen">
      <div className="spot-context">
        <p>
          {spot.breakType} · {spot.region}, {spot.countryCode} · Times in{" "}
          {spot.timezone}
        </p>
        <a
          href={`https://www.openstreetmap.org/?mlat=${spot.latitude}&mlon=${spot.longitude}#map=16/${spot.latitude}/${spot.longitude}`}
          target="_blank"
          rel="noreferrer"
        >
          View map ↗
        </a>
      </div>
      {source.error && <Message>{source.error}</Message>}
      {d.issues.map((issue) => (
        <div className="forecast-notice" key={issue}>
          {issue}
        </div>
      ))}
      <section aria-label="16-day outlook">
        <div className="section-heading outlook-heading">
          <div>
            <h2>16-day forecast</h2>
            <p>Daily snapshot at 12:00</p>
          </div>
          <div className="forecast-update">
            <ForecastFooter data={d} />
            <Button
              onClick={source.reload}
              disabled={source.refreshing}
              aria-busy={source.refreshing}
            >
              {source.refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
        <div className="outlook-grid">
          {d.dates.map((day, i) => {
            const h = midday(day);
            return (
              <button
                key={day}
                className={`outlook-day ${h?.tone || "unknown"} ${selected === day ? "selected" : ""}`}
                aria-pressed={selected === day}
                onClick={() => onDate(day)}
                aria-label={`${dayLabel(day)}, surf ${h?.quality || "unavailable"}, ${experienceLabel(h?.level)}`}
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
                    : "Surf estimate unavailable"}
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
            <p className="selected-conditions-time">
              Conditions at {selectedLabel}
            </p>
            {daysAhead >= 3 && (
              <p>
                {daysAhead >= 7
                  ? "Long-range · low confidence"
                  : daysAhead >= 3
                    ? "Outlook may change"
                    : ""}
              </p>
            )}
          </div>
        </div>
        <TideChart
          key={selected}
          data={d}
          day={selected}
          selectedTime={selectedTime}
          onTimeChange={chooseTime}
        />
        <dl className="condition-metrics">
          <AssessmentMetrics condition={snapshot} />
          <Metric label="Estimated surf">
            {finite(snapshot?.surfMin)
              ? `${value(snapshot.surfMin)}–${value(snapshot.surfMax)} m`
              : "Unavailable"}
          </Metric>
          <Metric
            label="Primary swell"
            note={
              finite(snapshot?.swellPeriod)
                ? `${value(snapshot.swellPeriod, " s")} period`
                : undefined
            }
          >
            {value(snapshot?.swellHeight, " m")}
            {snapshot?.swellHeight > 0 && (
              <Direction degrees={snapshot.swellDirection} />
            )}
          </Metric>
          <Metric label="Wind" note={snapshot?.windType}>
            {value(snapshot?.windSpeed, " km/h", 0)}
            <Direction degrees={snapshot?.windDirection} />
            {finite(snapshot?.windGusts) && (
              <small>Gusts {value(snapshot.windGusts, " km/h", 0)}</small>
            )}
          </Metric>
          <Metric label="Weather" note={weatherLabel(snapshot?.weatherCode)}>
            {value(snapshot?.temperature, " °C")}
            {finite(snapshot?.precipitation) && (
              <small>{value(snapshot.precipitation, "%", 0)} rain chance</small>
            )}
          </Metric>
          <OceanMetrics condition={snapshot} />
        </dl>
        {snapshot && <p className="muted-note">{snapshot.reasons.join(" ")}</p>}
        <div className="forecast-extras">
          <SwellDetails condition={snapshot} />
          <OceanMetricsHelp />
        </div>
      </section>
      <section aria-label="Hourly conditions">
        <div className="section-heading">
          <div>
            <h2>Hourly conditions</h2>
            <p>
              {dayLabel(selected)} ·{" "}
              {allHours ? "24 hours" : "06:00 to evening"}
            </p>
          </div>
          <Button onClick={() => setAllHours((v) => !v)}>
            {allHours ? "Daytime hours" : "All hours"}
          </Button>
        </div>
        {visible.length ? (
          <>
            <MobileHours
              hours={visible}
              timezone={spot.timezone}
              onSelect={chooseTime}
            />
            <DesktopHours
              hours={visible}
              timezone={spot.timezone}
              onSelect={chooseTime}
              selectedTime={selectedTime}
            />
          </>
        ) : (
          <div className="forecast-notice">
            Hourly wave and weather data is unavailable for this day. Tide
            predictions are shown above where available.
          </div>
        )}
      </section>
    </div>
  );
}
function MobileHours({ hours, timezone, onSelect }) {
  return (
    <div className="mobile-hours">
      {hours.map((h) => (
        <details
          className="hour-card"
          key={h.time}
          onToggle={(e) => {
            if (e.target === e.currentTarget && e.currentTarget.open)
              onSelect(h.time);
          }}
        >
          <summary>
            <div className="hour-card-top">
              <time dateTime={new Date(h.time).toISOString()}>
                {hourLabel(h.time, timezone)}
              </time>
              <div className="hour-card-surf">
                <small>Estimated surf</small>
                <strong>
                  {finite(h.surfMin)
                    ? `${value(h.surfMin)}–${value(h.surfMax)} m`
                    : "Unavailable"}
                </strong>
              </div>
              <div className="hour-card-quality">
                <small>Surf quality</small>
                <Score condition={h} compact />
              </div>
            </div>
            <div className="hour-card-level">
              <span>Experience</span>
              <Experience level={h.level} />
            </div>
            <div className="hour-card-glance">
              <span>Wind {value(h.windSpeed, " km/h", 0)}</span>
              <span>
                Tide{" "}
                {h.tide
                  ? `${h.tide.stage.toLowerCase()} · ${value(h.tide.height, " m")}`
                  : "unavailable"}
              </span>
              <span className="hour-expand" aria-hidden="true">
                ⌄
              </span>
            </div>
          </summary>
          <HourlyDetails condition={h} />
        </details>
      ))}
    </div>
  );
}
function DesktopHours({ hours, timezone, onSelect, selectedTime }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="surface forecast-table-wrap">
      <table className="forecast-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Quality / experience</th>
            <th>Estimated surf</th>
            <th>Primary swell</th>
            <th>Wind</th>
            <th>Tide · MSL</th>
            <th>Weather</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <Fragment key={h.time}>
              <tr
                className={
                  selectedTime === h.time ? "selected-hour" : undefined
                }
              >
                <th scope="row">
                  <button
                    className="forecast-hour-button"
                    onClick={() => {
                      setExpanded(expanded === h.time ? null : h.time);
                      if (expanded !== h.time) onSelect(h.time);
                    }}
                    aria-expanded={expanded === h.time}
                    aria-controls={`hour-details-${h.time}`}
                    aria-label={`Details for ${hourLabel(h.time, timezone)}`}
                  >
                    {hourLabel(h.time, timezone)}
                    <svg
                      className="hour-chevron"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                    >
                      <path d="m4 6 4 4 4-4" />
                    </svg>
                  </button>
                </th>
                <td>
                  <Score condition={h} compact />
                  <Experience level={h.level} />
                </td>
                <td data-label="Estimated surf">
                  {finite(h.surfMin)
                    ? `${value(h.surfMin)}–${value(h.surfMax)} m`
                    : "Unavailable"}
                </td>
                <td data-label="Primary swell">
                  <strong>
                    {value(h.swellHeight, " m")} · {value(h.swellPeriod, " s")}
                  </strong>
                  {h.swellHeight > 0 && (
                    <Direction degrees={h.swellDirection} />
                  )}
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
              <tr
                id={`hour-details-${h.time}`}
                className="forecast-detail-row"
                hidden={expanded !== h.time}
              >
                <td colSpan={7}>
                  {expanded === h.time && <HourlyDetails condition={h} />}
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function HourlyDetails({ condition: h }) {
  return (
    <div className="hour-details">
      <dl className="hour-detail-metrics">
        <Metric
          label="Primary swell"
          note={
            finite(h.swellPeriod) && h.swellHeight > 0
              ? `${value(h.swellPeriod, " s")} period`
              : undefined
          }
        >
          {value(h.swellHeight, " m")}
          {h.swellHeight > 0 && <Direction degrees={h.swellDirection} />}
        </Metric>
        <Metric label="Wind" note={h.windType}>
          {value(h.windSpeed, " km/h", 0)}
          <Direction degrees={h.windDirection} />
          {finite(h.windGusts) && (
            <small>Gusts {value(h.windGusts, " km/h", 0)}</small>
          )}
        </Metric>
        <Metric
          label="Tide · mean sea level"
          note={h.tide ? `${h.tide.stage} · ${h.tide.trend}` : undefined}
        >
          {value(h.tide?.height, " m", 2)}
        </Metric>
        <Metric label="Weather" note={weatherLabel(h.weatherCode)}>
          {value(h.temperature, " °C")}
          {finite(h.precipitation) && (
            <small>{value(h.precipitation, "%", 0)} rain chance</small>
          )}
        </Metric>
        <OceanMetrics condition={h} />
      </dl>
      {(h.reasons?.length > 0 || h.provisional) && (
        <p className="hour-detail-reasons">
          {h.reasons?.join(" ")}
          {h.provisional ? " Partial assessment." : ""}
        </p>
      )}
      <div className="hour-swells">
        <h3>Swell components</h3>
        <SwellComponents condition={h} />
      </div>
    </div>
  );
}
function SunlightSummary({ sunlight, timezone }) {
  return (
    <div className="sunlight-summary">
      <dl className="sunlight-times" aria-label="Light through the day">
        {[
          ["firstLight", "First light"],
          ["sunrise", "Sunrise"],
          ["sunset", "Sunset"],
          ["lastLight", "Last light"],
        ].map(([key, label], i) => (
          <div
            key={key}
            className={i === 0 || i === 3 ? "twilight" : "sunshine"}
          >
            <dt>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M3 18h18M6 15a6 6 0 0 1 12 0M12 3v2M3 8l2 2M21 8l-2 2" />
                <path
                  d={i < 2 ? "M12 16v-6m-2 2 2-2 2 2" : "M12 10v6m-2-2 2 2 2-2"}
                />
              </svg>
              {label}
            </dt>
            <dd>
              {finite(sunlight?.[key])
                ? hourLabel(sunlight[key], timezone)
                : sunlight
                  ? "Not today"
                  : "Unavailable"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
function TideChart({ data, day, selectedTime, onTimeChange }) {
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
  const sunlight = data.sunlight?.find((value) => value.day === day);
  const points = data.tides.filter((p) => dateKey(p.time, zone) === day);
  const events = data.extremes.filter((p) => dateKey(p.time, zone) === day);
  const index = finite(selectedTime)
    ? points.reduce(
        (best, point, i) =>
          Math.abs(point.time - selectedTime) <
          Math.abs(points[best].time - selectedTime)
            ? i
            : best,
        0,
      )
    : Math.min(24, points.length - 1);
  if (points.length < 2)
    return (
      <div>
        <div className="forecast-notice">
          No tide curve is available for this day.
        </div>
        <SunlightSummary sunlight={sunlight} timezone={zone} />
      </div>
    );
  const current = points[Math.min(index, points.length - 1)],
    lo = Math.floor(Math.min(...points.map((p) => p.height)) * 2) / 2 - 0.2,
    hi = Math.ceil(Math.max(...points.map((p) => p.height)) * 2) / 2 + 0.2;
  const currentTide = tideAt(data.tides, current.time, data.spot.calibration);
  const x = (p) =>
      48 +
      ((p.time - points[0].time) / (points.at(-1).time - points[0].time)) *
        (width - 64),
    y = (p) => 205 - ((p.height - lo) / (hi - lo)) * 140;
  const lightEvents = [
    ["firstLight", "First light"],
    ["sunrise", "Sunrise"],
    ["sunset", "Sunset"],
    ["lastLight", "Last light"],
  ].map(([key, label], i) => ({
    key,
    label,
    time: sunlight?.[key],
    colour: i === 0 || i === 3 ? "var(--chart-civil)" : "var(--chart-solar)",
  }));
  const labelX = lightEvents.map((event, i) =>
    width < 500 || !finite(event.time)
      ? ((i + 0.5) * width) / 4
      : Math.max(52, Math.min(width - 52, x({ time: event.time }))),
  );
  if (width >= 500) {
    for (let i = 1; i < labelX.length; i++)
      labelX[i] = Math.max(labelX[i], labelX[i - 1] + 96);
    labelX[3] = Math.min(width - 52, labelX[3]);
    for (let i = 2; i >= 0; i--)
      labelX[i] = Math.min(labelX[i], labelX[i + 1] - 96);
  }
  const band = (from, to, colour, key) => {
    const left = Math.max(48, x({ time: from })),
      right = Math.min(width - 16, x({ time: to }));
    return right > left ? (
      <rect
        key={key}
        x={left}
        y="60"
        width={right - left}
        height="145"
        fill={colour}
      />
    ) : null;
  };
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(p)},${y(p)}`)
    .join(" ");
  const selectTime = (event) => {
    const svg = event.currentTarget;
    const bounds = svg.getBoundingClientRect();
    const position = ((event.clientX - bounds.left) / bounds.width) * width;
    const fraction = Math.min(1, Math.max(0, (position - 48) / (width - 64)));
    onTimeChange(points[Math.round(fraction * (points.length - 1))].time);
  };
  const selectWithKeyboard = (event) => {
    const moves = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -4,
      PageUp: 4,
    };
    if (event.key === "Home" || event.key === "End" || event.key in moves) {
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? points.length - 1
            : Math.min(
                points.length - 1,
                Math.max(0, index + moves[event.key]),
              );
      onTimeChange(points[next].time);
    }
  };
  return (
    <div className="tide-chart" ref={chart}>
      <div className="section-heading">
        <div>
          <h3>Tide and daylight</h3>
          <p>
            {value(current.height, " m MSL", 2)}
            {currentTide && ` · ${currentTide.stage} · ${currentTide.trend}`}
          </p>
        </div>
      </div>
      <p className="tide-interaction-hint">Drag to choose a time</p>
      <svg
        className="interactive-tide"
        viewBox={`0 0 ${width} 250`}
        height="250"
        role="slider"
        tabIndex={0}
        aria-label={`Tide time on ${day}. Use arrow keys to change time. ${lightEvents.map((e) => `${e.label}: ${finite(e.time) ? hourLabel(e.time, zone) : "not on this date"}`).join(". ")}`}
        aria-valuemin={0}
        aria-valuemax={points.length - 1}
        aria-valuenow={Math.min(index, points.length - 1)}
        aria-valuetext={`${hourLabel(current.time, zone)}, ${current.height.toFixed(2)} metres relative to mean sea level`}
        onKeyDown={selectWithKeyboard}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          selectTime(e);
        }}
        onPointerMove={(e) => {
          if (
            e.pointerType === "mouse" ||
            e.currentTarget.hasPointerCapture(e.pointerId)
          )
            selectTime(e);
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      >
        <title>Tide height, first light, sunrise, sunset and last light</title>
        <rect
          x="48"
          y="60"
          width={width - 64}
          height="145"
          fill="var(--chart-night)"
        />
        {sunlight?.alwaysUp
          ? band(points[0].time, points.at(-1).time, "var(--chart-day)", "day")
          : (finite(sunlight?.sunrise) || finite(sunlight?.sunset)) &&
            band(
              sunlight.sunrise ?? points[0].time,
              sunlight.sunset ?? points.at(-1).time,
              "var(--chart-day)",
              "day",
            )}
        {finite(sunlight?.firstLight) &&
          finite(sunlight?.sunrise) &&
          band(
            sunlight.firstLight,
            sunlight.sunrise,
            "var(--chart-twilight)",
            "dawn",
          )}
        {finite(sunlight?.sunset) &&
          finite(sunlight?.lastLight) &&
          band(
            sunlight.sunset,
            sunlight.lastLight,
            "var(--chart-twilight)",
            "dusk",
          )}
        {lightEvents.map((event, i) => (
          <g key={event.key} className="solar-marker" data-event={event.key}>
            <text
              x={labelX[i]}
              y="12"
              textAnchor="middle"
              fill={event.colour}
              fontSize={width < 500 ? "10" : "11"}
            >
              {event.label}
              <tspan x={labelX[i]} dy="16" fontWeight="600">
                {finite(event.time) ? hourLabel(event.time, zone) : "Not today"}
              </tspan>
            </text>
            {finite(event.time) &&
              event.time >= points[0].time &&
              event.time <= points.at(-1).time && (
                <>
                  <path
                    d={`M${labelX[i]},34 L${x({ time: event.time })},54 V205`}
                    fill="none"
                    stroke={event.colour}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity=".7"
                  />
                  <circle
                    cx={x({ time: event.time })}
                    cy="58"
                    r="2.5"
                    fill={event.colour}
                  />
                </>
              )}
          </g>
        ))}
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line
              x1="48"
              x2={width - 16}
              y1={y({ height: v })}
              y2={y({ height: v })}
              stroke="var(--line)"
            />
            <text
              x="3"
              y={y({ height: v }) + 4}
              fill="var(--muted)"
              fontSize="11"
            >
              {v.toFixed(1)} m
            </text>
          </g>
        ))}
        <path
          d={`${line} L${width - 16},205 L48,205 Z`}
          fill="var(--chart-water)"
          fillOpacity=".65"
        />
        <path d={line} fill="none" stroke="var(--sea)" strokeWidth="3" />
        {points
          .filter(
            (_, i) =>
              i % (width < 450 ? 24 : 12) === 0 || i === points.length - 1,
          )
          .map((p) => (
            <text
              key={p.time}
              x={x(p)}
              y="229"
              textAnchor={p === points.at(-1) ? "end" : "middle"}
              fill="var(--muted)"
              fontSize="11"
            >
              {hourLabel(p.time, zone)}
            </text>
          ))}
        <line
          x1={x(current)}
          x2={x(current)}
          y1="60"
          y2="205"
          stroke="var(--sea)"
          strokeDasharray="4 4"
        />
        <circle
          cx={x(current)}
          cy={y(current)}
          r="5"
          fill="var(--sea)"
          stroke="var(--surface)"
          strokeWidth="2"
        />
      </svg>
      <div className="daylight-legend" aria-label="Chart shading">
        <span>
          <i className="night" />
          Night
        </span>
        <span>
          <i className="twilight" />
          Twilight
        </span>
        <span>
          <i className="day" />
          Daylight
        </span>
      </div>
      {(sunlight?.alwaysUp || sunlight?.alwaysDown) && (
        <p className="muted-note light-explanation">
          {sunlight?.alwaysUp
            ? "The sun stays above the horizon. "
            : sunlight?.alwaysDown
              ? "The sun stays below the horizon. "
              : ""}
        </p>
      )}
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
