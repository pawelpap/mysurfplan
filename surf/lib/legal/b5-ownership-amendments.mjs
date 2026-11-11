// Additive ownership disclosure only. Never rewrite the published B5 .2 bodies.
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { legalContentHash, validateB5LegalBundle } from './b5-legal-preparation.mjs';
import { b5StagingTestIntroduction } from './b5-school-sections.mjs';

export const ownershipPrivacyVersion = '2026-11-11.3';
export const ownershipStagingPrivacyVersion = '2026-11-11.3-staging-test';
export const ownershipSourceBundleHash = 'dbeb17a52dc036e1bfcf5f2fcc28bff51ac3fc7b5b30cd6414d32f67396603cf';
export const ownershipLegalLocales = Object.freeze(['en-GB', 'pt-PT', 'es', 'fr']);

export const ownershipPrivacySections = Object.freeze({
  'en-GB': `## School workspace ownership claims and transfers

When you claim authority to manage an existing school workspace in MyWavePlan, we record your account, the school, your short explanation and the platform review decision and case reference. Platform reviewers check claims manually; submitting a claim does not grant access. For a transfer, the current owner supplies the intended recipient's email address, which we match to a verified account. We record the offer, its expiry and outcome, and use Mailjet to send ownership offers and change notices with the service-email controls described above. These details are needed to process the request. Do not include identity documents or sensitive personal information in a claim explanation.

We provide requested ownership administration under our contract with you. We review representative authority and keep proportionate security and dispute records on the basis of our legitimate interests in protecting school access and resolving disputes. Only the claimant and authorised platform reviewers can see claim explanations; confidential reviewer notes are limited to authorised platform reviewers. Other claimants cannot see them. The bound recipient and current or former owner receive the limited ownership and outcome information needed for their part in the process.

Claim explanations, reviewer reasons and case references, recipient email snapshots and token data become eligible for scheduled cleanup 30 days after the relevant claim or offer reaches a final outcome, including expiry. Cleanup runs in bounded batches; eligibility is not a guarantee of immediate deletion. We separately keep minimal records of the school, acting and affected accounts, decision or ownership change and time, plus the representative declaration and exact agreement acceptance evidence, while needed for school administration, security or legal claims under the retention criteria above. This does not delete existing account details, separate support correspondence or the provider's delivery records.`,
  'pt-PT': `## Pedidos e transferências de titularidade do espaço de trabalho da escola

Quando pede o reconhecimento da sua autoridade para gerir o espaço de trabalho de uma escola existente no MyWavePlan, registamos a sua conta, a escola, uma breve explicação sua, a decisão da plataforma e a referência do processo. Os revisores da plataforma analisam os pedidos manualmente; apresentar um pedido não concede acesso. Numa transferência, o titular atual fornece o endereço de e-mail do destinatário pretendido, que associamos a uma conta verificada. Registamos a proposta, a sua validade e o resultado, e usamos o Mailjet para enviar propostas de titularidade e avisos de alteração com os controlos de e-mail de serviço descritos acima. Estes dados são necessários para tratar o pedido. Não inclua documentos de identificação nem dados pessoais sensíveis na explicação.

Tratamos a administração da titularidade solicitada com base no nosso contrato consigo. Analisamos a autoridade do representante e conservamos registos proporcionais de segurança e de litígios com base nos nossos interesses legítimos em proteger o acesso à escola e resolver litígios. Apenas o requerente e os revisores autorizados da plataforma podem ver as explicações do pedido; as notas confidenciais dos revisores ficam limitadas aos revisores autorizados da plataforma. Outros requerentes não lhes têm acesso. O destinatário associado à proposta e o titular atual ou anterior recebem os dados limitados sobre a titularidade e o resultado necessários à sua participação no processo.

As explicações dos pedidos, os motivos dos revisores e as referências dos processos, as cópias dos endereços de e-mail dos destinatários e os dados dos tokens tornam-se elegíveis para limpeza programada 30 dias após o pedido ou a proposta correspondente atingir um resultado final, incluindo a expiração. A limpeza é feita em lotes limitados; a elegibilidade não garante a eliminação imediata. Conservamos separadamente registos mínimos da escola, das contas intervenientes e afetadas, da decisão ou alteração de titularidade e da data, bem como a declaração do representante e a prova exata de aceitação do acordo, enquanto forem necessários para a administração da escola, a segurança ou ações judiciais, segundo os critérios de conservação acima. Isto não elimina os dados existentes da conta, a correspondência de apoio separada nem os registos de entrega do prestador.`,
  es: `## Solicitudes y transferencias de titularidad del espacio de trabajo de la escuela

Cuando solicita el reconocimiento de su autoridad para gestionar el espacio de trabajo de una escuela existente en MyWavePlan, registramos su cuenta, la escuela, su breve explicación y la decisión de la plataforma y la referencia del expediente. Los revisores de la plataforma examinan las solicitudes manualmente; presentar una solicitud no concede acceso. En una transferencia, el titular actual facilita el correo electrónico del destinatario previsto, que vinculamos a una cuenta verificada. Registramos la propuesta, su caducidad y el resultado, y usamos Mailjet para enviar propuestas de titularidad y avisos de cambio con los controles de correo de servicio descritos anteriormente. Estos datos son necesarios para tramitar la solicitud. No incluya documentos de identidad ni datos personales sensibles en la explicación.

Prestamos la administración de titularidad solicitada en virtud de nuestro contrato con usted. Revisamos la autoridad del representante y conservamos registros proporcionados de seguridad y controversias sobre la base de nuestros intereses legítimos en proteger el acceso a la escuela y resolver controversias. Solo el solicitante y los revisores autorizados de la plataforma pueden ver las explicaciones de la solicitud; las notas confidenciales de los revisores se limitan a los revisores autorizados de la plataforma. Otros solicitantes no pueden verlas. El destinatario vinculado a la propuesta y el titular actual o anterior reciben la información limitada sobre la titularidad y el resultado necesaria para su participación en el proceso.

Las explicaciones de las solicitudes, los motivos de los revisores y las referencias de los expedientes, las copias de los correos electrónicos de los destinatarios y los datos de los tokens pasan a ser elegibles para la limpieza programada 30 días después de que la solicitud o propuesta correspondiente alcance un resultado final, incluida la caducidad. La limpieza se ejecuta en lotes limitados; la elegibilidad no garantiza la eliminación inmediata. Conservamos por separado registros mínimos de la escuela, las cuentas actuantes y afectadas, la decisión o el cambio de titularidad y la fecha, junto con la declaración del representante y la prueba exacta de aceptación del acuerdo, mientras sean necesarios para la administración de la escuela, la seguridad o reclamaciones legales según los criterios de conservación anteriores. Esto no elimina los datos existentes de la cuenta, la correspondencia de soporte separada ni los registros de entrega del proveedor.`,
  fr: `## Demandes et transferts de propriété de l’espace de travail de l’école

Lorsque vous demandez la reconnaissance de votre autorité pour gérer l’espace de travail d’une école existante dans MyWavePlan, nous enregistrons votre compte, l’école, votre brève explication ainsi que la décision de la plateforme et la référence du dossier. Les responsables de la plateforme examinent les demandes manuellement ; déposer une demande n’accorde aucun accès. Pour un transfert, le propriétaire actuel fournit l’adresse e-mail du destinataire prévu, que nous associons à un compte vérifié. Nous enregistrons la proposition, son expiration et son résultat, et utilisons Mailjet pour envoyer les propositions de propriété et les avis de changement avec les contrôles des e-mails de service décrits ci-dessus. Ces informations sont nécessaires au traitement de la demande. N’incluez aucun document d’identité ni donnée personnelle sensible dans l’explication.

Nous assurons l’administration de la propriété demandée dans le cadre de notre contrat avec vous. Nous vérifions l’autorité du représentant et conservons des traces proportionnées de sécurité et de litiges sur la base de nos intérêts légitimes à protéger l’accès à l’école et à résoudre les litiges. Seuls le demandeur et les responsables autorisés de la plateforme peuvent consulter les explications de la demande ; les notes confidentielles des responsables sont réservées aux responsables autorisés de la plateforme. Les autres demandeurs ne peuvent pas les consulter. Le destinataire lié à la proposition et le propriétaire actuel ou précédent reçoivent les informations limitées sur la propriété et le résultat nécessaires à leur participation à la procédure.

Les explications des demandes, les motifs des responsables et les références des dossiers, les copies des adresses e-mail des destinataires et les données des jetons deviennent admissibles au nettoyage programmé 30 jours après le résultat final de la demande ou de la proposition correspondante, y compris son expiration. Le nettoyage s’effectue par lots limités ; cette admissibilité ne garantit pas une suppression immédiate. Nous conservons séparément des traces minimales de l’école, des comptes intervenants et concernés, de la décision ou du changement de propriété et de la date, ainsi que la déclaration du représentant et la preuve exacte d’acceptation de l’accord, tant qu’elles sont nécessaires à l’administration de l’école, à la sécurité ou à des actions en justice, selon les critères de conservation ci-dessus. Cela ne supprime pas les informations existantes du compte, la correspondance d’assistance distincte ni les relevés de livraison du prestataire.`,
});

export function prepareOwnershipPrivacyBundle(sourceBundle) {
  validateB5LegalBundle(sourceBundle);
  const review = ownershipLegalLocales.map(language => {
    const source = sourceBundle.review.find(row => row.document_id === 'mywaveplan.privacy' && row.language === language);
    const content = source.content + '\n\n' + ownershipPrivacySections[language];
    return { document_id: source.document_id, kind: source.kind, version: ownershipPrivacyVersion,
      language, title: source.title, content, content_hash: legalContentHash(content),
      source_version: source.version, source_content_hash: source.content_hash };
  });
  const staging_test = review.map(candidate => {
    const source = sourceBundle.staging_test.find(row => row.document_id === candidate.document_id && row.language === candidate.language);
    const content = b5StagingTestIntroduction[candidate.language] + '\n\n' + candidate.content;
    return { ...candidate, version: ownershipStagingPrivacyVersion, content, content_hash: legalContentHash(content),
      source_version: source.version, source_content_hash: source.content_hash,
      review_version: candidate.version, review_content_hash: candidate.content_hash };
  });
  return { schema: 1, purpose: 'b5-ownership-privacy-only', source_bundle_sha256: ownershipSourceBundleHash,
    review_version: ownershipPrivacyVersion, staging_test_version: ownershipStagingPrivacyVersion, review, staging_test };
}

export function validateOwnershipPrivacyBundle(bundle, sourceBundle) {
  assert(isDeepStrictEqual(bundle, prepareOwnershipPrivacyBundle(sourceBundle)), 'Ownership privacy bundle differs from the exact additive four-language preparation.');
  return bundle;
}
