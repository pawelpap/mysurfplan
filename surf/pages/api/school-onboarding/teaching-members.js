import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { isUuid } from '../../../lib/school-access.mjs';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if (req.method !== 'GET') {res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'schoolLocation.unavailable'});}
  const {schoolId}=req.query;
  if(!isUuid(schoolId))return res.status(400).json({ok:false,error:'schoolLocation.invalid'});
  try {
    const session=await requireAuth(req,res,{schoolId,roles:['school_admin']});if(!session)return;
    const rows=await sql`SELECT c.id,c.name FROM coaches c JOIN users u ON u.id=c.user_id
      JOIN school_memberships m ON m.school_id=c.school_id AND m.user_id=c.user_id
      WHERE c.school_id=${schoolId}::uuid AND c.deleted_at IS NULL AND m.status='active'
      AND account_manages_school(${session.userId}::uuid,${schoolId}::uuid)
      AND u.deleted_at IS NULL AND u.disabled_at IS NULL AND u.self_closed_at IS NULL AND NOT u.is_demo
      AND EXISTS(SELECT 1 FROM membership_roles r WHERE r.membership_id=m.id AND r.role='coach' AND r.revoked_at IS NULL)
      ORDER BY lower(c.name),c.id`;
    return res.json({ok:true,data:rows});
  }catch{return res.status(503).json({ok:false,error:'schoolLocation.unavailable'});}
}
