import { useLocale } from "../locale";
import { Children, useCallback, useEffect, useState } from "react";
import { request, Button, Loading, Message } from "../workspace/ui";
import Icon from "../icon";
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
    refreshing: false,
    error: "",
  });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let last = 0;
    let inFlight = false;
    let nextRefresh = 0;
    async function refresh(force = false) {
      if (inFlight) return;
      inFlight = true;
      last = Date.now();
      nextRefresh = last + 60000;
      setState((s) => ({
        url,
        data: s.url === url ? s.data : null,
        loading: !s.data || s.url !== url,
        refreshing: true,
        error: "",
      }));
      try {
        const data = await request(
          force ? url + (url.includes("?") ? "&" : "?") + "refresh=1" : url,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted)
          setState({ url, data, loading: false, refreshing: false, error: "" });
        nextRefresh = data.retryAt
          ? Math.max(Date.now() + 1000, new Date(data.retryAt).getTime())
          : Date.now() + 5 * 60000;
      } catch (e) {
        if (!controller.signal.aborted)
          setState((s) => ({
            ...s,
            loading: false,
            refreshing: false,
            error: e.message,
          }));
      } finally {
        inFlight = false;
      }
    }
    // Opening or reloading the page asks for fresh data. The server combines
    // requests made within two minutes to protect the shared provider quota.
    refresh(true);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() >= nextRefresh)
        refresh();
    }, 30000);
    const focus = () => {
      if (Date.now() - last > 60000) refresh();
    };
    window.addEventListener("focus", focus);
    const visible = () => {
      if (document.visibilityState === "visible") focus();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [url, version]);
  return {
    ...(state.url === url ? state : { data: null, loading: !!url, error: "" }),
    reload,
  };
}
export function useForecastDisplay() {
  const display = useLocale();
  return {
    ...display,
    value(n, unit = "", digits = 1) {
      if (!finite(n)) return display.t("Unavailable");
      const number = Math.abs(n) < 0.5 * 10 ** -digits ? 0 : n;
      return display.formatNumber(number, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        useGrouping: false,
      }) + unit;
    },
  };
}

export function localCompass(degrees, locale) {
  const direction = compass(degrees);
  return locale === "en-GB" ? direction : direction.replaceAll("W", "O");
}

export function Direction({ degrees }) {
  const { locale, t } = useLocale();
  if (!finite(degrees)) return <span className="muted">{t("Unavailable")}</span>;
  return (
    <span
      className="direction"
      title={t("From {1}° {2}; arrow shows travel direction", { 1: Math.round(degrees), 2: localCompass(degrees, locale) })}
    >
      <span
        className="direction-arrow"
        aria-hidden="true"
        style={{ transform: `rotate(${degrees + 180}deg)` }}
      >
        ↑
      </span>
      <span>
        <span>{`${Math.round(degrees)}° `}</span><small>{localCompass(degrees, locale)}</small>
      </span>
    </span>
  );
}
export function SwellDetails({ condition, label = "Swell components" }) {
  const { t } = useLocale();
  if (!condition) return null;
  return (
    <details className="swell-details">
      <summary>{t(label)}</summary>
      <SwellComponents condition={condition} />
    </details>
  );
}
export function SwellComponents({ condition }) {
  const { t, value } = useForecastDisplay();
  return (
    <div className="swell-components">
      {condition?.swellComponents?.map((s) => (
        <div key={s.name}>
          <strong>{t(s.name + " swell")}</strong>
          <span>
            {`${value(s.height, " m")} · ${value(s.period, " s")}`}
          </span>
          <Direction degrees={s.direction} />
        </div>
      ))}
      <div>
        <strong>{t("Wind waves")}</strong>
        <span>{value(condition?.windWaveHeight, " m")}</span>
        <Direction degrees={condition?.windWaveDirection} />
      </div>
      {!condition?.swellComponents?.length && (
        <p>
          {condition?.swellComponents
            ? t("No swell components predicted for this hour.")
            : t("Swell components unavailable for this hour.")}
        </p>
      )}
    </div>
  );
}
export function Score({ condition, compact = false }) {
  const c = condition || {};
  return (
    <span
      className={`surf-score ${c.tone || "unknown"} ${compact ? "compact" : ""}`}
    >
      <strong>
        <span>{c.score == null ? "—" : c.score}</span>
        <span>{c.score == null ? "" : "/100"}</span>
      </strong>
      <QualityLabel condition={c} />
    </span>
  );
}
export function QualityLabel({ condition }) {
  const { t } = useLocale();
  return (
    <span className={`quality-label ${condition?.tone || "unknown"}`}>
      <span className="quality-dot" aria-hidden="true" />
      <span>
        {`${t(condition?.quality || "Unavailable")}${condition?.provisional ? t(" · partial") : ""}`}
      </span>
    </span>
  );
}
export function experienceLabel(level) {
  return level === "Instructor review"
    ? "Advanced"
    : level === "Too small"
      ? "Not applicable"
      : level || "Not assessed";
}
export function Experience({ level }) {
  const { t } = useLocale();
  return (
    <span
      className={`experience ${level === "Instructor review" ? "review" : ""}`}
    >
      {t(experienceLabel(level))}
    </span>
  );
}
export function ForecastFooter({ data }) {
  const { locale, t, formatDate } = useLocale();
  if (!data?.fetchedAt) return null;
  const date = formatDate(data.fetchedAt, {
    timeZone: data.spot.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  return <p className="forecast-footer" lang={locale}>{t("forecast.updated", { date })}</p>;
}
export function Metric({ label, children, note }) {
  const { t } = useLocale();
  return (
    <div className="condition-metric">
      <dt>
        {typeof label === "string" && (
          <Icon
            name={
              label.includes("experience")
                ? "surfing"
                : label.includes("temperature")
                  ? "thermometer"
                  : label.includes("Wind")
                    ? "wind"
                    : label.includes("Weather")
                      ? "sun"
                      : "waves"
            }
          />
        )}
        {typeof label === "string" ? <span>{t(label)}</span> : label}
      </dt>
      <dd>
        {Children.map(children, (child) =>
          typeof child === "string" || typeof child === "number"
            ? <span>{child}</span>
            : child,
        )}
      </dd>
      {note && <small>{typeof note === "string" ? t(note) : note}</small>}
    </div>
  );
}
export function AssessmentMetrics({
  condition,
  level = condition?.level,
  lesson = false,
}) {
  const { t } = useLocale();
  return (
    <>
      <Metric
        label="Surf quality"
        note={
          condition?.score == null ? undefined : (
            <>
              <QualityLabel condition={condition} />
              {lesson && (
                <span className="assessment-context">{t("Lowest during the lesson")}</span>
              )}
            </>
          )
        }
      >
        <span className={`quality-value ${condition?.tone || "unknown"}`}>
          {condition?.score == null ? t("Unavailable") : `${condition.score}/100`}
        </span>
      </Metric>
      <Metric
        label="Required experience"
        note={lesson ? t("Across the lesson") : undefined}
      >
        {t(experienceLabel(level))}
      </Metric>
    </>
  );
}
export function OceanMetrics({ condition, atStart = false }) {
  const { t, value } = useForecastDisplay();
  const energy = condition?.energy;
  return (
    <>
      <Metric
        label={atStart ? "Offshore swell energy at start" : "Offshore swell energy"}
        note={
          finite(energy?.powerKwM)
            ? t("≈ {1} kW/m power{2}", { 1: value(energy.powerKwM), 2: energy.complete ? "" : t(" · partial") })
            : finite(energy?.energyKjM2)
              ? t("Power unavailable{1}", { 1: energy.complete ? "" : t(" · partial") })
              : t("No swell data for this time")
        }
      >
        {value(energy?.energyKjM2, " kJ/m²")}
      </Metric>
      <Metric
        label={atStart ? "Water temperature at start" : "Water temperature"}
        note={
          !finite(condition?.waterTemperature)
            ? t("No forecast for this time")
            : undefined
        }
      >
        {value(condition?.waterTemperature, " °C")}
      </Metric>
    </>
  );
}
export function OceanMetricsHelp() {
  const { t } = useLocale();
  return (
    <details className="ocean-metric-help">
      <summary>{t("Forecast guide")}</summary>
      <p>{t("Quality and required experience are separate: good surf can still need advanced skills. Arrows show travel direction; degrees show where wind and swell come from. Tide heights are relative to mean sea level (MSL).")}</p>
      <p>{t("Swell energy is measured offshore, before local sheltering, in kJ/m². Estimated power (kW/m) also accounts for period. Partial values use only available swell components. Higher energy does not mean better surf.")}</p>
      <p>{t("Water temperature is a sea-surface estimate and may differ near the beach. Its forecast covers fewer days than waves.")}</p>
    </details>
  );
}
export function LessonConditions({ lesson, onForecast }) {
  const { t, value } = useForecastDisplay();
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
      aria-label={t("Conditions during this lesson")}
    >
      <div className="section-heading">
        <div>
          <h2>{t("Conditions during this lesson")}</h2>
          <p>{lesson.spotName || t("Surf spot needed")}</p>
        </div>
        {onForecast && lesson.spotId && (
          <Button onClick={onForecast}>{t("16-day forecast →")}</Button>
        )}
      </div>
      {source.loading ? (
        <Loading label={t("Loading lesson conditions…")} />
      ) : source.error ? (
        <>
          <Message>{source.error}</Message>
          <Button onClick={source.reload}>{t("Try again")}</Button>
        </>
      ) : d?.unavailable ? (
        <p className="muted">{t(d.unavailable)}</p>
      ) : w ? (
        <>
          {mismatch && (
            <div className="forecast-notice warning" role="status">{t("The forecast is more demanding than this {1} lesson. Review the spot, timing and group before teaching.", { 1: t(lesson.difficulty).toLowerCase() })}</div>
          )}
          {!w.complete && (
            <div className="forecast-notice">
              {w.worst
                ? t("Part of this lesson is outside the available wave or wind forecast. The summary covers only the available hours.")
                : t("Wave and wind conditions are not yet available for this lesson time. The forecast will appear automatically when it enters the 16-day window.")}
            </div>
          )}
          <dl className="condition-metrics">
            <AssessmentMetrics
              condition={w.worst}
              level={w.requiredLevel}
              lesson
            />
            <Metric label={"Estimated surf range"} note={t("Across the lesson")}>
              {finite(w.surfMin)
                ? `${value(w.surfMin)}–${value(w.surfMax)} m`
                : t("Unavailable")}
            </Metric>
            <Metric
              label={"Primary offshore swell at start"}
              note={
                finite(start?.swellPeriod)
                  ? t("{1} period", { 1: value(start.swellPeriod, " s") })
                  : undefined
              }
            >
              {value(start?.swellHeight, " m")}
              {start?.swellHeight > 0 && (
                <Direction degrees={start.swellDirection} />
              )}
            </Metric>
            <Metric label={"Wind at start"} note={start?.windType}>
              {value(start?.windSpeed, " km/h", 0)}
              <Direction degrees={start?.windDirection} />
            </Metric>
            <Metric
              label={"Tide at start"}
              note={
                start?.tide
                  ? `${t(start.tide.stage)} · ${t(start.tide.trend)}`
                  : undefined
              }
            >
              {value(start?.tide?.height, " m MSL", 2)}
            </Metric>
            <Metric
              label={"Tide at end"}
              note={
                w.end?.tide
                  ? `${t(w.end.tide.stage)} · ${t(w.end.tide.trend)}`
                  : undefined
              }
            >
              {value(w.end?.tide?.height, " m MSL", 2)}
            </Metric>
            <Metric
              label={"Weather at start"}
              note={
                finite(start?.precipitation)
                  ? t("{1} rain chance", { 1: value(start.precipitation, "%", 0) })
                  : undefined
              }
            >
              {value(start?.temperature, " °C")}
              <small>{t(weatherLabel(start?.weatherCode))}</small>
            </Metric>
            <OceanMetrics condition={start} atStart />
          </dl>
          <OceanMetricsHelp />
          {w.worst && <p className="muted-note">{w.worst.reasons.map(reason => t(reason)).join(" ")}</p>}
          <SwellDetails
            condition={start}
            label={t("Swell components at lesson start")}
          />
          <p className="muted-note">{t("Times at the spot:")} {hourLabel(lesson.startAt, d.spot.timezone)}–
            {hourLabel(
              Date.parse(lesson.startAt) + lesson.durationMin * 60000,
              d.spot.timezone,
            )}{" "}
            ({d.spot.timezone}).
          </p>
          {d.issues.map((issue) => (
            <div className="forecast-notice" key={t(issue)}>
              {t(issue)}
            </div>
          ))}
          <ForecastFooter data={d} />
        </>
      ) : null}
    </section>
  );
}
