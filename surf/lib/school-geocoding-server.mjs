import { GeocodingError, geocodingInput, lookupSchoolAddress } from './school-geocoding.mjs';

export function schoolGeocodingHandler({ sql, requireAuth, lookup = lookupSchoolAddress, env = process.env }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'schoolLocation.lookupUnavailable' });
    }
    const session = await requireAuth(req, res);
    if (!session) return;
    if (session.demo) return res.status(403).json({ ok: false, error: 'schoolLocation.lookupForbidden' });
    try {
      const input = geocodingInput(req.body);
      // A staged key alone never enables personal-address processing.
      if (!['staging', 'production'].includes(env.APP_ENVIRONMENT) || !env.GEOAPIFY_API_KEY)
        throw new GeocodingError();
      const [permission] = await sql`SELECT reserve_school_address_lookup(${session.userId}::uuid,${input.schoolId}::uuid,${env.APP_ENVIRONMENT}::text) AS result`;
      if (!permission?.result?.allowed) {
        const limited = permission?.result?.reason === 'limited';
        if (limited) res.setHeader('Retry-After', '60');
        return res.status(limited ? 429 : 409).json({ ok: false,
          error: limited ? 'schoolLocation.lookupLimited' : 'schoolLocation.lookupNotReady' });
      }
      const data = await lookup(input, { key: env.GEOAPIFY_API_KEY });
      return res.status(200).json({ ok: true, data });
    } catch (error) {
      const status = error instanceof GeocodingError ? error.status : error?.code === '42501' ? 403 :
        ['40001', '40P01'].includes(error?.code) ? 409 : 503;
      return res.status(status).json({ ok: false, error: error instanceof GeocodingError ? error.message :
        status === 403 ? 'schoolLocation.lookupForbidden' : 'schoolLocation.lookupUnavailable' });
    }
  };
}
