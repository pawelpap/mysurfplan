const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

// No wildcard origins: preview hosts come from deployment configuration, never forwarded headers.
export function mutationAllowed(req, env = process.env) {
  if (safeMethods.has(req.method || 'GET')) return true;
  const headers = req.headers || {};
  const site = headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return false;
  const origin = headers.origin;
  if (origin === undefined) {
    // Non-browser clients must explicitly opt into the API. Cross-origin browser
    // requests with this header require a CORS preflight, which we never allow.
    return headers['x-mywaveplan-request'] === '1';
  }
  if (typeof origin !== 'string' || typeof headers.host !== 'string') return false;
  try {
    const url = new URL(origin);
    if (origin !== url.origin || url.host !== headers.host.toLowerCase()) return false;
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
        return ['http:', 'https:'].includes(url.protocol);
    }
    const hosts = new Set([
      'mywaveplan.com', 'staging.mywaveplan.com',
      env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL,
    ].filter(Boolean));
    return url.protocol === 'https:' && hosts.has(url.host);
  } catch { return false; }
}

export function requireMutation(req, res) {
  if (mutationAllowed(req)) return true;
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(403).json({ok:false,error:'This request could not be verified. Reload the page and try again.'});
  return false;
}
