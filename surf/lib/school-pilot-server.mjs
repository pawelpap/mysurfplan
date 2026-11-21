import{isUuid}from'./school-access.mjs';import{recentAccountProof}from'./recent-account-proof.mjs';
export function schoolPilotHandler({sql,requireAuth,getSessionHash,env=process.env,proof=recentAccountProof}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({ok:false,error:'pilot.unavailable'});}
  const session=await requireAuth(req,res);if(!session)return;if(session.demo)return res.status(403).json({ok:false,error:'pilot.forbidden'});
  try{
   if(req.method==='GET'){
    if(!isUuid(req.query.schoolId))return res.status(400).json({ok:false,error:'pilot.invalid'});
    const[row]=await sql`SELECT school_pilot_review(${req.query.schoolId}::uuid,${session.userId}::uuid) AS data`;
    return row?.data?res.json({ok:true,data:row.data}):res.status(403).json({ok:false,error:'pilot.forbidden'});
   }
   const body=req.body;
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['schoolId','revision','acceptanceId','requestId','currentPassword'].includes(k))||
    !isUuid(body.schoolId)||!isUuid(body.acceptanceId)||!isUuid(body.requestId)||!Number.isSafeInteger(body.revision)||body.revision<1||body.revision>2147483647)
    return res.status(400).json({ok:false,error:'pilot.invalid'});
   const current=await proof({req,sql,userId:session.userId,password:body.currentPassword,sessionHash:getSessionHash(req),env});
   const[row]=await sql`SELECT approve_school_pilot(${session.userId}::uuid,${body.schoolId}::uuid,${body.revision}::integer,
    ${body.acceptanceId}::uuid,${body.requestId}::uuid,${current.passwordHash}::text,${current.authVersion}::integer,${current.sessionHash}::text) AS data`;
   return res.json({ok:true,data:row.data});
  }catch(e){if(e.retrySeconds)res.setHeader('Retry-After',String(e.retrySeconds));const status=e.status||({'42501':403,'22023':400,'23514':409,'23505':409,'40001':409,'40P01':409})[e.code]||503;
   return res.status(status).json({ok:false,error:e.status?e.message:status===403?'pilot.forbidden':status===409?'pilot.conflict':'pilot.unavailable'});}
 };
}
