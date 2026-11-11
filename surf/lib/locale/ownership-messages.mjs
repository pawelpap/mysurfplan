// Ownership interface copy. Order: en-GB, pt-PT, es, fr.
// Format {date} in the active locale with timezone; format {roles} as a localised list.
// Render interpolated values as text, never HTML. No secret values belong in copy.
const rows = {
 'ownership.back':['Back','Voltar','Volver','Retour'],
 'ownership.openEmail':['Open the original ownership email link to review the offer.','Abra a ligação do email original de titularidade para consultar a proposta.','Abre el enlace del correo original de titularidad para revisar la propuesta.','Ouvrez le lien de l’e-mail original de propriété pour consulter la proposition.'],
 'ownership.formerOwnerRoles':['The former owner keeps these existing roles: {roles}.','O titular anterior mantém estas funções atuais: {roles}.','El titular anterior conserva estas funciones actuales: {roles}.','L’ancien propriétaire conserve ces rôles existants : {roles}.'],
 'ownership.findSchools':['Find school','Procurar escola','Buscar escuela','Rechercher une école'],
 'ownership.clearSearch':['Clear search','Limpar pesquisa','Borrar búsqueda','Effacer la recherche'],
 'ownership.support':['Contact support','Contactar o apoio','Contactar con soporte','Contacter l’assistance'],

  "ownership.title": ["School ownership", "Titularidade da escola", "Titularidad de la escuela", "Propriété de l’école"],
  "ownership.scope": ["These actions manage ownership of the school workspace in MyWavePlan.", "Estas ações gerem a titularidade do espaço da escola no MyWavePlan.", "Estas acciones gestionan la titularidad del espacio de la escuela en MyWavePlan.", "Ces actions gèrent la propriété de l’espace de l’école dans MyWavePlan."],
  "ownership.myClaims": ["Your claims", "Os seus pedidos", "Tus solicitudes", "Vos demandes"],
  "ownership.reviewQueue": ["Review claims", "Analisar pedidos", "Revisar solicitudes", "Examiner les demandes"],
  "ownership.noClaims": ["You have no ownership claims.", "Não tem pedidos de titularidade.", "No tienes solicitudes de titularidad.", "Vous n’avez aucune demande de propriété."],
  "ownership.noReviews": ["No claims need review.", "Não existem pedidos por analisar.", "No hay solicitudes pendientes de revisión.", "Aucune demande à examiner."],
  "ownership.selectSchool": ["Choose a school", "Escolha uma escola", "Elige una escuela", "Choisissez une école"],
  "ownership.claimant": ["Claimant", "Requerente", "Solicitante", "Demandeur"],
  "ownership.review": ["Review claim", "Analisar pedido", "Revisar solicitud", "Examiner la demande"],
  "ownership.claimCompleted": ["Claim completed", "Pedido concluído", "Solicitud completada", "Demande terminée"],
  "ownership.verifiedRequired": ["Use a verified account to submit an ownership claim.", "Use uma conta verificada para enviar um pedido de titularidade.", "Usa una cuenta verificada para enviar una solicitud de titularidad.", "Utilisez un compte vérifié pour envoyer une demande de propriété."],
  "ownership.withdrawn": ["Withdrawn", "Retirado", "Retirada", "Retirée"],
  "ownership.submitted": ["Awaiting review", "A aguardar análise", "Pendiente de revisión", "En attente d’examen"],
  "ownership.approved": ["Offer approved", "Proposta aprovada", "Propuesta aprobada", "Proposition approuvée"],
  "ownership.rejected": ["Rejected", "Recusado", "Rechazada", "Refusée"],
  "ownership.completed": ["Completed", "Concluído", "Completada", "Terminée"],
  "ownership.decisionReason": ["Review outcome", "Resultado da análise", "Resultado de la revisión", "Résultat de l’examen"],
  "ownership.recipientAccount": ["Receiving account", "Conta que recebe a titularidade", "Cuenta que recibe la titularidad", "Compte destinataire"],
  "ownership.recipientRoles": ["Existing recipient roles: {roles}.", "Funções atuais do destinatário: {roles}.", "Funciones actuales del destinatario: {roles}.", "Rôles actuels du destinataire : {roles}."],
  "ownership.offerSent": ["The ownership offer is ready. Delivery status is shown below.", "A proposta de titularidade está pronta. O estado do envio é apresentado abaixo.", "La propuesta de titularidad está lista. El estado del envío aparece abajo.", "La proposition de propriété est prête. L’état de l’envoi figure ci-dessous."],
  "ownership.reissueReview": ["Send a new offer to {email} for {school}? The previous link will stop working.", "Enviar uma nova proposta a {email} para {school}? O link anterior deixará de funcionar.", "¿Enviar una nueva propuesta a {email} para {school}? El enlace anterior dejará de funcionar.", "Envoyer une nouvelle proposition à {email} pour {school} ? Le lien précédent cessera de fonctionner."],
  "ownership.noOwner": ["No confirmed workspace owner", "Sem titular confirmado do espaço da escola", "Sin titular confirmado del espacio de la escuela", "Aucun propriétaire confirmé pour cet espace"],
  "ownership.readOnly": ["Only the current owner can send or manage a transfer offer.", "Só o titular atual pode enviar ou gerir uma proposta de transferência.", "Solo el titular actual puede enviar o gestionar una propuesta de transferencia.", "Seul le propriétaire actuel peut envoyer ou gérer une proposition de transfert."],
  'ownership.claimTitle': [
    'Claim an existing school',
    'Pedir a titularidade de uma escola',
    'Solicitar la titularidad de una escuela',
    'Demander la propriété d’une école',
  ],
  'ownership.claimCatalogueHelp': [
    'Choose the school you are authorised to represent. Only schools eligible for a claim are listed.',
    'Escolha a escola que tem autorização para representar. Só aparecem escolas elegíveis para este pedido.',
    'Elige la escuela que tienes autorización para representar. Solo aparecen escuelas que admiten esta solicitud.',
    'Choisissez l’école que vous êtes autorisé à représenter. Seules les écoles ouvertes à cette demande sont affichées.',
  ],
  'ownership.claimSearch': [
    'School name', 'Nome da escola', 'Nombre de la escuela', 'Nom de l’école',
  ],
  'ownership.claimEmpty': [
    'No eligible school found. Contact support if you need help identifying an existing school.',
    'Não foi encontrada nenhuma escola elegível. Contacte o apoio se precisar de ajuda para identificar uma escola existente.',
    'No se ha encontrado ninguna escuela disponible. Contacta con soporte si necesitas ayuda para identificar una escuela existente.',
    'Aucune école admissible trouvée. Contactez l’assistance si vous avez besoin d’aide pour identifier une école existante.',
  ],
  'ownership.statement': [
    'Why can you represent this school?',
    'Porque tem autorização para representar esta escola?',
    '¿Por qué tienes autorización para representar esta escuela?',
    'Pourquoi êtes-vous autorisé à représenter cette école ?',
  ],
  'ownership.statementHelp': [
    'Briefly explain your connection to the school. Do not include passwords, identity documents or student information.',
    'Explique brevemente a sua ligação à escola. Não inclua palavras-passe, documentos de identificação nem informações sobre alunos.',
    'Explica brevemente tu relación con la escuela. No incluyas contraseñas, documentos de identidad ni información del alumnado.',
    'Expliquez brièvement votre lien avec l’école. N’incluez aucun mot de passe, document d’identité ni renseignement sur les élèves.',
  ],
  'ownership.charactersRemaining': [
    'Characters remaining: {count}', 'Caracteres restantes: {count}',
    'Caracteres restantes: {count}', 'Caractères restants : {count}',
  ],
  'ownership.submitClaim': [
    'Submit claim', 'Enviar pedido', 'Enviar solicitud', 'Envoyer la demande',
  ],
  'ownership.claimSubmitted': [
    'Claim submitted', 'Pedido enviado', 'Solicitud enviada', 'Demande envoyée',
  ],
  'ownership.claimNoAccess': [
    'Submitting a claim does not give you access to this school. MyWavePlan will review your request.',
    'Enviar um pedido não lhe dá acesso a esta escola. A MyWavePlan irá analisar o pedido.',
    'Enviar una solicitud no te da acceso a esta escuela. MyWavePlan revisará la solicitud.',
    'L’envoi d’une demande ne vous donne pas accès à cette école. MyWavePlan examinera votre demande.',
  ],
  'ownership.claimStatus': [
    'Your claim', 'O seu pedido', 'Tu solicitud', 'Votre demande',
  ],
  'ownership.withdrawClaim': [
    'Withdraw claim', 'Retirar pedido', 'Retirar solicitud', 'Retirer la demande',
  ],
  'ownership.withdrawReview': [
    'Withdraw your claim for {school}? This ends the request without changing school access.',
    'Retirar o seu pedido para {school}? O pedido será encerrado sem alterar o acesso à escola.',
    '¿Retirar tu solicitud para {school}? La solicitud finalizará sin cambiar el acceso a la escuela.',
    'Retirer votre demande pour {school} ? La demande prendra fin sans modifier l’accès à l’école.',
  ],
  'ownership.claimWithdrawn': [
    'Claim withdrawn', 'Pedido retirado', 'Solicitud retirada', 'Demande retirée',
  ],
  'ownership.claimApproved': [
    'Your claim was approved for the next step. Open the ownership offer sent to your account email to review and accept it. You do not have owner access yet.',
    'O seu pedido foi aprovado para a etapa seguinte. Abra a proposta de titularidade enviada para o email da sua conta para a consultar e aceitar. Ainda não tem acesso como titular.',
    'Tu solicitud ha sido aprobada para el siguiente paso. Abre la propuesta de titularidad enviada al correo de tu cuenta para revisarla y aceptarla. Aún no tienes acceso como titular.',
    'Votre demande a été approuvée pour l’étape suivante. Ouvrez la proposition de propriété envoyée à l’adresse de votre compte pour l’examiner et l’accepter. Vous n’avez pas encore les accès du propriétaire.',
  ],
  'ownership.claimRejected': [
    'Claim not approved', 'Pedido não aprovado', 'Solicitud no aprobada', 'Demande non approuvée',
  ],
  'ownership.claimExpired': [
    'Claim expired', 'Pedido expirado', 'Solicitud caducada', 'Demande expirée',
  ],
  'ownership.claimSuperseded': [
    'This claim is no longer current. Check its latest status or contact support.',
    'Este pedido já não está em vigor. Consulte o estado mais recente ou contacte o apoio.',
    'Esta solicitud ya no está vigente. Consulta su estado actual o contacta con soporte.',
    'Cette demande n’est plus en cours. Consultez son dernier état ou contactez l’assistance.',
  ],
  'ownership.reviewTitle': [
    'Ownership claim review', 'Análise do pedido de titularidade',
    'Revisión de la solicitud de titularidad', 'Examen de la demande de propriété',
  ],
  'ownership.reviewReason': [
    'Reason shared with the claimant', 'Motivo partilhado com o requerente',
    'Motivo que verá el solicitante', 'Motif communiqué au demandeur',
  ],
  'ownership.reviewReasonHelp': [
    'Give a short, clear reason. Do not include internal notes or information about other claimants.',
    'Indique um motivo breve e claro. Não inclua notas internas nem informações sobre outros requerentes.',
    'Indica un motivo breve y claro. No incluyas notas internas ni información sobre otros solicitantes.',
    'Indiquez un motif bref et clair. N’incluez aucune note interne ni information sur d’autres demandeurs.',
  ],
  'ownership.caseReference': [
    'Internal support case reference', 'Referência interna do caso de apoio',
    'Referencia interna del caso de soporte', 'Référence interne du dossier d’assistance',
  ],
  'ownership.approveOffer': [
    'Approve and send offer', 'Aprovar e enviar proposta',
    'Aprobar y enviar propuesta', 'Approuver et envoyer la proposition',
  ],
  'ownership.rejectClaim': [
    'Reject claim', 'Recusar pedido', 'Rechazar solicitud', 'Refuser la demande',
  ],
  'ownership.approvalNoAccess': [
    'Approval sends an ownership offer. It does not give access until the claimant accepts.',
    'A aprovação envia uma proposta de titularidade. O acesso só é concedido quando o requerente a aceitar.',
    'La aprobación envía una propuesta de titularidad. El acceso solo se concede cuando el solicitante la acepta.',
    'L’approbation envoie une proposition de propriété. Elle ne donne aucun accès tant que le demandeur ne l’a pas acceptée.',
  ],
  'ownership.selfReview': [
    'Another platform reviewer must review your claim.',
    'Outro responsável da plataforma tem de analisar o seu pedido.',
    'Otro revisor de la plataforma debe revisar tu solicitud.',
    'Un autre responsable de la plateforme doit examiner votre demande.',
  ],
  'ownership.transferTitle': [
    'Transfer school ownership', 'Transferir a titularidade da escola',
    'Transferir la titularidad de la escuela', 'Transférer la propriété de l’école',
  ],
  'ownership.recipientEmail': [
    'Recipient email', 'Email do destinatário', 'Correo del destinatario', 'Adresse e-mail du destinataire',
  ],
  'ownership.recipientHelp': [
    'Enter the exact email of an existing verified account. Ask the recipient to register and verify their account first if needed.',
    'Introduza o email exato de uma conta existente e verificada. Se necessário, peça ao destinatário que se registe e verifique a conta primeiro.',
    'Introduce el correo exacto de una cuenta existente y verificada. Si hace falta, pide al destinatario que se registre y verifique su cuenta primero.',
    'Saisissez l’adresse exacte d’un compte existant et vérifié. Si nécessaire, demandez au destinataire de s’inscrire et de vérifier son compte au préalable.',
  ],
  'ownership.reviewTransfer': [
    'Review transfer', 'Rever transferência', 'Revisar transferencia', 'Vérifier le transfert',
  ],
  'ownership.transferConfirm': [
    'I confirm that I want to offer ownership of {school} to {email}, with the consequences described above.',
    'Confirmo que quero propor a transferência da titularidade de {school} para {email}, com as consequências descritas acima.',
    'Confirmo que quiero proponer la transferencia de la titularidad de {school} a {email}, con las consecuencias descritas anteriormente.',
    'Je confirme vouloir proposer le transfert de la propriété de {school} à {email}, avec les conséquences décrites ci-dessus.',
  ],
  'ownership.currentOwner': [
    'Current owner', 'Titular atual', 'Titular actual', 'Propriétaire actuel',
  ],
  'ownership.remainOwner': [
    'You remain the owner until the recipient accepts. After acceptance, you will no longer be the owner.',
    'Continua a ser titular até o destinatário aceitar. Após a aceitação, deixará de ser titular.',
    'Sigues siendo titular hasta que el destinatario acepte. Después de la aceptación, dejarás de ser titular.',
    'Vous restez propriétaire jusqu’à l’acceptation du destinataire. Après cette acceptation, vous ne serez plus propriétaire.',
  ],
  'ownership.retainedRoles': [
    'Your existing roles will remain: {roles}. Ownership changes separately.',
    'As suas funções atuais serão mantidas: {roles}. A titularidade muda separadamente.',
    'Tus funciones actuales se mantendrán: {roles}. La titularidad cambia por separado.',
    'Vos rôles actuels seront conservés : {roles}. La propriété change séparément.',
  ],
  'ownership.noAddedRoles': [
    'This transfer does not add an administrator or instructor role. Any other existing access remains subject to its own permissions.',
    'Esta transferência não acrescenta funções de administração ou de instrução. Qualquer outro acesso existente continua sujeito às respetivas permissões.',
    'Esta transferencia no añade funciones de administración ni de instrucción. Cualquier otro acceso existente sigue sujeto a sus propios permisos.',
    'Ce transfert n’ajoute aucun rôle d’administrateur ou de moniteur. Tout autre accès existant reste soumis à ses propres autorisations.',
  ],
  'ownership.currentPassword': [
    'Your current password', 'A sua palavra-passe atual', 'Tu contraseña actual', 'Votre mot de passe actuel',
  ],
  'ownership.sendOffer': [
    'Send ownership offer', 'Enviar proposta de titularidade',
    'Enviar propuesta de titularidad', 'Envoyer la proposition de propriété',
  ],
  'ownership.offerPending': [
    'Waiting for the recipient to accept', 'A aguardar a aceitação do destinatário',
    'Pendiente de aceptación del destinatario', 'En attente de l’acceptation du destinataire',
  ],
  'ownership.offerExpires': [
    'Expires: {date}', 'Expira em: {date}', 'Caduca: {date}', 'Expiration : {date}',
  ],
  'ownership.cancelOffer': [
    'Cancel ownership offer', 'Cancelar proposta de titularidade',
    'Cancelar propuesta de titularidad', 'Annuler la proposition de propriété',
  ],
  'ownership.cancelOfferReview': [
    'Cancel the offer to {email} for {school}? Its link will stop working. Current ownership will not change.',
    'Cancelar a proposta para {email} relativa a {school}? A ligação deixará de funcionar. A titularidade atual não muda.',
    '¿Cancelar la propuesta para {email} de {school}? El enlace dejará de funcionar. La titularidad actual no cambiará.',
    'Annuler la proposition adressée à {email} pour {school} ? Son lien ne fonctionnera plus. La propriété actuelle ne changera pas.',
  ],
  'ownership.reissueOffer': [
    'Send a new offer', 'Enviar nova proposta', 'Enviar una nueva propuesta', 'Envoyer une nouvelle proposition',
  ],
  'ownership.reissueHelp': [
    'The earlier link will stop working. The recipient must use the new email.',
    'A ligação anterior deixará de funcionar. O destinatário terá de usar o novo email.',
    'El enlace anterior dejará de funcionar. El destinatario deberá usar el nuevo correo.',
    'Le lien précédent ne fonctionnera plus. Le destinataire devra utiliser le nouvel e-mail.',
  ],
  'ownership.offerCancelled': [
    'Ownership offer cancelled', 'Proposta de titularidade cancelada',
    'Propuesta de titularidad cancelada', 'Proposition de propriété annulée',
  ],
  'ownership.deliveryQueued': [
    'The email is queued for sending.', 'O email está em espera para envio.',
    'El correo está en cola para su envío.', 'L’e-mail est en attente d’envoi.',
  ],
  'ownership.deliverySent': [
    'The email was sent. This does not confirm that the recipient has received or read it.',
    'O email foi enviado. Isto não confirma que o destinatário o recebeu ou leu.',
    'El correo se ha enviado. Esto no confirma que el destinatario lo haya recibido o leído.',
    'L’e-mail a été envoyé. Cela ne confirme pas que le destinataire l’a reçu ou lu.',
  ],
  'ownership.deliveryUnknown': [
    'Email delivery could not be confirmed. Check the latest status before sending a new offer.',
    'Não foi possível confirmar a entrega do email. Consulte o estado mais recente antes de enviar uma nova proposta.',
    'No se ha podido confirmar la entrega del correo. Comprueba el estado actual antes de enviar una nueva propuesta.',
    'La remise de l’e-mail n’a pas pu être confirmée. Vérifiez le dernier état avant d’envoyer une nouvelle proposition.',
  ],
  'ownership.deliveryFailed': [
    'The email could not be sent. Check the latest status or contact support. A completed ownership change is not undone by an email failure.',
    'Não foi possível enviar o email. Consulte o estado mais recente ou contacte o apoio. Uma falha no email não anula uma alteração de titularidade concluída.',
    'No se ha podido enviar el correo. Comprueba el estado actual o contacta con soporte. Un fallo del correo no anula un cambio de titularidad completado.',
    'L’e-mail n’a pas pu être envoyé. Vérifiez le dernier état ou contactez l’assistance. Un échec d’envoi n’annule pas un changement de propriété déjà effectué.',
  ],
  'ownership.acceptTitle': [
    'Accept school ownership', 'Aceitar a titularidade da escola',
    'Aceptar la titularidad de la escuela', 'Accepter la propriété de l’école',
  ],
  'ownership.claimOfferHelp': [
    'Your claim for {school} has been reviewed. Read the responsibilities and required agreement before accepting ownership.',
    'O seu pedido relativo a {school} foi analisado. Leia as responsabilidades e o acordo obrigatório antes de aceitar a titularidade.',
    'Tu solicitud para {school} ha sido revisada. Lee las responsabilidades y el acuerdo obligatorio antes de aceptar la titularidad.',
    'Votre demande pour {school} a été examinée. Lisez les responsabilités et l’accord requis avant d’accepter la propriété.',
  ],
  'ownership.transferOfferHelp': [
    'The current owner has offered to transfer {school} to you. Read the consequences and required agreement before accepting.',
    'O titular atual propôs transferir-lhe a titularidade de {school}. Leia as consequências e o acordo obrigatório antes de aceitar.',
    'El titular actual ha propuesto transferirte la titularidad de {school}. Lee las consecuencias y el acuerdo obligatorio antes de aceptar.',
    'Le propriétaire actuel vous propose de devenir propriétaire de {school}. Lisez les conséquences et l’accord requis avant d’accepter.',
  ],
  'ownership.signedInAs': [
    'Signed in as {email}', 'Sessão iniciada como {email}',
    'Sesión iniciada como {email}', 'Compte connecté : {email}',
  ],
  'ownership.requiredAgreement': [
    'Required school agreement', 'Acordo obrigatório da escola',
    'Acuerdo obligatorio de la escuela', 'Accord requis pour l’école',
  ],
  'ownership.agreementVersion': [
    'Version: {version}', 'Versão: {version}', 'Versión: {version}', 'Version : {version}',
  ],
  'ownership.agreementLanguage': [
    'Document language: {language}', 'Idioma do documento: {language}',
    'Idioma del documento: {language}', 'Langue du document : {language}',
  ],
  'ownership.reviewDocument': [
    'Read the agreement', 'Ler o acordo', 'Leer el acuerdo', 'Lire l’accord',
  ],
  'ownership.acceptConfirm': [
    'I accept ownership of this school and the responsibilities described above.',
    'Aceito a titularidade desta escola e as responsabilidades descritas acima.',
    'Acepto la titularidad de esta escuela y las responsabilidades descritas anteriormente.',
    'J’accepte la propriété de cette école et les responsabilités décrites ci-dessus.',
  ],
  'ownership.representationConfirm': [
    'I confirm that I am authorised to represent this school.',
    'Confirmo que tenho autorização para representar esta escola.',
    'Confirmo que tengo autorización para representar esta escuela.',
    'Je confirme être autorisé à représenter cette école.',
  ],
  'ownership.agreementConfirm': [
    'I have read and accept the school agreement shown above.',
    'Li e aceito o acordo da escola apresentado acima.',
    'He leído y acepto el acuerdo de la escuela que se muestra arriba.',
    'J’ai lu et j’accepte l’accord de l’école présenté ci-dessus.',
  ],
  'ownership.accept': [
    'Accept ownership', 'Aceitar a titularidade', 'Aceptar la titularidad', 'Accepter la propriété',
  ],
  'ownership.decline': [
    'Decline offer', 'Recusar proposta', 'Rechazar propuesta', 'Refuser la proposition',
  ],
  'ownership.declineReview': [
    'Decline ownership of {school}? You will not gain owner access through this offer.',
    'Recusar a titularidade de {school}? Não receberá acesso como titular através desta proposta.',
    '¿Rechazar la titularidad de {school}? No obtendrás acceso como titular mediante esta propuesta.',
    'Refuser la propriété de {school} ? Vous n’obtiendrez pas les accès du propriétaire par cette proposition.',
  ],
  'ownership.accepted': [
    'Ownership accepted', 'Titularidade aceite', 'Titularidad aceptada', 'Propriété acceptée',
  ],
  'ownership.declined': [
    'Ownership offer declined', 'Proposta de titularidade recusada',
    'Propuesta de titularidad rechazada', 'Proposition de propriété refusée',
  ],
  'ownership.wrongAccount': [
    'This offer is not available to the account you are using. Sign in with the account that received the email.',
    'Esta proposta não está disponível para a conta que está a usar. Inicie sessão com a conta que recebeu o email.',
    'Esta propuesta no está disponible para la cuenta que estás usando. Inicia sesión con la cuenta que recibió el correo.',
    'Cette proposition n’est pas disponible pour le compte utilisé. Connectez-vous avec le compte qui a reçu l’e-mail.',
  ],
  'ownership.useAnotherAccount': [
    'Use another account', 'Usar outra conta', 'Usar otra cuenta', 'Utiliser un autre compte',
  ],
  'ownership.signIn': [
    'Sign in to review offer', 'Iniciar sessão para ver a proposta',
    'Iniciar sesión para ver la propuesta', 'Se connecter pour consulter la proposition',
  ],
  'ownership.signInHelp': [
    'Use the account that received the email. Signing in does not accept ownership.',
    'Use a conta que recebeu o email. Iniciar sessão não equivale a aceitar a titularidade.',
    'Usa la cuenta que recibió el correo. Iniciar sesión no implica aceptar la titularidad.',
    'Utilisez le compte qui a reçu l’e-mail. La connexion ne vaut pas acceptation de la propriété.',
  ],
  'ownership.reopenEmail': [
    'The offer could not be kept open during sign-in. After signing in, reopen the original email link.',
    'Não foi possível manter a proposta aberta durante o início de sessão. Depois de iniciar sessão, abra novamente a ligação do email original.',
    'No se ha podido mantener abierta la propuesta durante el inicio de sesión. Después de iniciar sesión, vuelve a abrir el enlace del correo original.',
    'La proposition n’a pas pu rester ouverte pendant la connexion. Après vous être connecté, rouvrez le lien de l’e-mail d’origine.',
  ],
  'ownership.offerExpired': [
    'This ownership offer has expired. Ask the sender for a new offer.',
    'Esta proposta de titularidade expirou. Peça uma nova proposta ao remetente.',
    'Esta propuesta de titularidad ha caducado. Pide una nueva propuesta al remitente.',
    'Cette proposition de propriété a expiré. Demandez une nouvelle proposition à l’expéditeur.',
  ],
  'ownership.offerRevoked': [
    'This ownership offer is no longer available. Check the latest status or contact support.',
    'Esta proposta de titularidade já não está disponível. Consulte o estado mais recente ou contacte o apoio.',
    'Esta propuesta de titularidad ya no está disponible. Comprueba el estado actual o contacta con soporte.',
    'Cette proposition de propriété n’est plus disponible. Vérifiez le dernier état ou contactez l’assistance.',
  ],
  'ownership.offerCompleted': [
    'This offer was already completed. Your current access depends on the school’s latest permissions.',
    'Esta proposta já foi concluída. O seu acesso atual depende das permissões mais recentes da escola.',
    'Esta propuesta ya se completó. Tu acceso actual depende de los permisos vigentes de la escuela.',
    'Cette proposition a déjà été finalisée. Votre accès actuel dépend des dernières autorisations de l’école.',
  ],
  'ownership.agreementChanged': [
    'The required school agreement has changed. Review it again before accepting ownership.',
    'O acordo obrigatório da escola mudou. Leia-o novamente antes de aceitar a titularidade.',
    'El acuerdo obligatorio de la escuela ha cambiado. Revísalo de nuevo antes de aceptar la titularidad.',
    'L’accord requis pour l’école a changé. Relisez-le avant d’accepter la propriété.',
  ],
  'ownership.closureTitle': [
    'School closure', 'Encerramento da escola', 'Cierre de la escuela', 'Fermeture de l’école',
  ],
  'ownership.closureHelp': [
    'Contact support to close this school. Support will review outstanding lessons and bookings. Opening an email does not submit or complete a closure request.',
    'Contacte o apoio para encerrar esta escola. O apoio irá analisar as aulas e reservas pendentes. Abrir um email não envia nem conclui um pedido de encerramento.',
    'Contacta con soporte para cerrar esta escuela. Soporte revisará las clases y reservas pendientes. Abrir un correo no envía ni completa una solicitud de cierre.',
    'Contactez l’assistance pour fermer cette école. Elle examinera les cours et réservations en cours ou à venir. Ouvrir un e-mail n’envoie ni ne finalise une demande de fermeture.',
  ],
  'ownership.closureSupport': [
    'Contact support about school closure', 'Contactar o apoio sobre o encerramento da escola',
    'Contactar con soporte sobre el cierre de la escuela', 'Contacter l’assistance pour fermer l’école',
  ],
  'ownership.closureNotErasure': [
    'School closure does not erase school records or your personal booking history. Closing your personal account and requesting data erasure are separate processes.',
    'O encerramento da escola não apaga os registos da escola nem o seu histórico pessoal de reservas. Encerrar a sua conta pessoal e pedir o apagamento de dados são processos separados.',
    'El cierre de la escuela no borra sus registros ni tu historial personal de reservas. Cerrar tu cuenta personal y solicitar la supresión de datos son procesos distintos.',
    'La fermeture de l’école n’efface ni ses dossiers ni votre historique personnel de réservations. La fermeture de votre compte personnel et la demande d’effacement des données sont des démarches distinctes.',
  ],
  'ownership.invalid': [
    'Check the information and required confirmations before continuing.',
    'Verifique as informações e as confirmações obrigatórias antes de continuar.',
    'Revisa la información y las confirmaciones obligatorias antes de continuar.',
    'Vérifiez les informations et les confirmations requises avant de continuer.',
  ],
  'ownership.conflict': [
    'Ownership details changed. Review the latest information before continuing.',
    'Os dados de titularidade mudaram. Consulte as informações mais recentes antes de continuar.',
    'Los datos de titularidad han cambiado. Revisa la información actual antes de continuar.',
    'Les informations de propriété ont changé. Consultez les dernières informations avant de continuer.',
  ],
  'ownership.forbidden': [
    'This action is not available to your account.',
    'Esta ação não está disponível para a sua conta.',
    'Esta acción no está disponible para tu cuenta.',
    'Cette action n’est pas disponible pour votre compte.',
  ],
  'ownership.unavailable': [
    'This service is temporarily unavailable. Check the latest status before trying again.',
    'Este serviço está temporariamente indisponível. Consulte o estado mais recente antes de tentar novamente.',
    'Este servicio no está disponible temporalmente. Comprueba el estado actual antes de volver a intentarlo.',
    'Ce service est temporairement indisponible. Vérifiez le dernier état avant de réessayer.',
  ],
  'ownership.recipientUnavailable': [
    'This account cannot receive ownership. Check the email and ask the recipient to register and verify their account.',
    'Não é possível transferir a titularidade para esta conta. Verifique o email e peça ao destinatário que se registe e verifique a conta.',
    'No se puede transferir la titularidad a esta cuenta. Comprueba el correo y pide al destinatario que se registre y verifique su cuenta.',
    'La propriété ne peut pas être transférée à ce compte. Vérifiez l’adresse e-mail et demandez au destinataire de s’inscrire et de vérifier son compte.',
  ],
  'ownership.passwordError': [
    'Your current password could not be confirmed. Enter it again.',
    'Não foi possível confirmar a sua palavra-passe atual. Introduza-a novamente.',
    'No se ha podido confirmar tu contraseña actual. Introdúcela de nuevo.',
    'Votre mot de passe actuel n’a pas pu être confirmé. Saisissez-le à nouveau.',
  ],
  'ownership.rateLimited': [
    'Too many attempts. Wait before trying again.',
    'Demasiadas tentativas. Aguarde antes de tentar novamente.',
    'Demasiados intentos. Espera antes de volver a intentarlo.',
    'Trop de tentatives. Patientez avant de réessayer.',
  ],
  'ownership.requiredDocsUnavailable': [
    'The required published agreement is not available. Ownership cannot be accepted yet. Try again later or contact support.',
    'O acordo publicado obrigatório não está disponível. Ainda não é possível aceitar a titularidade. Tente mais tarde ou contacte o apoio.',
    'El acuerdo publicado obligatorio no está disponible. Aún no se puede aceptar la titularidad. Inténtalo más tarde o contacta con soporte.',
    'L’accord publié requis n’est pas disponible. La propriété ne peut pas encore être acceptée. Réessayez plus tard ou contactez l’assistance.',
  ],
  'ownership.busy': [
    'Please wait…', 'Aguarde…', 'Espera…', 'Veuillez patienter…',
  ],
  'ownership.reload': [
    'Review latest status', 'Ver estado mais recente', 'Ver el estado actual', 'Consulter le dernier état',
  ],
  'ownership.tryAgain': [
    'Try again', 'Tentar novamente', 'Volver a intentarlo', 'Réessayer',
  ],
  'ownership.cancel': [
    'Cancel', 'Cancelar', 'Cancelar', 'Annuler',
  ],
  'ownership.exit': [
    'Exit offer', 'Sair da proposta', 'Salir de la propuesta', 'Quitter la proposition',
  ],
};

const locales = ['en-GB', 'pt-PT', 'es', 'fr'];
export const ownershipMessages = Object.freeze(Object.fromEntries(
  locales.map((locale, index) => [locale, Object.freeze(Object.fromEntries(
    Object.entries(rows).map(([key, translations]) => [key, translations[index]]),
  ))]),
));
