import test from "node:test";
import assert from "node:assert/strict";
import { readForecastSource } from "../lib/conditions/provider-request.mjs";
import { fetchForecast, providerVersion } from "../lib/conditions/provider.mjs";
import {
  forecastUpdate,
  refreshDue,
  usableForecast,
} from "../lib/conditions/refresh-policy.mjs";

const spot = {
  latitude: 38.68,
  longitude: -9.37,
  marineLatitude: 38.66,
  marineLongitude: -9.37,
  timezone: "Europe/Lisbon",
  calibration: { marineModel: "ncep_gfswave025" },
};
const now = Date.parse("2026-09-06T20:00:00Z");
const complete = {
  providerVersion,
  marineModel: spot.calibration.marineModel,
  sampleLatitude: spot.marineLatitude,
  sampleLongitude: spot.marineLongitude,
  issues: [],
  hours: [{ time: now, swellHeight: 1, windSpeed: 10, windDirection: 0 }],
};
const partial = {
  ...complete,
  issues: ["Weather and wind forecast is temporarily unavailable."],
  hours: [{ time: now, swellHeight: 1.5 }],
};
const cached = {
  payload: complete,
  fetched_at: new Date(now - 16 * 60000).toISOString(),
  expires_at: new Date(now - 60000).toISOString(),
};
const response = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers });
const hourly = { hourly: { time: [now / 1000] } };

test("weather timeout retries once, succeeds and does not expose credentials in diagnostics", async () => {
  let calls = 0;
  const waits = [],
    logs = [];
  const result = await readForecastSource(
    "https://example.com?apikey=secret",
    "weather",
    {
      fetcher: async (_url, options) => {
        assert.equal(options.cache, "no-store");
        assert.ok(options.signal instanceof AbortSignal);
        if (++calls === 1) throw new DOMException("secret URL", "TimeoutError");
        return response(hourly);
      },
      sleep: async (ms) => waits.push(ms),
      warn: (...args) => logs.push(args),
    },
  );
  assert.deepEqual(result, hourly);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [500]);
  assert.equal(logs[0][1].timeout, true);
  assert.equal(logs[0][1].retry, true);
  assert.ok(!JSON.stringify(logs).includes("secret"));
});

test("permanent errors do not retry; transient failures cannot loop indefinitely", async () => {
  for (const [status, expectedCalls] of [
    [400, 1],
    [401, 1],
    [503, 2],
  ]) {
    let calls = 0;
    await assert.rejects(
      readForecastSource("https://example.com", "marine", {
        fetcher: async () => {
          calls++;
          return response({}, status);
        },
        sleep: async () => {},
        warn: () => {},
      }),
      (error) => error.status === status,
    );
    assert.equal(calls, expectedCalls);
  }
});

test("long Retry-After is carried into cache back-off without blocking a server request", async () => {
  let calls = 0;
  let delay;
  await assert.rejects(
    readForecastSource("https://example.com", "weather", {
      fetcher: async () => {
        calls++;
        return response({}, 429, { "Retry-After": "300" });
      },
      sleep: async () => assert.fail("must not sleep for five minutes"),
      warn: () => {},
    }),
    (error) => {
      delay = error.retryAfterMs;
      return error.status === 429;
    },
  );
  assert.equal(calls, 1);
  const update = forecastUpdate(
    cached,
    { ...partial, retryAfterMs: delay },
    spot,
    now,
  );
  assert.equal(Date.parse(update.retryAt) - now, 300000);
});

test("a missing weather source preserves the whole previous forecast and its honest update time", () => {
  const update = forecastUpdate(cached, partial, spot, now);
  assert.equal(update.payload, complete);
  assert.equal(update.payload.hours[0].swellHeight, 1);
  assert.equal(update.fetchedAt, cached.fetched_at);
  assert.equal(update.error, "Forecast refresh incomplete");
  assert.equal(Date.parse(update.retryAt) - now, 60000);
  assert.equal(update.expiresAt, update.retryAt);
});

test("partial forecasts cannot borrow data from another source or a forecast aged 24 hours", () => {
  for (const old of [
    null,
    { ...cached, payload: { ...complete, sampleLatitude: 50 } },
    { ...cached, payload: { ...complete, marineModel: "different" } },
    { ...cached, fetched_at: new Date(now - 24 * 3600000).toISOString() },
    { ...cached, payload: partial },
  ]) {
    const update = forecastUpdate(old, partial, spot, now);
    assert.equal(update.payload, partial);
    assert.equal(update.payload.hours[0].windSpeed, undefined);
    assert.equal(update.fetchedAt, new Date(now).toISOString());
    assert.equal(Date.parse(update.expiresAt) - now, 60000);
  }
  assert.equal(
    usableForecast(
      { ...cached, fetched_at: new Date(now - 24 * 3600000).toISOString() },
      spot,
      now,
    ),
    false,
  );
});

test("a successful refresh replaces the retained forecast and clears the failure back-off", () => {
  const update = forecastUpdate(cached, complete, spot, now);
  assert.equal(update.fetchedAt, new Date(now).toISOString());
  assert.equal(Date.parse(update.expiresAt) - now, 15 * 60000);
  assert.equal(update.error, null);
  assert.equal(update.retryAt, null);
});

test("old partial caches can be forced after one minute, healthy forecasts still coalesce for two", () => {
  for (const [payload, delay] of [
    [partial, 60000],
    [complete, 120000],
  ]) {
    const row = {
      payload,
      fetched_at: new Date(now).toISOString(),
      expires_at: new Date(now + 15 * 60000).toISOString(),
    };
    assert.equal(refreshDue(row, spot, true, now + delay - 1), false);
    assert.equal(refreshDue(row, spot, true, now + delay), true);
    assert.equal(refreshDue(row, spot, false, now + delay), false);
  }
  assert.equal(
    refreshDue(
      { ...cached, payload: { ...complete, providerVersion: 0 } },
      spot,
      false,
      now,
    ),
    true,
  );
});

test("real provider adapter recovers weather independently; optional SST failure leaves fresh waves usable", async () => {
  let weatherCalls = 0;
  const data = await fetchForecast(spot, {
    fetcher: async (url) => {
      if (url.searchParams.get("hourly") === "sea_surface_temperature")
        return response({}, 503);
      if (url.hostname === "api.open-meteo.com") {
        if (++weatherCalls === 1) throw new TypeError("network failure");
        return response({
          hourly: {
            ...hourly.hourly,
            wind_speed_10m: [10],
            wind_direction_10m: [0],
          },
        });
      }
      return response({ hourly: { ...hourly.hourly, swell_wave_height: [1] } });
    },
    sleep: async () => {},
    warn: () => {},
  });
  assert.equal(weatherCalls, 2);
  assert.deepEqual(data.issues, []);
  assert.equal(data.hours[0].windSpeed, 10);
  assert.equal(data.hours[0].waterTemperature, null);
  assert.equal(
    forecastUpdate(cached, data, spot, now).fetchedAt,
    new Date(now).toISOString(),
  );
});

test("permanent weather failure remains explicitly incomplete after marine data arrives", async () => {
  const data = await fetchForecast(spot, {
    fetcher: async (url) =>
      url.hostname === "api.open-meteo.com"
        ? response({}, 400)
        : response({ hourly: { ...hourly.hourly, swell_wave_height: [1] } }),
    sleep: async () => {},
    warn: () => {},
  });
  assert.deepEqual(data.issues, partial.issues);
  assert.equal(data.hours[0].windSpeed, undefined);
  assert.equal(forecastUpdate(cached, data, spot, now).payload, complete);
});
