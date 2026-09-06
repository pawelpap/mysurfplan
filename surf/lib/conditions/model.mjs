import { curveValue, engineVersion } from "./calibration.mjs";
import { swellEnergy } from "./energy.mjs";
// Initial, explainable surf heuristic. These coefficients require local calibration.
export const finite = (value) =>
  typeof value === "number" && Number.isFinite(value);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const round = (v, n = 1) => (finite(v) ? Number(v.toFixed(n)) : null);
export const bearing = (v) => ((v % 360) + 360) % 360;
export const angleDifference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
export const compass = (v) =>
  finite(v)
    ? [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
      ][Math.round(bearing(v) / 22.5) % 16]
    : "";
const dateFormatters = new Map(),
  timeFormatters = new Map();
export function dateKey(time, timezone = "UTC") {
  if (!dateFormatters.has(timezone))
    dateFormatters.set(
      timezone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    );
  const parts = dateFormatters.get(timezone).formatToParts(new Date(time));
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k).value)
    .join("-");
}
export function hourLabel(time, timezone) {
  if (!timeFormatters.has(timezone))
    timeFormatters.set(
      timezone,
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    );
  return timeFormatters.get(timezone).format(new Date(time));
}
export function weatherLabel(code) {
  if (!finite(code)) return "Weather unavailable";
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}
export function forecastViewingHours(
  hours,
  timezone,
  sunlight,
  allHours = false,
) {
  if (allHours) return hours;
  const minutes = (time) => {
    const [hour, minute] = hourLabel(time, timezone).split(":").map(Number);
    return hour * 60 + minute;
  };
  // Include the first whole hour after last light, with a practical evening
  // window in winter and a 23:00 end during polar daylight.
  const end = finite(sunlight?.lastLight)
    ? Math.max(
        18 * 60,
        Math.min(23 * 60, Math.ceil(minutes(sunlight.lastLight) / 60) * 60),
      )
    : sunlight?.alwaysUp
      ? 23 * 60
      : 21 * 60;
  return hours.filter((hour) => {
    const local = minutes(hour.time);
    return local >= 6 * 60 && local <= end;
  });
}
export function directionExposure(direction, c) {
  if (!finite(direction)) return null;
  if (c.exposureByDirection?.length) {
    const d = bearing(direction),
      points = c.exposureByDirection;
    for (let i = 1; i < points.length; i++) {
      if (d <= points[i][0]) {
        const a = points[i - 1],
          b = points[i];
        if (d === b[0]) return b[1];
        return a[1] + ((b[1] - a[1]) * (d - a[0])) / (b[0] - a[0]);
      }
    }
  }
  const difference = angleDifference(direction, c.shoreNormal);
  return (
    c.shadowFloor +
    (1 - c.shadowFloor) *
      Math.pow(
        Math.max(0, Math.cos(((difference / c.directionSpread) * Math.PI) / 2)),
        c.directionExponent,
      )
  );
}
export function tideFit(ratio, swellHeight, c) {
  if (!finite(ratio)) return null;
  const rule = c.tideRules.findLast((r) => swellHeight >= r.minimumSwell);
  return clamp(
    1 - Math.max(rule.low - ratio, ratio - rule.high, 0) * c.tidePenaltySlope,
    c.tideFitFloor,
    1,
  );
}
export function tideAt(tides, time, c) {
  const display = c.tideDisplay;
  const t = typeof time === "number" ? time : Date.parse(time);
  if (!tides?.length || t < tides[0].time || t > tides.at(-1).time) return null;
  const i = tides.findIndex((p) => p.time >= t),
    b = tides[i],
    a = tides[Math.max(0, i - 1)];
  if (
    !a ||
    !b ||
    !finite(a.height) ||
    !finite(b.height) ||
    b.time - a.time > 3600000
  )
    return null;
  const f = b.time === a.time ? 0 : (t - a.time) / (b.time - a.time);
  const height = a.height + (b.height - a.height) * f;
  const neighbours = tides
    .filter((p) => Math.abs(p.time - t) <= display.neighbourHours * 3600000)
    .map((p) => p.height)
    .filter(finite);
  const lo = Math.min(...neighbours),
    hi = Math.max(...neighbours);
  const ratio =
    hi - lo > display.minimumRange
      ? clamp((height - lo) / (hi - lo), 0, 1)
      : 0.5;
  const previous = tides[Math.max(0, i - 1)],
    next = tides[Math.min(tides.length - 1, i + 1)];
  const change = next.height - previous.height;
  return {
    height: round(height, 2),
    ratio: round(ratio, 3),
    stage:
      ratio <= display.lowAtMost
        ? "Low"
        : ratio >= display.highAtLeast
          ? "High"
          : "Mid",
    trend:
      Math.abs(change) < display.turningBelow
        ? "Turning"
        : change > 0
          ? "Rising"
          : "Falling",
  };
}
export function scoreConditions(h, c) {
  if (!c || c.schemaVersion !== 3)
    throw new Error("A valid database calibration is required.");
  const energy = swellEnergy(h);
  const required = [
    "swellHeight",
    "swellPeriod",
    "swellDirection",
    "windSpeed",
    "windDirection",
  ];
  if (required.some((k) => !finite(h[k])))
    return {
      energy,
      score: null,
      quality: "Unavailable",
      tone: "unknown",
      level: "Not assessed",
      surfMin: null,
      surfMax: null,
      reasons: ["Swell or wind data is missing."],
    };
  // GFS supplies separate swell partitions. Transform each direction before
  // combining heights: an exposed secondary swell can reach a sheltered break.
  const swellComponents = [
    ["Primary", "swell"],
    ["Secondary", "secondarySwell"],
    ["Tertiary", "tertiarySwell"],
  ].flatMap(([name, prefix]) => {
    const height = h[prefix + "Height"],
      period = h[prefix + "Period"],
      direction = h[prefix + "Direction"];
    if (!finite(height) || height <= 0 || !finite(period) || !finite(direction))
      return [];
    const exposure = directionExposure(direction, c);
    const periodFactor = clamp(
      Math.pow(
        Math.max(period, c.periodMinimum) / c.periodReference,
        c.periodExponent,
      ),
      c.periodFactorMin,
      c.periodFactorMax,
    );
    return [
      {
        name,
        height,
        period,
        direction,
        exposure,
        localHeight: height * exposure * c.swellGain * periodFactor,
      },
    ];
  });
  const dominant = swellComponents.reduce(
    (a, b) => (!a || b.localHeight > a.localHeight ? b : a),
    null,
  );
  const exposure = dominant?.exposure ?? 0;
  const localPeriod = dominant?.period ?? 0;
  // Do not invent an incoming wave direction from the local wind or allow
  // offshore wind sea to bypass a headland's shelter.
  const windSea =
    finite(h.windWaveHeight) && finite(h.windWaveDirection)
      ? h.windWaveHeight *
        c.windSeaGain *
        directionExposure(h.windWaveDirection, c)
      : 0;
  const surf = Math.sqrt(
    swellComponents.reduce((sum, s) => sum + s.localHeight ** 2, windSea ** 2),
  );
  const localWind =
    h.windSpeed *
    c.windExposure *
    curveValue(bearing(h.windDirection), c.windDirectionCurve) *
    c.windSectors.reduce((gain, sector) => {
      const d = bearing(h.windDirection);
      const inside =
        sector.from <= sector.to
          ? d >= sector.from && d <= sector.to
          : d >= sector.from || d <= sector.to;
      return gain * (inside ? sector.gain : 1);
    }, 1);
  const offshore = angleDifference(
    h.windDirection,
    bearing(c.shoreNormal + 180),
  );
  const windType =
    localWind < c.windFit.calmBelow
      ? "Light / calm"
      : offshore < c.windFit.offshoreAngleBelow
        ? "Offshore"
        : offshore > c.windFit.onshoreAngleAbove
          ? "Onshore"
          : "Cross-shore";
  const windFit =
    localWind < c.windFit.calmBelow
      ? 1
      : clamp(
          1 -
            (localWind / c.windFit.speedReference) *
              (windType === "Onshore"
                ? c.windFit.onshorePenalty
                : windType === "Cross-shore"
                  ? c.windFit.crossShorePenalty
                  : c.windFit.offshorePenalty),
          0,
          1,
        );
  const heightFit = curveValue(surf, c.heightFitCurve);
  const periodFit = curveValue(localPeriod, c.periodFitCurve);
  const usefulSwell = dominant?.height ?? 0;
  const tide = tideFit(h.tide?.ratio, usefulSwell, c);
  const reasons = [];
  if (tide === null) reasons.push("Tide is missing; the score excludes tide.");
  if (usefulSwell < c.minimumSwell)
    reasons.push("Swell may be too small for this break.");
  if (tide !== null && tide < c.warnings.tideFitBelow)
    reasons.push("Outside this spot’s preferred tide range.");
  if (exposure < c.warnings.exposureBelow)
    reasons.push("The coast is sheltered from this swell direction.");
  if (localWind > c.warnings.windAbove)
    reasons.push("Stronger wind may affect the lesson.");
  let score =
    (100 *
      (c.weights.height * heightFit +
        c.weights.wind * windFit +
        c.weights.period * periodFit +
        (tide === null ? 0 : c.weights.tide * tide))) /
    (tide === null ? 1 - c.weights.tide : 1);
  if (usefulSwell < c.minimumSwell) score *= c.minimumSwellPenalty;
  // Favourable wind and tide cannot make an unsurfably small sea good.
  const tooSmall = surf < c.flatSurfBelow;
  // Raise the size ceiling continuously so neighbouring estimates do not jump
  // from poor to good at 0.5 m. Fully useful size removes the ceiling at 0.65 m.
  const sizeCeiling = curveValue(surf, c.sizeCeilingCurve);
  score = Math.min(score, sizeCeiling);
  if (tooSmall) {
    reasons.unshift("Flat or too small for a surf lesson.");
  }
  const severe =
    surf > c.maxLessonSurf ||
    localWind >= c.severe.windAtLeast ||
    h.windGusts >= c.severe.gustsAtLeast ||
    c.severe.weatherCodes.includes(h.weatherCode);
  let level = tooSmall
    ? "Too small"
    : (
        c.experienceRules.find(
          (r) =>
            surf <= r.maxSurf &&
            localWind <= r.maxWind &&
            localPeriod <= r.maxPeriod,
        ) || c.experienceRules.at(-1)
      ).level;
  if (c.minimumLevel === "Intermediate" && level === "Beginner")
    level = "Intermediate";
  if (
    c.minimumLevel === "Advanced" &&
    ["Beginner", "Intermediate"].includes(level)
  )
    level = "Advanced";
  if (severe) {
    level = "Instructor review";
    score = Math.min(score, c.severe.scoreCap);
    reasons.push(
      "Large surf, strong wind or thunderstorms: reassess before teaching.",
    );
  }
  if (!reasons.length)
    reasons.push(
      `${windType} wind and ${tide >= c.warnings.tideFitBelow ? "a preferred tide stage" : "usable swell"}.`,
    );
  score = Math.round(clamp(score, 0, 100));
  return {
    score,
    energy,
    engineVersion,
    calibrationSchemaVersion: c.schemaVersion,
    quality:
      tooSmall && !severe
        ? "Flat / too small"
        : c.qualityBands.find((b) => score >= b.minimumScore).label,
    tone: c.qualityBands.find((b) => score >= b.minimumScore).tone,
    level,
    surfMin: round(surf * c.surfRangeMin),
    surfMax: round(surf * c.surfRangeMax),
    windType,
    swellComponents,
    windSeaSurf: round(windSea, 2),
    reasons,
    provisional: tide === null,
  };
}
export function interpolateHour(hours, time) {
  const t = typeof time === "number" ? time : Date.parse(time);
  if (!hours?.length || t < hours[0].time || t > hours.at(-1).time) return null;
  const i = hours.findIndex((h) => h.time >= t),
    b = hours[i],
    a = hours[Math.max(0, i - 1)];
  if (b.time - a.time > 3600000) return null;
  const f = a.time === b.time ? 0 : (t - a.time) / (b.time - a.time),
    out = { time: t };
  for (const key of [
    "waveHeight",
    "swellHeight",
    "swellPeriod",
    "swellDirection",
    "secondarySwellHeight",
    "secondarySwellPeriod",
    "secondarySwellDirection",
    "tertiarySwellHeight",
    "tertiarySwellPeriod",
    "tertiarySwellDirection",
    "windWaveHeight",
    "windWaveDirection",
    "windSpeed",
    "windDirection",
    "windGusts",
    "temperature",
    "waterTemperature",
    "precipitation",
    "weatherCode",
    "isDay",
  ]) {
    const av = a[key],
      bv = b[key];
    if (f === 0) {
      out[key] = av;
      continue;
    }
    if (f === 1) {
      out[key] = bv;
      continue;
    }
    if (!finite(av) || !finite(bv)) {
      out[key] = null;
      continue;
    }
    out[key] = ["weatherCode", "isDay"].includes(key)
      ? f < 0.5
        ? av
        : bv
      : key.endsWith("Direction")
        ? bearing(av + (((bv - av + 540) % 360) - 180) * f)
        : av + (bv - av) * f;
  }
  return out;
}
export function lessonWindow(forecast, start, duration, c) {
  const from = Date.parse(start),
    to = from + duration * 60000;
  const times = [
    from,
    ...forecast.hours
      .filter((h) => h.time > from && h.time < to)
      .map((h) => h.time),
    to,
  ];
  const samples = times
    .map((time) => {
      const h = interpolateHour(forecast.hours, time);
      return h
        ? { ...h, tide: tideAt(forecast.tides, time, c) }
        : { time, tide: tideAt(forecast.tides, time, c) };
    })
    .map((h) => ({ ...h, ...scoreConditions(h, c) }));
  const assessed = samples.filter((s) => s.score !== null);
  const levelRank = {
    "Too small": 0,
    Beginner: 1,
    Intermediate: 2,
    Advanced: 3,
    "Instructor review": 4,
  };
  const requiredLevel = assessed.length
    ? assessed.reduce((a, b) =>
        (levelRank[a.level] || 0) > (levelRank[b.level] || 0) ? a : b,
      ).level
    : "Not assessed";
  return {
    requiredLevel,
    start: samples[0],
    end: samples.at(-1),
    samples,
    complete: assessed.length === samples.length,
    worst: assessed.length
      ? assessed.reduce((a, b) => (a.score < b.score ? a : b))
      : null,
    surfMin: assessed.length
      ? Math.min(...assessed.map((s) => s.surfMin))
      : null,
    surfMax: assessed.length
      ? Math.max(...assessed.map((s) => s.surfMax))
      : null,
  };
}
