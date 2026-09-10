import { useEffect, useRef, useState } from "react";
import { finite, hourLabel } from "../../lib/conditions/model.mjs";
import { QualityLabel, value } from "./shared";
import { useChartInteraction } from "./chart-interaction";
import Icon from "../icon";

// Separate paths preserve unavailable intervals rather than connecting over gaps.
function segments(hours, available) {
  const result = [];
  let part = [];
  for (const hour of hours) {
    if (
      !available(hour) ||
      (part.length && hour.time - part.at(-1).time > 3600000)
    ) {
      if (part.length) result.push(part);
      part = [];
    }
    if (available(hour)) part.push(hour);
  }
  if (part.length) result.push(part);
  return result;
}
export default function SurfChart({
  hours,
  timezone,
  selectedTime,
  onTimeChange,
  condition,
}) {
  const container = useRef(null);
  const [width, setWidth] = useState(740);
  const [surf, setSurf] = useState(true);
  const [energy, setEnergy] = useState(true);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, Math.round(entry.contentRect.width))),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const start = hours[0]?.time,
    end = hours.at(-1)?.time;
  const interaction = useChartInteraction({
    start,
    end,
    selectedTime,
    width,
    onTimeChange,
  });
  const maxSurf = Math.max(
    0.5,
    Math.ceil(Math.max(0, ...hours.map((h) => h.surfMax || 0)) * 2) / 2,
  );
  const maxEnergy = Math.max(
    0.5,
    Math.ceil(Math.max(0, ...hours.map((h) => h.energy?.energyKjM2 || 0)) * 2) /
      2,
  );
  const x = (time) => 48 + ((time - start) / (end - start)) * (width - 96);
  const y = (v, max) => 190 - (v / max) * 140;
  const lines = segments(hours, (h) => finite(h.surfMin) && finite(h.surfMax));
  const energyLines = segments(hours, (h) => finite(h.energy?.energyKjM2));
  const path = (points, v, max) =>
    points
      .map((p, i) => `${i ? "L" : "M"}${x(p.time)},${y(v(p), max)}`)
      .join(" ");
  const selectedX = finite(selectedTime) ? x(selectedTime) : 48;
  return (
    <div className="surf-chart" ref={container}>
      <div className="surf-chart-heading">
        <h3>
          <Icon name="waves" />
          Surf and energy
        </h3>
        <div className="chart-series" role="group" aria-label="Chart series">
          <label>
            <input
              type="checkbox"
              checked={surf}
              onChange={(e) => setSurf(e.target.checked)}
            />
            <span className="line-key" />
            Surf · m
          </label>
          <label>
            <input
              type="checkbox"
              checked={energy}
              onChange={(e) => setEnergy(e.target.checked)}
            />
            <span className="line-key energy" />
            Energy · kJ/m²
          </label>
        </div>
      </div>
      {hours.length < 2 ? (
        <p className="forecast-notice">
          Hourly surf and energy are unavailable for this day.
        </p>
      ) : (
        <>
          <svg
            className="interactive-forecast"
            viewBox={`0 0 ${width} 232`}
            height="232"
            role="slider"
            tabIndex={0}
            aria-label="Forecast time. Drag or use arrow keys to change both charts and the detailed conditions."
            aria-valuemin={start}
            aria-valuemax={end}
            aria-valuenow={
              finite(selectedTime)
                ? Math.max(start, Math.min(end, selectedTime))
                : start
            }
            aria-valuetext={`${hourLabel(selectedTime || start, timezone)}, ${condition?.quality || "unavailable"}`}
            {...interaction}
          >
            <title>
              Local surf range and offshore swell energy, with hourly surf
              quality
            </title>
            {hours.map((h, i) => {
              const a = i === 0 ? start : (hours[i - 1].time + h.time) / 2;
              const b =
                i === hours.length - 1 ? end : (h.time + hours[i + 1].time) / 2;
              return (
                <rect
                  key={h.time}
                  x={x(a)}
                  width={Math.max(0, x(b) - x(a))}
                  y="50"
                  height="140"
                  fill={
                    h.tone && h.tone !== "unknown"
                      ? `var(--quality-${h.tone}-bg)`
                      : "var(--surface-subtle)"
                  }
                />
              );
            })}
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1="48"
                  x2={width - 48}
                  y1={190 - (i * 140) / 3}
                  y2={190 - (i * 140) / 3}
                  stroke="var(--line)"
                />
                {surf && (
                  <text x="38" y={194 - (i * 140) / 3} textAnchor="end">
                    {value((maxSurf * i) / 3)}
                  </text>
                )}
                {energy && (
                  <text x={width - 38} y={194 - (i * 140) / 3}>
                    {value((maxEnergy * i) / 3)}
                  </text>
                )}
              </g>
            ))}
            {surf && (
              <text x="48" y="30">
                m
              </text>
            )}
            {energy && (
              <text x={width - 48} y="30" textAnchor="end">
                kJ/m²
              </text>
            )}
            {surf &&
              lines.map((part, i) => (
                <g key={i}>
                  <path
                    d={`${path(part, (h) => h.surfMax, maxSurf)} ${path([...part].reverse(), (h) => h.surfMin, maxSurf).replace(/^M/, "L")} Z`}
                    fill="var(--sea)"
                    fillOpacity=".16"
                  />
                  <path
                    d={path(part, (h) => h.surfMax, maxSurf)}
                    stroke="var(--sea)"
                    strokeWidth="2"
                    fill="none"
                  />
                  <path
                    d={path(part, (h) => h.surfMin, maxSurf)}
                    stroke="var(--sea)"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </g>
              ))}
            {energy &&
              energyLines.map((part, i) => (
                <path
                  key={i}
                  d={path(part, (h) => h.energy.energyKjM2, maxEnergy)}
                  stroke="var(--ink)"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  fill="none"
                />
              ))}
            {hours
              .filter(
                (h, i) =>
                  i === 0 ||
                  i === hours.length - 1 ||
                  (i % (width < 500 ? 4 : 3) === 0 && i < hours.length - 2),
              )
              .map((h) => (
                <text key={h.time} x={x(h.time)} y="218" textAnchor="middle">
                  {hourLabel(h.time, timezone)}
                </text>
              ))}
            {finite(selectedTime) &&
              selectedTime >= start &&
              selectedTime <= end && (
                <g className="chart-cursor">
                  <line
                    x1={selectedX}
                    x2={selectedX}
                    y1="42"
                    y2="190"
                    stroke="var(--sea)"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  {surf && finite(condition?.surfMax) && (
                    <circle
                      cx={selectedX}
                      cy={y(condition.surfMax, maxSurf)}
                      r="5"
                      fill="var(--sea)"
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                  )}
                  {energy && finite(condition?.energy?.energyKjM2) && (
                    <circle
                      cx={selectedX}
                      cy={y(condition.energy.energyKjM2, maxEnergy)}
                      r="4"
                      fill="var(--ink)"
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                  )}
                </g>
              )}
          </svg>
          <div className="chart-caption">
            <span>Local surf range · offshore swell energy</span>
            <QualityLabel condition={condition} />
          </div>
          <div
            className="chart-quality-legend"
            aria-label="Background shows surf quality"
          >
            {[
              ["good", "Good"],
              ["fair", "Fair"],
              ["poor", "Poor"],
              ["bad", "Unfavourable / too small"],
            ].map(([tone, label]) => (
              <span key={tone}>
                <i
                  style={{
                    background: `var(--quality-${tone}-bg)`,
                    borderColor: `var(--quality-${tone}-line)`,
                  }}
                />
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
