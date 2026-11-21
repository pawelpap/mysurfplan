import {ownershipLink} from '../school-ownership.mjs';
import {supportEmail} from './template.mjs';
export const ownershipEmailCopy=Object.freeze({
 'en-GB':{
  claimTitle:'Your school workspace claim was approved',transferTitle:'School workspace ownership offer',
  claimBody:'MyWavePlan approved your claim. Review the offer and the school agreement before accepting ownership of this school workspace in MyWavePlan.',
  transferBody:'The current owner has offered you ownership of a school workspace in MyWavePlan. Review the school, responsibilities and agreement before accepting.',
  review:'Review ownership offer',expiry:'This offer expires in seven days. Sign in with this verified email address. Opening this email or signing in does not accept the offer.',
  scope:'Ownership concerns the school workspace in MyWavePlan. It does not establish legal ownership of the school business.',
  newTitle:'School workspace ownership accepted',previousTitle:'School workspace ownership transferred',
  newBody:'You accepted ownership of the school workspace “{school}” in MyWavePlan.',
  previousBody:'Ownership of the school workspace “{school}” in MyWavePlan has transferred. Your existing administrator or instructor access, if any, is unchanged.',
  security:'If you did not expect this change, contact support@mywaveplan.com.'},
 'pt-PT':{
  claimTitle:'O seu pedido de titularidade foi aprovado',transferTitle:'Proposta de titularidade do espaço da escola',
  claimBody:'O MyWavePlan aprovou o seu pedido. Consulte a proposta e o acordo da escola antes de aceitar a titularidade deste espaço da escola no MyWavePlan.',
  transferBody:'O titular atual propôs transferir-lhe a titularidade de um espaço de escola no MyWavePlan. Consulte a escola, as responsabilidades e o acordo antes de aceitar.',
  review:'Consultar proposta de titularidade',expiry:'Esta proposta expira em sete dias. Entre com este endereço de email verificado. Abrir este email ou iniciar sessão não significa aceitar a proposta.',
  scope:'A titularidade diz respeito ao espaço da escola no MyWavePlan. Não estabelece a propriedade legal da empresa.',
  newTitle:'Titularidade do espaço da escola aceite',previousTitle:'Titularidade do espaço da escola transferida',
  newBody:'Aceitou a titularidade do espaço da escola «{school}» no MyWavePlan.',
  previousBody:'A titularidade do espaço da escola «{school}» no MyWavePlan foi transferida. O seu acesso existente como administrador ou instrutor, caso exista, mantém-se.',
  security:'Se não esperava esta alteração, contacte support@mywaveplan.com.'},
 es:{
  claimTitle:'Tu solicitud de titularidad fue aprobada',transferTitle:'Propuesta de titularidad del espacio de la escuela',
  claimBody:'MyWavePlan aprobó tu solicitud. Revisa la propuesta y el acuerdo de la escuela antes de aceptar la titularidad de este espacio de la escuela en MyWavePlan.',
  transferBody:'El titular actual te ha propuesto la titularidad de un espacio de escuela en MyWavePlan. Revisa la escuela, las responsabilidades y el acuerdo antes de aceptar.',
  review:'Revisar propuesta de titularidad',expiry:'Esta propuesta caduca en siete días. Inicia sesión con este correo verificado. Abrir este correo o iniciar sesión no acepta la propuesta.',
  scope:'La titularidad se refiere al espacio de la escuela en MyWavePlan. No establece la propiedad legal de la empresa.',
  newTitle:'Titularidad del espacio de la escuela aceptada',previousTitle:'Titularidad del espacio de la escuela transferida',
  newBody:'Has aceptado la titularidad del espacio de la escuela «{school}» en MyWavePlan.',
  previousBody:'La titularidad del espacio de la escuela «{school}» en MyWavePlan se ha transferido. Tu acceso existente como administrador o instructor, si lo tienes, no cambia.',
  security:'Si no esperabas este cambio, contacta con support@mywaveplan.com.'},
 fr:{
  claimTitle:'Votre demande de propriété a été approuvée',transferTitle:'Proposition de propriété de l’espace de l’école',
  claimBody:'MyWavePlan a approuvé votre demande. Consultez la proposition et l’accord de l’école avant d’accepter la propriété de cet espace de l’école dans MyWavePlan.',
  transferBody:'Le propriétaire actuel vous propose la propriété d’un espace d’école dans MyWavePlan. Consultez l’école, les responsabilités et l’accord avant d’accepter.',
  review:'Consulter la proposition de propriété',expiry:'Cette proposition expire dans sept jours. Connectez-vous avec cette adresse e-mail vérifiée. Ouvrir cet e-mail ou se connecter ne vaut pas acceptation.',
  scope:'La propriété concerne l’espace de l’école dans MyWavePlan. Elle n’établit pas la propriété juridique de l’entreprise.',
  newTitle:'Propriété de l’espace de l’école acceptée',previousTitle:'Propriété de l’espace de l’école transférée',
  newBody:'Vous avez accepté la propriété de l’espace de l’école « {school} » dans MyWavePlan.',
  previousBody:'La propriété de l’espace de l’école « {school} » dans MyWavePlan a été transférée. Vos accès existants en tant qu’administrateur ou moniteur, le cas échéant, restent inchangés.',
  security:'Si vous n’attendiez pas ce changement, contactez support@mywaveplan.com.'},
});
export function ownershipEmail(job,config,payload){
 const c=ownershipEmailCopy[payload.locale];if(!c)throw new Error('ownership_locale_invalid');
 const offer=job.type==='email.ownership_offer';
 if(offer){const title=payload.kind==='claim'?c.claimTitle:c.transferTitle;
  return {title,...supportEmail({title,paragraphs:[payload.kind==='claim'?c.claimBody:c.transferBody,c.scope],afterAction:c.expiry,
   action:{label:c.review,url:ownershipLink(config.environment,payload.token,payload.locale)},language:payload.locale,staging:config.environment==='staging'})};}
 const title=payload.audience==='new'?c.newTitle:c.previousTitle;
 return {title,...supportEmail({title,paragraphs:[(payload.audience==='new'?c.newBody:c.previousBody).replace('{school}',payload.schoolName),c.scope,c.security],language:payload.locale,staging:config.environment==='staging'})};
}
