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
        1.3,
      )
  );
}
export function tideFit(ratio, swellHeight, c) {
  if (!finite(ratio)) return null;
  let low = 0.25,
    high = 0.75;
  switch (c.tidePreference) {
    case "low-mid":
      low = 0;
      high = 0.6;
      break;
    case "mid-high":
      low = 0.4;
      high = 1;
      break;
    case "bico":
      low = 0;
      high = swellHeight >= c.largerSwellThreshold ? 0.7 : 0.35;
      break;
    case "bafureira":
      low = 0.4;
      high = 1;
      break;
    case "any":
      low = 0;
      high = 1;
      break;
  }
  return clamp(1 - Math.max(low - ratio, ratio - high, 0) * 2.2, 0.1, 1);
}
export function tideAt(tides, time) {
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
    .filter((p) => Math.abs(p.time - t) <= 8 * 3600000)
    .map((p) => p.height)
    .filter(finite);
  const lo = Math.min(...neighbours),
    hi = Math.max(...neighbours);
  const ratio = hi - lo > 0.05 ? clamp((height - lo) / (hi - lo), 0, 1) : 0.5;
  const previous = tides[Math.max(0, i - 1)],
    next = tides[Math.min(tides.length - 1, i + 1)];
  const change = next.height - previous.height;
  return {
    height: round(height, 2),
    ratio: round(ratio, 3),
    stage: ratio <= 0.33 ? "Low" : ratio >= 0.67 ? "High" : "Mid",
    trend:
      Math.abs(change) < 0.035 ? "Turning" : change > 0 ? "Rising" : "Falling",
  };
}
export function scoreConditions(h, c) {
  const required = [
    "swellHeight",
    "swellPeriod",
    "swellDirection",
    "windSpeed",
    "windDirection",
  ];
  if (required.some((k) => !finite(h[k])))
    return {
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
      Math.pow(Math.max(period, 1) / c.periodReference, c.periodExponent),
      0.7,
      1.35,
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
      ? h.windWaveHeight * 0.35 * directionExposure(h.windWaveDirection, c)
      : 0;
  const surf = Math.sqrt(
    swellComponents.reduce((sum, s) => sum + s.localHeight ** 2, windSea ** 2),
  );
  const localWind =
    h.windSpeed *
    c.windExposure *
    (angleDifference(h.windDirection, 0) <= 45 ? c.northWindShelter : 1);
  const offshore = angleDifference(
    h.windDirection,
    bearing(c.shoreNormal + 180),
  );
  const windType =
    localWind < 5
      ? "Light / calm"
      : offshore < 45
        ? "Offshore"
        : offshore > 135
          ? "Onshore"
          : "Cross-shore";
  const windFit =
    localWind < 5
      ? 1
      : clamp(
          1 -
            (localWind / 40) *
              (windType === "Onshore"
                ? 1.3
                : windType === "Cross-shore"
                  ? 0.95
                  : 0.55),
          0,
          1,
        );
  const heightFit =
    surf < 0.5
      ? clamp(surf / 0.5, 0, 1)
      : surf <= 1.8
        ? 1
        : clamp(1 - (surf - 1.8) / 2, 0, 1);
  const periodFit = clamp((localPeriod - 4) / 8, 0.1, 1);
  const usefulSwell = dominant?.height ?? 0;
  const tide = tideFit(h.tide?.ratio, usefulSwell, c);
  const reasons = [];
  if (tide === null) reasons.push("Tide is missing; the score excludes tide.");
  if (usefulSwell < c.minimumSwell)
    reasons.push("Swell may be too small for this break.");
  if (tide !== null && tide < 0.65)
    reasons.push("Outside this spot’s preferred tide range.");
  if (exposure < 0.45)
    reasons.push("The coast is sheltered from this swell direction.");
  if (localWind > 20) reasons.push("Stronger wind may affect the lesson.");
  let score =
    (100 *
      (0.4 * heightFit +
        0.3 * windFit +
        0.15 * periodFit +
        (tide === null ? 0 : 0.15 * tide))) /
    (tide === null ? 0.85 : 1);
  if (usefulSwell < c.minimumSwell) score *= 0.65;
  // Favourable wind and tide cannot make an unsurfably small sea good.
  const tooSmall = surf < 0.3;
  if (tooSmall) {
    score = Math.min(score, (25 * surf) / 0.3);
    reasons.unshift("Flat or too small for a surf lesson.");
  } else if (surf < 0.5) score = Math.min(score, 49);
  const severe =
    surf > c.maxLessonSurf ||
    localWind >= 35 ||
    h.windGusts >= 45 ||
    h.weatherCode >= 95;
  let level = tooSmall
    ? "Too small"
    : surf <= 0.9 && localWind <= 18 && localPeriod <= 14
      ? "Beginner"
      : surf <= 1.6 && localWind <= 25
        ? "Intermediate"
        : "Advanced";
  if (c.minimumLevel === "Intermediate" && level === "Beginner")
    level = "Intermediate";
  if (
    c.minimumLevel === "Advanced" &&
    ["Beginner", "Intermediate"].includes(level)
  )
    level = "Advanced";
  if (severe) {
    level = "Instructor review";
    score = Math.min(score, 25);
    reasons.push(
      "Large surf, strong wind or thunderstorms: reassess before teaching.",
    );
  }
  if (!reasons.length)
    reasons.push(
      `${windType} wind and ${tide >= 0.65 ? "a preferred tide stage" : "usable swell"}.`,
    );
  score = Math.round(clamp(score, 0, 100));
  return {
    score,
    quality:
      tooSmall && !severe
        ? "Flat / too small"
        : score >= 75
          ? "Good"
          : score >= 50
            ? "Fair"
            : score >= 30
              ? "Poor"
              : "Unfavourable",
    tone:
      score >= 75
        ? "good"
        : score >= 50
          ? "fair"
          : score >= 30
            ? "poor"
            : "bad",
    level,
    surfMin: round(surf * 0.75),
    surfMax: round(surf * 1.25),
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
        ? { ...h, tide: tideAt(forecast.tides, time) }
        : { time, tide: tideAt(forecast.tides, time) };
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
export const defaultCalibration = {
  modelVersion: "surf-heuristic-v1",
  status: "initial",
  shoreNormal: 270,
  swellGain: 1,
  directionSpread: 85,
  shadowFloor: 0.08,
  periodReference: 10,
  periodExponent: 0.35,
  windExposure: 1,
  northWindShelter: 1,
  tidePreference: "mid",
  largerSwellThreshold: 1.5,
  minimumSwell: 0,
  minimumLevel: "Beginner",
  maxLessonSurf: 2.5,
  tideTimeOffsetMin: 0,
  tideHeightScale: 1,
};
