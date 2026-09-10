import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Field,
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
  calendarDays,
  meaningfulExperience,
  previewHours,
  timeOnDay,
  weatherIcon,
} from "../../lib/conditions/presentation.mjs";
import {
  useForecast,
  Score,
  Experience,
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
import SpotBrowser, {
  DirectionWeather,
  TileExperience,
  useConditionsClock,
} from "./spot-browser";
import SurfChart from "./surf-chart";
import Icon from "../icon";
import { useChartInteraction } from "./chart-interaction";

const dayLabel = (day, weekday = "short") =>
  new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday,
    day: "numeric",
    month: "short",
  });
const validClock = (clock) =>
  typeof clock === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(clock);
export default function Conditions({ session, query, go, onLessons }) {
  const spots = useData("/api/spots");
  const selected =
    spots.data.find((s) => s.id === query.spot || s.slug === query.spot) ||
    spots.data[0];
  const [notice, setNotice] = useState("");
  const [chosenClock, setChosenClock] = useState(null);
  const [revision, setRevision] = useState(0);
  const now = useConditionsClock();
  useEffect(
    () => setChosenClock(validClock(query.time) ? query.time : null),
    [query.time],
  );
  const clock =
    chosenClock || (now && selected ? hourLabel(now, selected.timezone) : "");
  const today = now && selected ? dateKey(now, selected.timezone) : null;
  const catalogue = query.action === "all-spots";
  const navigate = (values) =>
    go({
      spot: selected?.slug,
      date: query.date,
      time: chosenClock || undefined,
      ...values,
    });
  const selectDay = (date) =>
    navigate({
      date,
      time: "12:00",
      action: catalogue ? "all-spots" : undefined,
    });
  const setClock = (time) => {
    if (validClock(time)) setChosenClock(time);
  };
  const resetNow = () => {
    setChosenClock(null);
    go({
      spot: selected?.slug,
      date: today,
      action: catalogue ? "all-spots" : undefined,
    });
  };
  const admin = session.role === "platform_admin";
  if (["new-spot", "edit-spot"].includes(query.action) && !admin)
    return (
      <>
        <PageHeading title="Spot settings" />
        <Message>Spot settings are available only to platform admins.</Message>
        <Button onClick={() => navigate({ action: undefined })}>
          Back to Conditions
        </Button>
      </>
    );
  if (query.action === "new-spot" && admin)
    return (
      <SpotForm
        onCancel={() => navigate({ action: undefined })}
        onSaved={(spot) => {
          spots.reload();
          setNotice("Surf spot added.");
          navigate({ spot: spot.slug, action: undefined });
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
        onCancel={() => navigate({ action: undefined })}
        onSaved={(spot) => {
          spots.reload();
          setNotice("Surf spot saved.");
          navigate({ spot: spot.slug, action: undefined });
        }}
      />
    );
  return (
    <div className="conditions-v2">
      <PageHeading
        title="Conditions"
        action={
          admin && (
            <div className="actions">
              <Button onClick={() => navigate({ action: "new-spot" })}>
                + Add spot
              </Button>
              {selected && (
                <Button onClick={() => navigate({ action: "edit-spot" })}>
                  Spot settings
                </Button>
              )}
            </div>
          )
        }
      />
      <Message success>{notice}</Message>
      <SpotBrowser
        spots={spots.data}
        selected={selected?.id}
        autoSelect={!query.spot}
        now={now}
        refreshVersion={revision}
        onChoose={(spot) =>
          navigate({
            spot: spot.slug,
            time: chosenClock || undefined,
            action: undefined,
          })
        }
        catalogue={catalogue}
        onCatalogue={() => {
          navigate({ action: catalogue ? undefined : "all-spots" });
        }}
      />
      {!catalogue &&
        (selected ? (
          <SpotForecast
            key={`${selected.id}:${selected.version}`}
            spot={selected}
            date={query.date}
            onDate={selectDay}
            clock={clock}
            onClock={setClock}
            onNow={resetNow}
            onRefresh={() => setRevision((v) => v + 1)}
            now={now}
            onLessons={
              onLessons
                ? (time, day) =>
                    onLessons({
                      spot: selected.id,
                      date: day,
                      time: hourLabel(time, selected.timezone),
                    })
                : null
            }
          />
        ) : (
          <p>No spots yet. A platform admin can add the first one.</p>
        ))}
    </div>
  );
}
function conditionAt(data, time) {
  if (!finite(time)) return null;
  const raw = interpolateHour(data.hours, time);
  if (!raw) return null;
  const h = { ...raw, tide: tideAt(data.tides, time, data.spot.calibration) };
  return { ...h, ...scoreConditions(h, data.spot.calibration) };
}
function SpotForecast({
  spot,
  date,
  onDate,
  clock,
  onClock,
  onNow,
  onRefresh,
  now,
  onLessons,
}) {
  const source = useForecast(
    "/api/conditions?spot=" + encodeURIComponent(spot.slug),
  );
  const [allHours, setAllHours] = useState(false);
  const [nightHours, setNightHours] = useState(false);
  const calendar = useRef(null);
  const [calendarPosition, setCalendarPosition] = useState({
    start: true,
    end: false,
  });
  const d = source.data;
  const firstDay = d?.dates?.[0];
  const hasClock = Boolean(clock);
  useEffect(() => {
    const el = calendar.current;
    if (!el) return;
    const revealSelected = () => {
      const day = el.querySelector('[aria-pressed="true"]');
      if (day)
        el.scrollTo({
          left: Math.max(0, day.offsetLeft - el.offsetLeft - 4),
          behavior: "instant",
        });
    };
    revealSelected();
    const update = () =>
      setCalendarPosition({
        start: el.scrollLeft < 2,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
    const observer = new ResizeObserver(() => {
      revealSelected();
      update();
    });
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [date, firstDay, hasClock]);
  const dailyHours = useMemo(() => {
    const grouped = new Map();
    for (const h of d?.hours || []) {
      const day = dateKey(h.time, spot.timezone);
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day).push(h);
    }
    return grouped;
  }, [d, spot.timezone]);
  const dayConditions = useMemo(
    () =>
      d
        ? Object.fromEntries(
            d.dates.map((day) => [
              day,
              conditionAt(d, timeOnDay(day, "12:00", spot.timezone)),
            ]),
          )
        : {},
    [d, spot.timezone],
  );
  if (source.loading)
    return (
      <div className="forecast-skeleton" role="status">
        <Loading label="Loading forecast…" />
        <div />
        <div />
      </div>
    );
  if (source.error && !d)
    return (
      <>
        <Message>{source.error}</Message>
        <Button onClick={source.reload}>Try again</Button>
      </>
    );
  if (!d || !clock) return null;
  const selected = d.dates.includes(date) ? date : d.dates[0];
  const hours = dailyHours.get(selected) || [];
  const selectedTime = timeOnDay(selected, clock, spot.timezone);
  const snapshot = conditionAt(d, selectedTime);
  const chooseTime = (time) =>
    onClock(
      hourLabel(
        dateKey(time, spot.timezone) === selected ? time : time - 60000,
        spot.timezone,
      ),
    );
  const sunlight = d.sunlight?.find((day) => day.day === selected);
  const visible = forecastViewingHours(
    hours,
    spot.timezone,
    sunlight,
    nightHours,
  );
  const shown = allHours ? visible : previewHours(visible, selectedTime);
  // Stable full-day axes: changing the cursor must never resize the time domain mid-drag.
  const last = hours.at(-1);
  const nextHour = last && d.hours.find((h) => h.time === last.time + 3600000);
  const chartHours = nextHour ? [...hours, nextHour] : hours;
  return (
    <div className="forecast-screen">
      <div className="spot-context">
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
          View map ↗
        </a>
      </div>
      {source.error && <Message>{source.error}</Message>}
      {d.issues.map((issue) => (
        <div className="forecast-notice" key={issue}>
          {issue}
        </div>
      ))}
      <section aria-label="16-day forecast">
        <div className="section-heading outlook-heading">
          <div>
            <h2>16-day forecast</h2>
            <p>Daily snapshot at 12:00</p>
          </div>
          <div className="forecast-update">
            <ForecastFooter data={d} />
            <Button
              onClick={() => {
                source.reload();
                onRefresh();
              }}
              disabled={source.refreshing}
              aria-busy={source.refreshing}
            >
              {source.refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
        <div
          className="calendar-navigation"
          role="group"
          aria-label="Browse weekday columns"
        >
          <Button
            aria-label="Earlier weekday columns"
            disabled={calendarPosition.start}
            onClick={() =>
              calendar.current?.scrollBy({ left: -360, behavior: "smooth" })
            }
          >
            <Icon name="chevron-right" className="icon-back" />
          </Button>
          <Button
            aria-label="Later weekday columns"
            disabled={calendarPosition.end}
            onClick={() =>
              calendar.current?.scrollBy({ left: 360, behavior: "smooth" })
            }
          >
            <Icon name="chevron-right" />
          </Button>
        </div>
        <div className="calendar-scroll" ref={calendar}>
          <div className="forecast-calendar">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => (
              <span
                key={day}
                className={`calendar-weekday ${i > 4 ? "weekend" : ""}`}
              >
                {day}
              </span>
            ))}
            {calendarDays(d.dates).map(({ day, available, weekend }) => {
              const h = dayConditions[day];
              const dayNumber = Number(day.slice(-2));
              const today = now && dateKey(now, spot.timezone) === day;
              const label = `${dayLabel(day, "long")} at 12:00, ${h?.score == null ? "forecast unavailable" : h.quality}${meaningfulExperience(h?.level) ? `, ${meaningfulExperience(h.level)}` : ""}`;
              if (!available)
                return (
                  <div
                    key={day}
                    className="calendar-empty"
                    aria-label={`${dayLabel(day)}, outside the forecast`}
                  >
                    <span>{dayNumber}</span>
                    {dayNumber === 1 && (
                      <small>
                        {new Date(`${day}T12:00Z`).toLocaleDateString("en-GB", {
                          month: "short",
                          timeZone: "UTC",
                        })}
                      </small>
                    )}
                  </div>
                );
              return (
                <button
                  type="button"
                  key={day}
                  className={`calendar-day quality-tile ${h?.tone || "unknown"} ${selected === day ? "selected" : ""} ${weekend ? "weekend" : ""}`}
                  aria-pressed={selected === day}
                  aria-current={today ? "date" : undefined}
                  aria-label={label}
                  onClick={() => onDate(day)}
                >
                  <span className="calendar-date">
                    {dayNumber}
                    <span>
                      {today
                        ? "Today"
                        : dayNumber === 1 || day === d.dates[0]
                          ? new Date(`${day}T12:00Z`).toLocaleDateString(
                              "en-GB",
                              { month: "short", timeZone: "UTC" },
                            )
                          : ""}
                    </span>
                  </span>
                  <span className="calendar-quality">
                    <span className="calendar-quality-full">
                      {h?.quality || "Unavailable"}
                    </span>
                    <span className="calendar-quality-short" aria-hidden="true">
                      {h?.quality === "Flat / too small"
                        ? "Flat"
                        : h?.tone === "bad"
                          ? "Unfav."
                          : h?.quality || "Missing"}
                    </span>
                  </span>
                  <span className="calendar-surf">
                    <Icon name="waves" />
                    {finite(h?.surfMin)
                      ? `${value(h.surfMin)}–${value(h.surfMax)} m`
                      : "Unavailable"}
                  </span>
                  <DirectionWeather condition={h} numeric />
                  <TileExperience level={h?.level} />
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <section
        className="surface padded selected-forecast"
        aria-label="Selected day forecast"
      >
        <div className="section-heading selected-day-heading">
          <div>
            <h2>{dayLabel(selected, "long")}</h2>
            <p className="selected-conditions-time">Conditions at {clock}</p>
          </div>
          <div className="actions">
            <Field
              label="Time"
              type="time"
              step="60"
              value={clock}
              onChange={(e) => onClock(e.target.value)}
            />
            <Button onClick={onNow}>Now</Button>
            {onLessons && (
              <Button
                onClick={() => onLessons(selectedTime, selected)}
                disabled={!finite(selectedTime)}
              >
                Find lessons
              </Button>
            )}
          </div>
        </div>
        {!finite(selectedTime) && (
          <Message>
            This local time is skipped or repeated when the clocks change.
            Choose another time.
          </Message>
        )}
        <SurfChart
          hours={chartHours}
          timezone={spot.timezone}
          selectedTime={selectedTime}
          onTimeChange={chooseTime}
          condition={snapshot}
        />
        <TideChart
          key={selected}
          data={d}
          day={selected}
          domain={[chartHours[0]?.time, chartHours.at(-1)?.time]}
          selectedTime={selectedTime}
          onTimeChange={chooseTime}
        />
        <dl className="condition-metrics">
          <AssessmentMetrics condition={snapshot} />
          <Metric
            label={
              <>
                <Icon name="waves" />
                Estimated surf
              </>
            }
          >
            {finite(snapshot?.surfMin)
              ? `${value(snapshot.surfMin)}–${value(snapshot.surfMax)} m`
              : "Unavailable"}
          </Metric>
          <Metric
            label={
              <>
                <Icon name="waves" />
                Primary swell
              </>
            }
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
          <Metric
            label={
              <>
                <Icon name="wind" />
                Wind
              </>
            }
            note={snapshot?.windType}
          >
            {value(snapshot?.windSpeed, " km/h", 0)}
            <Direction degrees={snapshot?.windDirection} />
            {finite(snapshot?.windGusts) && (
              <small>Gusts {value(snapshot.windGusts, " km/h", 0)}</small>
            )}
          </Metric>
          <Metric
            label={
              <>
                <Icon name={weatherIcon(snapshot?.weatherCode) || "sun"} />
                Weather
              </>
            }
            note={weatherLabel(snapshot?.weatherCode)}
          >
            {value(snapshot?.temperature, " °C")}
            {finite(snapshot?.precipitation) && (
              <small>{value(snapshot.precipitation, "%", 0)} rain chance</small>
            )}
          </Metric>
          <OceanMetrics condition={snapshot} />
        </dl>
        {snapshot?.reasons?.length > 0 && (
          <p className="muted-note">{snapshot.reasons.join(" ")}</p>
        )}
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
              {visible.length
                ? `${hourLabel(visible[0].time, spot.timezone)}–${hourLabel(visible.at(-1).time, spot.timezone)}`
                : "No hours available"}
            </p>
          </div>
          <div className="actions">
            {allHours && (
              <Button onClick={() => setNightHours((v) => !v)}>
                {nightHours ? "Daytime hours" : "Include night hours"}
              </Button>
            )}
            <Button
              onClick={() => setAllHours((v) => !v)}
              aria-expanded={allHours}
              aria-controls="forecast-hours"
            >
              {allHours ? "Show fewer hours" : "Show all hours"}
            </Button>
          </div>
        </div>
        {visible.length ? (
          <div className="forecast-hours" id="forecast-hours">
            {shown.map((h) => (
              <HourRow
                key={h.time}
                hour={h}
                timezone={spot.timezone}
                selected={Math.abs(h.time - selectedTime) < 1800000}
                onSelect={() => chooseTime(h.time)}
                onLessons={onLessons ? () => onLessons(h.time, selected) : null}
              />
            ))}
          </div>
        ) : (
          <div className="forecast-notice">
            Hourly wave and weather data is unavailable for this day.
          </div>
        )}
      </section>
    </div>
  );
}
function HourRow({ hour: h, timezone, selected, onSelect, onLessons }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `hour-${h.time}`;
  return (
    <article className={`forecast-hour ${selected ? "selected" : ""}`}>
      <div className="forecast-hour-summary">
        <button
          type="button"
          className="hour-select"
          onClick={onSelect}
          aria-pressed={selected}
        >
          <time dateTime={new Date(h.time).toISOString()}>
            {hourLabel(h.time, timezone)}
          </time>
        </button>
        <span className="hour-surf">
          <Icon name="waves" />
          <strong>
            {finite(h.surfMin)
              ? `${value(h.surfMin)}–${value(h.surfMax)} m`
              : "Unavailable"}
          </strong>
        </span>
        <Score condition={h} compact />
        <span className="hour-experience">
          <TileExperience level={h.level} />
        </span>
        <span className="hour-wind">
          <Icon name="wind" />
          {value(h.windSpeed, " km/h", 0)}
        </span>
        <div className="actions">
          <Button
            onClick={() => {
              setExpanded((v) => !v);
              onSelect();
            }}
            aria-expanded={expanded}
            aria-controls={detailsId}
          >
            {expanded ? "Less" : "Details"}
            <Icon
              name="chevron-right"
              className={expanded ? "icon-up" : "icon-down"}
            />
          </Button>
          {onLessons && (
            <Button tone="quiet" onClick={onLessons}>
              Find lessons
            </Button>
          )}
        </div>
      </div>
      <div id={detailsId} hidden={!expanded}>
        {expanded && <HourlyDetails condition={h} />}
      </div>
    </article>
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
function TideChart({ data, day, selectedTime, onTimeChange, domain }) {
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
  const points = data.tides.filter(
    (p) =>
      (dateKey(p.time, zone) === day || p.time === domain?.[1]) &&
      (!finite(domain?.[0]) || p.time >= domain[0]) &&
      (!finite(domain?.[1]) || p.time <= domain[1]),
  );
  const interaction = useChartInteraction({
    start: points[0]?.time,
    end: points.at(-1)?.time,
    selectedTime,
    width,
    onTimeChange,
  });
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
  const selectedTide = finite(selectedTime)
    ? tideAt(data.tides, selectedTime, data.spot.calibration)
    : null;
  const current =
    selectedTide &&
    selectedTime >= points[0].time &&
    selectedTime <= points.at(-1).time
      ? { time: selectedTime, height: selectedTide.height }
      : points[Math.min(index, points.length - 1)];
  const lo = Math.floor(Math.min(...points.map((p) => p.height)) * 2) / 2 - 0.2,
    hi = Math.ceil(Math.max(...points.map((p) => p.height)) * 2) / 2 + 0.2;
  const currentTide = tideAt(data.tides, current.time, data.spot.calibration);
  const x = (p) =>
      48 +
      ((p.time - points[0].time) / (points.at(-1).time - points[0].time)) *
        (width - 96),
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
      right = Math.min(width - 48, x({ time: to }));
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
        {...interaction}
      >
        <title>Tide height, first light, sunrise, sunset and last light</title>
        <rect
          x="48"
          y="60"
          width={width - 96}
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
              x2={width - 48}
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
          d={`${line} L${width - 48},205 L48,205 Z`}
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
