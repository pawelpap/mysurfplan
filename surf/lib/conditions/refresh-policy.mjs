import { matchesForecastSource } from "./provider.mjs";

export const forecastTtlMs = 15 * 60000;
export const retryMinimumMs = 60000;

export function usableForecast(row, spot, now = Date.now()) {
  return Boolean(
    row?.fetched_at &&
      now - new Date(row.fetched_at).getTime() < 24 * 3600000 &&
      matchesForecastSource(row.payload, spot),
  );
}

export function completeForecast(payload) {
  return Boolean(
    payload &&
      !payload.issues?.length &&
      payload.hours?.some(
        (h) =>
          Number.isFinite(h.swellHeight) &&
          Number.isFinite(h.windSpeed) &&
          Number.isFinite(h.windDirection),
      ),
  );
}

export function refreshDue(row, spot, force, now = Date.now()) {
  if (row?.payload && !matchesForecastSource(row.payload, spot)) return true;
  const forcedAge = completeForecast(row?.payload) ? 2 * 60000 : retryMinimumMs;
  return (
    !row?.payload ||
    !row.expires_at ||
    new Date(row.expires_at).getTime() <= now ||
    (force && now - new Date(row.fetched_at).getTime() >= forcedAge)
  );
}

// Keep a whole compatible forecast, never mix fresh waves with old weather.
// Its original fetched_at remains the timestamp shown to the user.
export function forecastUpdate(row, payload, spot, now = Date.now()) {
  const partial = !completeForecast(payload);
  const retain =
    partial && usableForecast(row, spot, now) && completeForecast(row.payload);
  const retryAt = partial
    ? new Date(
        now + Math.max(retryMinimumMs, payload.retryAfterMs || 0),
      ).toISOString()
    : null;
  return {
    payload: retain ? row.payload : payload,
    fetchedAt: retain ? row.fetched_at : new Date(now).toISOString(),
    expiresAt: partial ? retryAt : new Date(now + forecastTtlMs).toISOString(),
    retryAt,
    error: partial ? "Forecast refresh incomplete" : null,
  };
}
