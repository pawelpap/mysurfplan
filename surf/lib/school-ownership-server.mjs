import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {ownershipInput,OwnershipInputError,ownershipOfferType,ownershipChangedType} from './school-ownership.mjs';
import {isUuid} from './school-access.mjs';
import {sessionTokenHash} from './auth-store.mjs';
import {recentAccountProof} from './recent-account-proof.mjs';
import {emailConfig,recipientAllowed} from './email/config.mjs';
import {encryptPayload,recipientHash} from './email/crypto.mjs';
import {isLocale} from './locale/preferences.mjs';
import {consumeLoginAttempt,clientNetwork} from './login-limits.mjs';

export function schoolOwnershipHandler({sql,requireAuth,getSessionHash,scheduleDelivery,env=process.env,proof=recentAccountProof},route='manage'){
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
  const methods=route==='offer'?['POST']:['GET','POST'];if(!methods.includes(req.method)){res.setHeader('Allow',methods.join(', '));return res.status(405).json({ok:false,error:'ownership.unavailable'});}
  const session=await requireAuth(req,res);if(!session)return;
  if(session.demo)return res.status(403).json({ok:false,error:'ownership.forbidden'});
  try{
   if(req.method==='GET'){
    if(route==='manage'){
     if(!isUuid(req.query.schoolId))throw new OwnershipInputError();
     const[row]=await sql`SELECT ownership_summary(${session.userId}::uuid,${req.query.schoolId}::uuid)AS data`;
     if(!row?.data)throw new OwnershipInputError('ownership.forbidden',403);return res.json({ok:true,data:row.data});
    }
    const view=req.query.view||'mine';if(!['targets','mine','review'].includes(view))throw new OwnershipInputError();
    const[ability]=await sql`SELECT ownership_account_eligible(${session.userId}::uuid)AS "canSubmit",account_is_platform(${session.userId}::uuid)AND ownership_account_eligible(${session.userId}::uuid)AS "canReview"`;
    if(view==='targets'){
     const search=typeof req.query.search==='string'?req.query.search.trim():'';if(search.length>160)throw new OwnershipInputError();
     const rows=await sql`SELECT id,name,slug,ownership_revision AS "ownershipRevision" FROM schools s WHERE ownership_claimable(s)
      AND (${search}='' OR strpos(lower(name),lower(${search}))>0)ORDER BY lower(name),id LIMIT 100`;
     return res.json({ok:true,data:{schools:rows,canSubmit:ability.canSubmit,canReview:ability.canReview}});
    }
    if(!ability.canSubmit||(view==='review'&&!ability.canReview))throw new OwnershipInputError('ownership.forbidden',403);
    const rows=await sql`SELECT ownership_claim_json(c,${view==='review'})||CASE WHEN ${view==='review'} THEN jsonb_build_object('canReview',c.claimant_id<>${session.userId}::uuid AND c.status='submitted')ELSE '{}'::jsonb END AS data
     FROM school_ownership_claims c WHERE (${view==='review'} OR c.claimant_id=${session.userId}::uuid)ORDER BY c.created_at DESC,c.id DESC LIMIT 200`;
    return res.json({ok:true,data:{claims:rows.map(r=>r.data)}});
   }
   const {action,body}=ownershipInput(req.body,route);
   if(typeof env.SESSION_SECRET!=='string'||env.SESSION_SECRET.length<32)throw new OwnershipInputError('ownership.unavailable',503);
   const digest=(kind,value)=>createHmac('sha256',env.SESSION_SECRET).update(JSON.stringify(['ownership-v1',kind,value])).digest('hex');
   const limit=await consumeLoginAttempt(sql,[{key:digest('user',session.userId),limit:60},{key:digest('network',clientNetwork(req,env)),limit:200}]);
   if(!limit.allowed){res.setHeader('Retry-After',String(limit.retrySeconds));throw new OwnershipInputError('login.rateLimit',429);}
   const sessionHash=getSessionHash(req);let current={sessionHash,passwordHash:null,authVersion:null};
   if(['review','transfer','reissue','cancel','accept'].includes(action))current=await proof({req,sql,userId:session.userId,password:req.body.currentPassword,sessionHash,env});
   if(body.token){body.tokenHash=sessionTokenHash(body.token);delete body.token;}
   // Read only delivery material after authority checks. SQL rechecks every snapshot under locks.
   let config,mail={};
   const makeMail=(person,type,extra)=>{
    if(!config)config=emailConfig(env);
    if(!config.enabled||!recipientAllowed(config,person.email,type))throw new OwnershipInputError('ownership.deliveryUnavailable',503);
    const jobId=randomUUID(),payload={recipient:person.email,locale:extra?.audience==='previous'&&isLocale(person.preferred_locale)?person.preferred_locale:body.locale,...extra};
    return {jobId,userId:person.id,email:person.email,authVersion:person.auth_version,environment:config.environment,
     recipientHash:recipientHash(person.email,config),payload:encryptPayload(payload,jobId,config,type)};
   };
   if(['transfer','reissue'].includes(action)||(action==='review'&&body.decision==='approve')){
    const[person]=await sql`SELECT u.id,lower(btrim(u.email))AS email,u.auth_version FROM users u WHERE ownership_account_eligible(u.id)AND(
     (${action}='transfer'AND lower(btrim(u.email))=${body.recipientEmail||null}AND EXISTS(SELECT 1 FROM schools s JOIN school_memberships m ON m.id=s.owner_membership_id
      WHERE s.id=${body.schoolId||null}::uuid AND m.user_id=${session.userId}::uuid AND m.status='active'AND ownership_school_eligible(s)))OR
     (${action}='reissue'AND EXISTS(SELECT 1 FROM school_ownership_offers o JOIN schools s ON s.id=o.school_id JOIN school_memberships m ON m.id=s.owner_membership_id
      WHERE o.id=${body.offerId||null}::uuid AND o.school_id=${body.schoolId||null}::uuid AND o.recipient_user_id=u.id AND m.user_id=${session.userId}::uuid AND m.status='active'))OR
     (${action}='review'AND account_is_platform(${session.userId}::uuid)AND EXISTS(SELECT 1 FROM school_ownership_claims c WHERE c.id=${body.claimId||null}::uuid AND c.claimant_id=u.id AND c.claimant_id<>${session.userId}::uuid)))`;
    if(!person)throw new OwnershipInputError(action==='transfer'?'ownership.recipientUnavailable':'ownership.forbidden',action==='transfer'?409:403);
    const token=randomBytes(32).toString('base64url');mail.offer=makeMail(person,ownershipOfferType,{token,kind:action==='review'?'claim':'transfer'});mail.offer.tokenHash=sessionTokenHash(token);
   }
   if(action==='accept'){
    const[offer]=await sql`SELECT o.status,o.source_owner_membership_id,s.name AS "schoolName" FROM school_ownership_offers o JOIN schools s ON s.id=o.school_id
     WHERE o.token_hash=${body.tokenHash}AND o.recipient_user_id=${session.userId}::uuid`;
    if(offer?.status==='pending'){
     const people=await sql`SELECT u.id,lower(btrim(u.email))AS email,u.auth_version,u.preferred_locale FROM users u WHERE u.id=${session.userId}::uuid OR
      u.id IN(SELECT user_id FROM school_memberships WHERE id=${offer.source_owner_membership_id}::uuid)`;
     for(const person of people){const audience=person.id===session.userId?'new':'previous';mail[audience]=makeMail(person,ownershipChangedType,{audience,schoolName:offer.schoolName});}
    }
   }
   const[row]=await sql`SELECT school_ownership_action(${session.userId}::uuid,${action},${JSON.stringify(body)}::jsonb,${current.sessionHash},${current.passwordHash},${current.authVersion}::integer,${JSON.stringify(mail)}::jsonb)AS data`;
   // Do not dispatch freshly generated IDs on an idempotent replay.
   if(!row.data?.replayed&&config)for(const item of Object.values(mail))scheduleDelivery?.(sql,config,item.jobId);
   return res.json({ok:true,data:row.data});
  }catch(e){
   if(e.retrySeconds)res.setHeader('Retry-After',String(e.retrySeconds));
   const status=e.status||({'42501':403,'22023':400,'23514':409,'23505':409,'40001':409,'40P01':409,'P0002':404})[e.code]||503;
   const safe=/^(ownership\.(invalidInput|unavailable|forbidden|conflict|recipientUnavailable|invalidLink|wrongAccount|expired|revoked|deliveryUnavailable|agreementChanged)|account\.(currentPasswordInvalid|unavailable)|login\.rateLimit)$/.test(e.message||'');
   return res.status(status).json({ok:false,error:safe?e.message:status===403?'ownership.forbidden':status===409?'ownership.conflict':status===400?'ownership.invalidInput':'ownership.unavailable'});
  }
 };
}
