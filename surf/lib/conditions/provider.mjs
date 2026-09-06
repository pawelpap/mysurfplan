import { readForecastSource } from "./provider-request.mjs";

const marineFields = {
  wave_height: "waveHeight",
  swell_wave_height: "swellHeight",
  swell_wave_direction: "swellDirection",
  swell_wave_period: "swellPeriod",
  secondary_swell_wave_height: "secondarySwellHeight",
  secondary_swell_wave_period: "secondarySwellPeriod",
  secondary_swell_wave_direction: "secondarySwellDirection",
  tertiary_swell_wave_height: "tertiarySwellHeight",
  tertiary_swell_wave_period: "tertiarySwellPeriod",
  tertiary_swell_wave_direction: "tertiarySwellDirection",
  wind_wave_height: "windWaveHeight",
  wind_wave_direction: "windWaveDirection",
};
export const providerVersion = 3;
export function hasWaveSignal(data) {
  return [
    "wave_height",
    "wind_wave_height",
    "swell_wave_height",
    "secondary_swell_wave_height",
    "tertiary_swell_wave_height",
  ].some((key) =>
    data?.hourly?.[key]?.some(
      (value) =>
        typeof value === "number" && Number.isFinite(value) && value > 0,
    ),
  );
}
export function marineModel(spot) {
  return spot.calibration.marineModel;
}
export function matchesForecastSource(payload, spot) {
  return (
    payload?.providerVersion === providerVersion &&
    payload.marineModel === marineModel(spot) &&
    payload.sampleLatitude === spot.marineLatitude &&
    payload.sampleLongitude === spot.marineLongitude
  );
}
const weatherFields = {
  temperature_2m: "temperature",
  precipitation_probability: "precipitation",
  weather_code: "weatherCode",
  wind_speed_10m: "windSpeed",
  wind_direction_10m: "windDirection",
  wind_gusts_10m: "windGusts",
  is_day: "isDay",
};
export function normaliseForecast(marine, weather, water) {
  const records = new Map();
  for (const [data, fields] of [
    [marine, marineFields],
    [weather, weatherFields],
  ]) {
    if (!data?.hourly?.time?.length) continue;
    data.hourly.time.forEach((seconds, i) => {
      const time = seconds * 1000;
      const h = records.get(time) || { time };
      for (const [api, key] of Object.entries(fields)) {
        const value = data.hourly[api]?.[i];
        h[key] =
          typeof value === "number" && Number.isFinite(value) ? value : null;
      }
      records.set(time, h);
    });
  }
  // Join temperature only to the wave/weather timeline. A failed SST request
  // must not create empty condition rows or extrapolate past its own horizon.
  water?.hourly?.time?.forEach((seconds, i) => {
    const h = records.get(seconds * 1000);
    const value = water.hourly.sea_surface_temperature?.[i];
    if (h)
      h.waterTemperature =
        typeof value === "number" && Number.isFinite(value) ? value : null;
  });
  for (const h of records.values()) h.waterTemperature ??= null;
  return [...records.values()].sort((a, b) => a.time - b.time);
}
export function providerUrls(spot, key) {
  const common = {
    forecast_days: "16",
    past_days: "1",
    timezone: spot.timezone,
    timeformat: "unixtime",
    ...(key ? { apikey: key } : {}),
  };
  const marine = new URL(
    key
      ? "https://customer-marine-api.open-meteo.com/v1/marine"
      : "https://marine-api.open-meteo.com/v1/marine",
  );
  marine.search = new URLSearchParams({
    ...common,
    latitude: spot.marineLatitude,
    longitude: spot.marineLongitude,
    hourly: Object.keys(marineFields).join(","),
    models: marineModel(spot),
    cell_selection: "sea",
  });
  const weather = new URL(
    key
      ? "https://customer-api.open-meteo.com/v1/forecast"
      : "https://api.open-meteo.com/v1/forecast",
  );
  weather.search = new URLSearchParams({
    ...common,
    latitude: spot.latitude,
    longitude: spot.longitude,
    hourly: Object.keys(weatherFields).join(","),
    wind_speed_unit: "kmh",
  });
  const water = new URL(marine);
  water.searchParams.delete("models");
  water.searchParams.set("latitude", spot.latitude);
  water.searchParams.set("longitude", spot.longitude);
  water.searchParams.set("hourly", "sea_surface_temperature");
  return { marine, weather, water };
}
export async function fetchForecast(spot, requestOptions) {
  const urls = providerUrls(spot, process.env.OPEN_METEO_API_KEY);
  const results = await Promise.allSettled([
    readForecastSource(urls.marine, "marine", requestOptions),
    readForecastSource(urls.weather, "weather", requestOptions),
    readForecastSource(urls.water, "water", requestOptions),
  ]);
  let marine = results[0].status === "fulfilled" ? results[0].value : null;
  const zeroFilled = marine && !hasWaveSignal(marine);
  if (zeroFilled) marine = null;
  const weather = results[1].status === "fulfilled" ? results[1].value : null;
  const water = results[2].status === "fulfilled" ? results[2].value : null;
  const retryAfterMs = Math.max(
    0,
    ...results
      .slice(0, 2)
      .map((r) => (r.status === "rejected" ? r.reason.retryAfterMs || 0 : 0)),
  );
  if (!marine && !weather) {
    const error = new Error("Forecast provider is temporarily unavailable.");
    error.retryAfterMs = retryAfterMs;
    throw error;
  }
  const issues = [];
  if (!marine)
    issues.push(
      zeroFilled
        ? "Wave forecast is unavailable for this location."
        : "Wave forecast is temporarily unavailable.",
    );
  if (!weather)
    issues.push("Weather and wind forecast is temporarily unavailable.");
  return {
    providerVersion,
    marineModel: marineModel(spot),
    sampleLatitude: spot.marineLatitude,
    sampleLongitude: spot.marineLongitude,
    hours: normaliseForecast(marine, weather, water),
    waterTemperatureSource: {
      status: water?.hourly?.sea_surface_temperature?.some(Number.isFinite)
        ? "available"
        : "unavailable",
      model: "Open-Meteo marine best match sea surface temperature",
      grid: water
        ? { latitude: water.latitude, longitude: water.longitude }
        : null,
    },
    issues,
    retryAfterMs,
    marineGrid: marine
      ? { latitude: marine.latitude, longitude: marine.longitude }
      : null,
    weatherGrid: weather
      ? { latitude: weather.latitude, longitude: weather.longitude }
      : null,
    model: `NOAA GFS Wave ${marineModel(spot) === "ncep_gfswave016" ? "0.16°" : "0.25°"} / Open-Meteo weather best match`,
  };
}
