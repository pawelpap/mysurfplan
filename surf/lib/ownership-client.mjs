const aliases={
 'ownership.invalidInput':'ownership.invalid','ownership.invalidLink':'ownership.offerRevoked',
 'ownership.expired':'ownership.offerExpired','ownership.revoked':'ownership.offerRevoked',
 'ownership.deliveryUnavailable':'ownership.deliveryFailed',
};
export const ownershipConsequenceVersion='ownership-workspace/1';
export function ownershipReviewIdentity(record,action,recipientEmail='',offer=record?.pendingOffer){
 if(!record?.school?.id||!record.canTransfer)return null;
 const pending=offer?.status==='pending';
 if(action==='transfer'&&pending||action!=='transfer'&&!pending)return null;
 return JSON.stringify([action,record.school.id,record.school.name,record.school.ownershipRevision,
  [...(record.formerOwnerRoles||[])].sort(),action==='transfer'?recipientEmail.trim().toLowerCase():offer.id,
  action==='transfer'?null:offer.recipientEmail]);
}
const errors=new Set(['ownership.invalid','ownership.unavailable','ownership.forbidden','ownership.conflict',
 'ownership.recipientUnavailable','ownership.wrongAccount','ownership.offerExpired','ownership.offerRevoked',
 'ownership.agreementChanged','ownership.deliveryFailed','ownership.requiredDocsUnavailable',
 'account.currentPasswordInvalid','login.rateLimit']);
export function ownershipError(value){const key=aliases[value]||value;return errors.has(key)?key:'ownership.unavailable';}
export function ownershipRecovery(error){
 const key=ownershipError(error?.message);
 if(error?.status===401)return{clearPreview:true,clearConsents:true,signIn:true,clearToken:false,reload:false};
 if(['ownership.offerExpired','ownership.offerRevoked'].includes(key))return{clearPreview:true,clearConsents:true,signIn:false,clearToken:true,reload:false};
 if(['ownership.agreementChanged','ownership.conflict','ownership.wrongAccount'].includes(key))return{clearPreview:true,clearConsents:true,signIn:false,clearToken:false,reload:true};
 return{clearPreview:key==='ownership.forbidden',clearConsents:key==='ownership.forbidden',signIn:false,clearToken:false,reload:false};
}
export async function ownershipRequest(path,{body,method=body?'POST':'GET',signal}={}){
 let response,json;const controller=new AbortController(),abort=()=>controller.abort();
 const timer=setTimeout(abort,30000);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 try{
  response=await fetch(path,{method,signal:controller.signal,headers:{'Content-Type':'application/json','X-MyWavePlan-Request':'1'},
   ...(body?{body:JSON.stringify(body)}:{})});json=await response.json();
 }catch{throw new Error('ownership.unavailable');}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 if(!response.ok||json.ok!==true){const error=new Error(ownershipError(json.error));error.status=response.status;throw error;}
 return json.data;
}
export const ownershipStatusKey=status=>({submitted:'ownership.submitted',approved:'ownership.approved',pending:'ownership.offerPending',
 rejected:'ownership.rejected',withdrawn:'ownership.withdrawn',expired:'ownership.offerExpired',superseded:'ownership.claimSuperseded',
 completed:'ownership.completed',accepted:'ownership.accepted',declined:'ownership.declined',cancelled:'ownership.offerCancelled',
 revoked:'ownership.offerRevoked'})[status]||'ownership.unavailable';
export const ownershipDeliveryKey=status=>({queued:'ownership.deliveryQueued',pending:'ownership.deliveryQueued',leased:'ownership.deliveryQueued',
 sent:'ownership.deliverySent',accepted:'ownership.deliverySent',delivered:'ownership.deliverySent',uncertain:'ownership.deliveryUnknown',
 delivery_unknown:'ownership.deliveryUnknown',failed:'ownership.deliveryFailed',cancelled:'ownership.offerCancelled'})[status]||null;
