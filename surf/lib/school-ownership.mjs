import {isUuid} from './school-access.mjs';
import {validAccountToken} from './account-flow.mjs';
import {isLocale} from './locale/preferences.mjs';
import {validEmail} from './email/config.mjs';
export const ownershipOfferType='email.ownership_offer';
export const ownershipChangedType='email.ownership_changed';
export const ownershipConsequencesVersion='ownership-workspace/1';
export class OwnershipInputError extends Error { constructor(code='ownership.invalidInput',status=400){super(code);this.status=status;} }
const fields={
 transfer:['schoolId','ownershipRevision','recipientEmail','locale','requestId','currentPassword'],
 cancel:['schoolId','ownershipRevision','offerId','requestId','currentPassword','locale'],
 reissue:['schoolId','ownershipRevision','offerId','requestId','currentPassword','locale'],
 submit:['schoolId','ownershipRevision','statement','requestId'],withdraw:['claimId','revision','requestId'],
 review:['claimId','revision','decision','reason','caseReference','locale','requestId','currentPassword'],
 preview:['token','locale'],accept:['token','offerId','ownershipRevision','documentId','version','language','contentHash','acceptedOwnership','authorisedRepresentative','acceptedAgreement','consequencesVersion','currentPassword','locale'],
 decline:['token','offerId'],
};
export function ownershipInput(body,route){
 if(!body||typeof body!=='object'||Array.isArray(body)||!Object.hasOwn(fields,body.action))throw new OwnershipInputError();
 const action=body.action,allowed=route==='offer'?['preview','accept','decline']:route==='claims'?['submit','withdraw','review']:['transfer','cancel','reissue'];
 if(!allowed.includes(action)||Object.keys(body).some(k=>k!=='action'&&!fields[action].includes(k)))throw new OwnershipInputError();
 const b={...body};delete b.action;delete b.currentPassword;
 for(const key of fields[action].filter(k=>['schoolId','claimId','offerId','requestId'].includes(k)))if(!isUuid(b[key]))throw new OwnershipInputError();
 for(const key of fields[action].filter(k=>['ownershipRevision','revision'].includes(k)))if(!Number.isSafeInteger(b[key])||b[key]<1)throw new OwnershipInputError();
 if(fields[action].includes('token')&&!validAccountToken(b.token))throw new OwnershipInputError('ownership.invalidLink');
 if(fields[action].includes('locale')&&!(action==='cancel'&&b.locale===undefined)&&!isLocale(b.locale))throw new OwnershipInputError();
 if(action==='transfer'){b.recipientEmail=typeof b.recipientEmail==='string'?b.recipientEmail.trim().toLowerCase():'';if(!validEmail(b.recipientEmail))throw new OwnershipInputError();}
 const plain=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
 if(action==='submit'){if(!plain(b.statement,20,2000))throw new OwnershipInputError();b.statement=b.statement.trim();}
 if(action==='review'){
  if(!['approve','reject'].includes(b.decision)||!plain(b.reason,10,1000)||!plain(b.caseReference,1,160))throw new OwnershipInputError();
  b.reason=b.reason.trim();b.caseReference=b.caseReference.trim();
 }
 if(action==='accept'&&(b.acceptedOwnership!==true||b.authorisedRepresentative!==true||b.acceptedAgreement!==true||b.consequencesVersion!==ownershipConsequencesVersion||
 b.documentId!=='mywaveplan.school-processing'||typeof b.version!=='string'||b.version.length<1||b.version.length>80||!isLocale(b.language)||!/^[a-f0-9]{64}$/.test(b.contentHash||'')))throw new OwnershipInputError();
 return {action,body:b};
}
export function ownershipLink(environment,token,locale){
 if(!['staging','production'].includes(environment)||!validAccountToken(token)||!isLocale(locale))throw new OwnershipInputError();
 return `https://${environment==='staging'?'staging.':''}mywaveplan.com/ownership?language=${locale}#${token}`;
}
