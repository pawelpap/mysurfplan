import { useCallback, useEffect, useState } from "react";
import { request, Button, Loading, Message } from "../workspace/ui";
import {
  compass,
  finite,
  hourLabel,
  weatherLabel,
} from "../../lib/conditions/model.mjs";
export function useForecast(url) {
  const [state, setState] = useState({
    url: null,
    data: null,
    loading: false,
    error: "",
  });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let last = 0;
    let inFlight = false;
    async function refresh(force = false) {
      if (inFlight) return;
      inFlight = true;
      last = Date.now();
      setState((s) => ({
        url,
        data: s.url === url ? s.data : null,
        loading: !s.data || s.url !== url,
        error: "",
      }));
      try {
        const data = await request(
          force ? url + (url.includes("?") ? "&" : "?") + "refresh=1" : url,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted)
          setState({ url, data, loading: false, error: "" });
      } catch (e) {
        if (!controller.signal.aborted)
          setState((s) => ({ ...s, loading: false, error: e.message }));
      } finally {
        inFlight = false;
      }
    }
    // Opening or reloading the page asks for fresh data. The server combines
    // requests made within two minutes to protect the shared provider quota.
    refresh(true);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 5 * 60000);
    const focus = () => {
      if (Date.now() - last > 60000) refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [url, version]);
  return {
    ...(state.url === url ? state : { data: null, loading: !!url, error: "" }),
    reload,
  };
}
export const value = (n, unit = "", digits = 1) =>
  finite(n)
    ? `${(Math.abs(n) < 0.5 * 10 ** -digits ? 0 : n).toFixed(digits)}${unit}`
    : "Unavailable";
export function Direction({ degrees }) {
  if (!finite(degrees)) return <span className="muted">Unavailable</span>;
  return (
    <span
      className="direction"
      title={`From ${Math.round(degrees)}° ${compass(degrees)}; arrow shows travel direction`}
    >
      <span
        className="direction-arrow"
        aria-hidden="true"
        style={{ transform: `rotate(${degrees + 180}deg)` }}
      >
        ↑
      </span>
      <span>
        {Math.round(degrees)}° <small>{compass(degrees)}</small>
      </span>
    </span>
  );
}
export function SwellDetails({ condition, label = "Swell components" }) {
  if (!condition?.swellComponents) return null;
  return (
    <details className="swell-details">
      <summary>{label}</summary>
      <div className="swell-components">
        {condition.swellComponents.map((s) => (
          <div key={s.name}>
            <strong>{s.name} swell</strong>
            <span>
              {value(s.height, " m")} · {value(s.period, " s")}
            </span>
            <Direction degrees={s.direction} />
          </div>
        ))}
      </div>
      {!condition.swellComponents.length && (
        <p>No swell components predicted for this hour.</p>
      )}
    </details>
  );
}
export function Score({ condition, compact = false }) {
  const c = condition || {};
  return (
    <span
      className={`surf-score ${c.tone || "unknown"} ${compact ? "compact" : ""}`}
    >
      <strong>
        {c.score == null ? "—" : c.score}
        <span>{c.score == null ? "" : "/100"}</span>
      </strong>
      <span>
        {c.quality || "Unavailable"}
        {c.provisional ? " · partial" : ""}
      </span>
    </span>
  );
}
export function Experience({ level }) {
  return (
    <span
      className={`experience ${level === "Instructor review" ? "review" : ""}`}
    >
      {level === "Beginner"
        ? "Beginner with instructor"
        : level || "Not assessed"}
    </span>
  );
}
export function ForecastFooter({ data }) {
  return data?.fetchedAt ? (
    <p className="forecast-footer">
      Updated{" "}
      {new Date(data.fetchedAt).toLocaleString("en-GB", {
        timeZone: data.spot.timezone,
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </p>
  ) : null;
}
export function Metric({ label, children, note }) {
  return (
    <div className="condition-metric">
      <dt>{label}</dt>
      <dd>{children}</dd>
      {note && <small>{note}</small>}
    </div>
  );
}
export function LessonConditions({ lesson, onForecast }) {
  const source = useForecast(`/api/lessons/${lesson.id}/conditions`);
  const d = source.data,
    w = d?.window,
    start = w?.start;
  const rank = {
    Beginner: 1,
    Intermediate: 2,
    Advanced: 3,
    "Instructor review": 4,
  };
  const mismatch =
    w && (rank[w.requiredLevel] || 0) > (rank[lesson.difficulty] || 0);
  return (
    <section
      className="surface padded lesson-conditions"
      aria-label="Conditions during this lesson"
    >
      <div className="section-heading">
        <div>
          <h2>Conditions during this lesson</h2>
          <p>{lesson.spotName || "Surf spot needed"}</p>
        </div>
        {onForecast && lesson.spotId && (
          <Button onClick={onForecast}>16-day forecast →</Button>
        )}
      </div>
      {source.loading ? (
        <Loading label="Loading lesson conditions…" />
      ) : source.error ? (
        <>
          <Message>{source.error}</Message>
          <Button onClick={source.reload}>Try again</Button>
        </>
      ) : d?.unavailable ? (
        <p className="muted">{d.unavailable}</p>
      ) : w ? (
        <>
          <div className="lesson-condition-summary">
            <div>
              <small>Lowest surf quality during the lesson</small>
              <Score condition={w.worst} />
            </div>
            <div>
              <small>Required experience during the lesson</small>
              <Experience level={w.requiredLevel} />
            </div>
          </div>

          {mismatch && (
            <div className="forecast-notice warning" role="status">
              The forecast is more demanding than this{" "}
              {lesson.difficulty.toLowerCase()} lesson. An instructor should
              review the spot, timing and group before teaching.
            </div>
          )}
          {!w.complete && (
            <div className="forecast-notice">
              {w.worst
                ? "Part of this lesson is outside the available wave or wind forecast. The summary covers only the available hours."
                : "Wave and wind conditions are not yet available for this lesson time. The forecast will appear automatically when it enters the 16-day window."}
            </div>
          )}
          <dl className="condition-metrics">
            <Metric label="Estimated surf range" note="Across the lesson">
              {finite(w.surfMin)
                ? `${value(w.surfMin)}–${value(w.surfMax)} m`
                : "Unavailable"}
            </Metric>
            <Metric
              label="Primary offshore swell at start"
              note={
                finite(start?.swellPeriod)
                  ? `${value(start.swellPeriod, " s")} period`
                  : undefined
              }
            >
              {value(start?.swellHeight, " m")}
              {start?.swellHeight > 0 && (
                <Direction degrees={start.swellDirection} />
              )}
            </Metric>
            <Metric label="Wind at start" note={start?.windType}>
              {value(start?.windSpeed, " km/h", 0)}
              <Direction degrees={start?.windDirection} />
            </Metric>
            <Metric
              label="Tide at start"
              note={
                start?.tide
                  ? `${start.tide.stage} · ${start.tide.trend}`
                  : undefined
              }
            >
              {value(start?.tide?.height, " m MSL", 2)}
            </Metric>
            <Metric
              label="Tide at end"
              note={
                w.end?.tide
                  ? `${w.end.tide.stage} · ${w.end.tide.trend}`
                  : undefined
              }
            >
              {value(w.end?.tide?.height, " m MSL", 2)}
            </Metric>
            <Metric
              label="Weather at start"
              note={
                finite(start?.precipitation)
                  ? `${value(start.precipitation, "%", 0)} rain chance`
                  : undefined
              }
            >
              {value(start?.temperature, " °C")}
              <small>{weatherLabel(start?.weatherCode)}</small>
            </Metric>
          </dl>
          {w.worst && <p className="muted-note">{w.worst.reasons.join(" ")}</p>}
          <SwellDetails
            condition={start}
            label="Swell components at lesson start"
          />
          <p className="muted-note">
            Times at the spot: {hourLabel(lesson.startAt, d.spot.timezone)}–
            {hourLabel(
              Date.parse(lesson.startAt) + lesson.durationMin * 60000,
              d.spot.timezone,
            )}{" "}
            ({d.spot.timezone}).
          </p>
          {d.issues.map((issue) => (
            <div className="forecast-notice" key={issue}>
              {issue}
            </div>
          ))}
          <ForecastFooter data={d} />
        </>
      ) : null}
    </section>
  );
}
