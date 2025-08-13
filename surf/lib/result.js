// Tiny helpers for API responses
export function ok(data = null) {
  return { ok: true, data };
}

export function fail(error, status = 400) {
  return { ok: false, error, status };
}

// Helper to send consistent JSON from API routes
export function sendJson(res, body, status) {
  const http = status ?? (body.ok ? 200 : body.status || 400);
  res.status(http).json(body);
}
