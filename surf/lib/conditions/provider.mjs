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
export const providerVersion = 2;
export function marineModel(spot) {
  return spot.calibration?.marineModel || "ncep_gfswave025";
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
export function normaliseForecast(marine, weather) {
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
  return { marine, weather };
}
export async function fetchForecast(spot) {
  const urls = providerUrls(spot, process.env.OPEN_METEO_API_KEY);
  async function read(url) {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`Forecast provider returned ${r.status}`);
    const j = await r.json();
    if (j.error || !j.hourly?.time?.length)
      throw new Error("Forecast provider returned no hourly data");
    return j;
  }
  const results = await Promise.allSettled([
    read(urls.marine),
    read(urls.weather),
  ]);
  const marine = results[0].status === "fulfilled" ? results[0].value : null,
    weather = results[1].status === "fulfilled" ? results[1].value : null;
  if (!marine && !weather)
    throw new Error("Forecast provider is temporarily unavailable.");
  const issues = [];
  if (!marine) issues.push("Wave forecast is temporarily unavailable.");
  if (!weather)
    issues.push("Weather and wind forecast is temporarily unavailable.");
  return {
    providerVersion,
    marineModel: marineModel(spot),
    sampleLatitude: spot.marineLatitude,
    sampleLongitude: spot.marineLongitude,
    hours: normaliseForecast(marine, weather),
    issues,
    marineGrid: marine
      ? { latitude: marine.latitude, longitude: marine.longitude }
      : null,
    weatherGrid: weather
      ? { latitude: weather.latitude, longitude: weather.longitude }
      : null,
    model: `NOAA GFS Wave ${marineModel(spot) === "ncep_gfswave016" ? "0.16°" : "0.25°"} / Open-Meteo weather best match`,
  };
}
