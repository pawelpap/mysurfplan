import {createHmac}from'node:crypto';
import {verifyPassword}from'./passwords.mjs';
import {clientNetwork,consumeLoginAttempt}from'./login-limits.mjs';
export class AccountProofError extends Error{constructor(message,status=400,retrySeconds){super(message);this.status=status;this.retrySeconds=retrySeconds;}}
export async function recentAccountProof({req,sql,userId,password,sessionHash,env=process.env,verify=verifyPassword}){
 if(typeof password!=='string'||!password||password.length>256)throw new AccountProofError('account.currentPasswordInvalid');
 if(typeof env.SESSION_SECRET!=='string'||Buffer.byteLength(env.SESSION_SECRET)<32||!/^[a-f0-9]{64}$/.test(sessionHash||''))throw new AccountProofError('account.unavailable',503);
 const digest=(kind,value)=>createHmac('sha256',env.SESSION_SECRET).update(JSON.stringify(['school-sensitive-v1',kind,value])).digest('hex');
 const limit=await consumeLoginAttempt(sql,[{key:digest('user',userId),limit:8},{key:digest('network',clientNetwork(req,env)),limit:40}]);
 if(!limit.allowed)throw new AccountProofError('login.rateLimit',429,limit.retrySeconds);
 const [person]=await sql`SELECT password_hash,auth_version FROM users WHERE id=${userId}::uuid
  AND deleted_at IS NULL AND disabled_at IS NULL AND self_closed_at IS NULL AND NOT is_demo AND email_verified_at IS NOT NULL`;
 if(!person||!await verify(password,person.password_hash))throw new AccountProofError('account.currentPasswordInvalid');
 return{passwordHash:person.password_hash,authVersion:person.auth_version,sessionHash};
}
