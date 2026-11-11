import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { invitationInput, invitationType } from './invitations.mjs';
import { validAccountToken } from './account-flow.mjs';
import { sessionTokenHash } from './auth-store.mjs';
import { emailConfig, recipientAllowed } from './email/config.mjs';
import { encryptPayload, recipientHash } from './email/crypto.mjs';
import { isLocale, defaultLocale } from './locale/preferences.mjs';
import { isUuid } from './school-access.mjs';
import { consumeLoginAttempt } from './login-limits.mjs';

export function invitationHandler({ sql, requireAuth, resolveSchoolScope, scheduleDelivery }, action = 'manage') {
 return async (req,res) => {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  if (!(['GET','POST'].includes(req.method)) || (action !== 'manage' && req.method !== 'POST')) {
   res.setHeader('Allow',action === 'manage' ? 'GET, POST' : 'POST');
   return res.status(405).json({ok:false,error:'invitation.unavailable'});
  }
  const session = await requireAuth(req,res);
  if (!session) return;
  const b=req.body || {};
  try {
   if (req.method==='POST') {
    const secret=process.env.SESSION_SECRET;
    if (!secret || secret.length<32) throw new Error('rate_key');
    const key=createHmac('sha256',secret).update(`staff-invitation:${session.userId}`).digest('hex');
    const limit=await consumeLoginAttempt(sql,[{key,limit:30}]);
    if (!limit.allowed) { res.setHeader('Retry-After',String(limit.retrySeconds)); return res.status(429).json({ok:false,error:'login.rateLimit'}); }
   }
   if(action !== 'manage') {
    if(!validAccountToken(b.token)) return res.status(400).json({ok:false,error:'invitation.invalidLink'});
    const hash=sessionTokenHash(b.token);
    if(action==='accept') {
     const [row]=await sql`SELECT accept_staff_invitation(${session.userId}::uuid,${hash}) AS id`;
     if(!row?.id) return res.status(409).json({ok:false,error:'invitation.invalidLink'});
     const [school]=await sql`SELECT slug,account_manages_school(${session.userId}::uuid,id) AS manages FROM schools WHERE id=${row.id}::uuid`;
     return res.json({ok:true,data:{schoolId:row.id,next:`/?view=${school.manages?'people':'teaching'}&school=${encodeURIComponent(school.slug)}`}});
    }
    const [row]=await sql`SELECT i.school_id AS "schoolId",s.name AS "schoolName",i.requested_roles AS roles,
      i.expires_at AS "expiresAt",i.legacy_coach_id AS "legacyCoachId",lower(btrim(u.email))=i.invited_email AS "emailMatches",
      u.email_verified_at IS NOT NULL AS verified
      FROM school_invitations i JOIN schools s ON s.id=i.school_id CROSS JOIN users u
      WHERE i.token_hash=${hash} AND i.status='pending' AND i.expires_at>now() AND u.id=${session.userId}::uuid
       AND invitation_authorised(i.invited_by,i.school_id,i.requested_roles)`;
    if(!row) return res.status(404).json({ok:false,error:'invitation.invalidLink'});
    return res.json({ok:true,data:row});
   }
   const school=await resolveSchoolScope(req.method==='GET' ? req.query.school : b.school);
   if(!school) return res.status(404).json({ok:false,error:'invitation.unavailable'});
   if(!await requireAuth(req,res,{schoolId:school.id,roles:['school_admin']})) return;
   if(req.method==='GET') {
    if(req.query.options==='1') {
     const data=await sql`SELECT id,name,email FROM coaches WHERE school_id=${school.id}::uuid AND user_id IS NULL AND deleted_at IS NULL ORDER BY lower(name),id`;
     return res.json({ok:true,data});
    }
    const data=await sql`SELECT id,invited_email AS email,requested_roles AS roles,
     CASE WHEN status='pending' AND expires_at<=now() THEN 'expired' ELSE status END AS status,
     expires_at AS "expiresAt",created_at AS "createdAt",legacy_coach_id AS "legacyCoachId"
     FROM school_invitations WHERE school_id=${school.id}::uuid ORDER BY created_at DESC LIMIT 200`;
    return res.json({ok:true,data});
   }
   const operation=b.action || 'invite';
   if(!['invite','reissue','revoke'].includes(operation) || (operation!=='invite' && !isUuid(b.id)))
    return res.status(400).json({ok:false,error:'invitation.invalidInput'});
   let input=operation==='invite' ? invitationInput(b) : null;
   if(operation==='invite' && !input) return res.status(400).json({ok:false,error:'invitation.invalidInput'});
   if(operation!=='invite') {
    const [old]=await sql`SELECT invited_email AS email,requested_roles AS roles,legacy_coach_id AS "legacyCoachId" FROM school_invitations WHERE id=${b.id}::uuid AND school_id=${school.id}::uuid`;
    if(!old) return res.status(404).json({ok:false,error:'invitation.invalidLink'});
    input=old;
   }
   let config,job=null,hash=null,encrypted=null,recipient=null;
   if(operation!=='revoke') {
    config=emailConfig();
    if(!config.enabled || !recipientAllowed(config,input.email,invitationType))
     return res.status(503).json({ok:false,error:'invitation.deliveryUnavailable'});
    const token=randomBytes(32).toString('base64url'); job=randomUUID(); hash=sessionTokenHash(token);
    recipient=recipientHash(input.email,config);
    encrypted=JSON.stringify(encryptPayload({recipient:input.email,token,locale:isLocale(b.locale)?b.locale:defaultLocale},job,config,invitationType));
   }
   const [row]=await sql`SELECT manage_staff_invitation(${session.userId}::uuid,${school.id}::uuid,${operation},${b.id || null}::uuid,
    ${input.email},${input.roles}::text[],${input.legacyCoachId}::uuid,${hash},${job}::uuid,${config?.environment || null},${recipient},${encrypted}::jsonb) AS job`;
   if(row?.job) scheduleDelivery?.(sql,config,row.job);
   return res.status(operation==='revoke'?200:202).json({ok:true});
  } catch(error) {
   const status=({'42501':403,'22023':400,'23514':409,'23505':409,'P0002':404,'40P01':409})[error?.code] || 503;
   return res.status(status).json({ok:false,error:status===403?'invitation.forbidden':status===409?'invitation.conflict':'invitation.unavailable'});
  }
 };
}
