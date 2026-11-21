import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { isUuid } from '../../../lib/school-access.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ok:false,error:'schoolLocation.unavailable'}); }
  const { schoolId, settings } = req.query;
  if (!isUuid(schoolId) || (settings !== undefined && settings !== '1')) return res.status(400).json({ok:false,error:'schoolLocation.invalid'});
  try {
    const session = await requireAuth(req,res,settings === '1' ? {} : {schoolId});
    if (!session) return;
    if (settings === '1') {
      const [access] = await sql`SELECT account_reads_school_settings(${session.userId}::uuid,${schoolId}::uuid) AS allowed`;
      if (!access?.allowed) return res.status(403).json({ok:false,error:'schoolLocation.forbidden'});
    }
    const catalogue = settings === '1';
    const rows = await sql`SELECT sp.id,sp.name,sp.region,sp.country_code,sp.latitude,sp.longitude,sp.timezone,sp.active,
      EXISTS(SELECT 1 FROM school_operating_spots a WHERE a.school_id=${schoolId}::uuid AND a.spot_id=sp.id) AS selected
      FROM surf_spots sp WHERE ((${catalogue} AND sp.active) OR EXISTS(SELECT 1 FROM school_operating_spots a
        WHERE a.school_id=${schoolId}::uuid AND a.spot_id=sp.id AND (${catalogue} OR sp.active)))
      AND ((${catalogue} AND account_reads_school_settings(${session.userId}::uuid,${schoolId}::uuid)) OR
       (NOT ${catalogue} AND EXISTS(SELECT 1 FROM users u JOIN schools s ON s.id=${schoolId}::uuid
        WHERE u.id=${session.userId}::uuid AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND u.self_closed_at IS NULL
        AND school_is_operational(s) AND (account_is_platform(u.id) OR EXISTS(SELECT 1 FROM account_school_access a
         WHERE a.user_id=u.id AND a.school_id=s.id AND a.school_open)))))
      ORDER BY lower(sp.name),sp.id`;
    return res.json({ok:true,data:rows.map(row=>({id:row.id,name:row.name,region:row.region,countryCode:row.country_code,
      latitude:row.latitude,longitude:row.longitude,timezone:row.timezone,active:row.active,selected:row.selected}))});
  } catch { return res.status(503).json({ok:false,error:'schoolLocation.unavailable'}); }
}
