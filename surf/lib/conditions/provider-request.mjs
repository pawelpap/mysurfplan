const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(value) {
  if (!value) return 0;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - Date.now();
  return Number.isFinite(ms) ? Math.max(0, ms) : 0;
}

// One bounded retry keeps all three parallel sources within the 40-second lease.
export async function readForecastSource(
  url,
  source,
  { fetcher = fetch, sleep = pause, warn = console.warn } = {},
) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (!response.ok) {
        const error = new Error("Forecast provider request failed");
        error.status = response.status;
        error.retryAfterMs = retryDelay(response.headers.get("retry-after"));
        throw error;
      }
      const data = await response.json();
      if (data.error || !data.hourly?.time?.length) {
        const error = new Error("Forecast provider returned no hourly data");
        error.name = "InvalidForecastError";
        throw error;
      }
      return data;
    } catch (error) {
      const transient =
        !error.status ||
        error.status === 408 ||
        error.status === 429 ||
        error.status >= 500;
      const delay = Math.max(500, error.retryAfterMs || 0);
      const retry = attempt === 1 && transient && delay <= 1000;
      // Never log request URLs, API keys, response bodies or raw network errors.
      warn("conditions provider request failed", {
        source,
        attempt,
        status: error.status || null,
        timeout: error.name === "TimeoutError" || error.name === "AbortError",
        durationMs: Date.now() - started,
        retry,
      });
      if (!retry) throw error;
      await sleep(delay);
    }
  }
}
