// Prepared for B5. This module does not change a live document or select a version.
// Publish only after the implementation and the provider agreement are verified.
import { createHash } from 'node:crypto';

export const geoapifyLegalLocales = Object.freeze(['en-GB', 'pt-PT', 'es', 'fr']);

export const geoapifyPrivacySections = Object.freeze({
  'en-GB': `## Optional school-address lookup

When an authorised school representative requests an address lookup, our server sends the entered address and search language to Geoapify (KEPTAGO LTD, Cyprus) to suggest a location. We use its EU API endpoint. We do not add your account identifier, email address or school records to the query, or forward your browser's IP address. Geoapify receives the server's network details. Manual entry remains available.

Geoapify retains request details normally for up to 24 hours; exceptional suspicious or fraudulent activity can require up to two months. See its [processing agreement](https://www.geoapify.com/data-processing-agreement/) and [privacy policy](https://www.geoapify.com/privacy-policy/).

A lookup does not publish the address. School-base location is private by default. It is separate from legal or billing addresses. Saving school-location settings and publishing a school presentation are separate actions. A school can operate without a fixed base. Only the location selected for public display is included in its published presentation.`,
  'pt-PT': `## Pesquisa opcional da morada da escola

Quando um representante autorizado da escola pede uma pesquisa de morada, o nosso servidor envia a morada introduzida e o idioma da pesquisa à Geoapify (KEPTAGO LTD, Chipre) para sugerir uma localização. Utilizamos o seu endpoint de API na UE. Não acrescentamos à pesquisa o identificador da conta, o endereço de e-mail ou registos da escola, nem transmitimos o endereço IP do navegador. A Geoapify recebe os dados de rede do servidor. Continua a ser possível introduzir a localização manualmente.

A Geoapify conserva normalmente os detalhes dos pedidos durante até 24 horas; situações excecionais de atividade suspeita ou fraudulenta podem exigir até dois meses. Consulte o [acordo de tratamento](https://www.geoapify.com/data-processing-agreement/) e a [política de privacidade](https://www.geoapify.com/privacy-policy/).

Uma pesquisa não publica a morada. A localização da base da escola é privada por predefinição e distinta das moradas legais ou de faturação. Guardar as definições de localização e publicar a apresentação da escola são ações distintas. Uma escola pode funcionar sem uma base fixa. Apenas a localização escolhida para divulgação pública é incluída na apresentação publicada.`,
  es: `## Búsqueda opcional de la dirección de la escuela

Cuando un representante autorizado de la escuela solicita una búsqueda de dirección, nuestro servidor envía la dirección introducida y el idioma de búsqueda a Geoapify (KEPTAGO LTD, Chipre) para sugerir una ubicación. Utilizamos su endpoint de API en la UE. No añadimos a la consulta el identificador de la cuenta, la dirección de correo ni registros de la escuela, ni transmitimos la dirección IP del navegador. Geoapify recibe los datos de red del servidor. La introducción manual sigue disponible.

Geoapify conserva normalmente los detalles de las solicitudes durante un máximo de 24 horas; los casos excepcionales de actividad sospechosa o fraudulenta pueden requerir hasta dos meses. Consulte su [acuerdo de tratamiento](https://www.geoapify.com/data-processing-agreement/) y su [política de privacidad](https://www.geoapify.com/privacy-policy/).

Una búsqueda no publica la dirección. La ubicación de la base de la escuela es privada de forma predeterminada y distinta de las direcciones legales o de facturación. Guardar los ajustes de ubicación y publicar la presentación de la escuela son acciones distintas. Una escuela puede funcionar sin una base fija. Solo la ubicación elegida para su difusión pública se incluye en la presentación publicada.`,
  fr: `## Recherche facultative de l’adresse de l’école

Lorsqu’un représentant autorisé de l’école demande une recherche d’adresse, notre serveur transmet l’adresse saisie et la langue de recherche à Geoapify (KEPTAGO LTD, Chypre) pour proposer un emplacement. Nous utilisons son point d’accès API dans l’UE. Nous n’ajoutons à la recherche ni identifiant de compte, ni adresse e-mail, ni dossiers de l’école, et nous ne transmettons pas l’adresse IP du navigateur. Geoapify reçoit les données réseau du serveur. La saisie manuelle reste possible.

Geoapify conserve normalement les détails des requêtes pendant 24 heures au maximum ; des cas exceptionnels d’activité suspecte ou frauduleuse peuvent nécessiter jusqu’à deux mois. Consultez son [accord de traitement](https://www.geoapify.com/data-processing-agreement/) et sa [politique de confidentialité](https://www.geoapify.com/privacy-policy/).

Une recherche ne publie pas l’adresse. L’emplacement de la base de l’école est privé par défaut et distinct des adresses légales ou de facturation. Enregistrer les paramètres de localisation et publier la présentation de l’école sont deux actions distinctes. Une école peut fonctionner sans base fixe. Seul l’emplacement choisi pour l’affichage public figure dans la présentation publiée.`,
});

export const geoapifySchoolProcessingSections = Object.freeze({
  'en-GB': `## Optional school-location service provider

The school also authorises Geoapify (KEPTAGO LTD, Cyprus) for an address lookup expressly requested by its authorised representative. This instruction covers the entered address and search language through the EU API endpoint. It does not authorise sending staff or customer records to Geoapify. The service is optional and manual location entry remains available. The provider-change and objection provisions above continue to apply.`,
  'pt-PT': `## Prestador opcional para a localização da escola

A escola autoriza também a Geoapify (KEPTAGO LTD, Chipre) para pesquisar uma morada a pedido expresso do seu representante autorizado. Esta instrução abrange a morada introduzida e o idioma da pesquisa através do endpoint de API na UE. Não autoriza o envio de registos de trabalhadores ou clientes à Geoapify. O serviço é opcional e a introdução manual da localização continua disponível. Mantêm-se as disposições acima sobre alterações de prestadores e oposição.`,
  es: `## Proveedor opcional para la ubicación de la escuela

La escuela también autoriza a Geoapify (KEPTAGO LTD, Chipre) para buscar una dirección a petición expresa de su representante autorizado. Esta instrucción abarca la dirección introducida y el idioma de búsqueda a través del endpoint de API en la UE. No autoriza el envío de registros de personal o clientes a Geoapify. El servicio es opcional y la introducción manual de la ubicación sigue disponible. Las disposiciones anteriores sobre cambios de proveedores y oposición siguen vigentes.`,
  fr: `## Prestataire facultatif pour la localisation de l’école

L’école autorise également Geoapify (KEPTAGO LTD, Chypre) pour une recherche d’adresse expressément demandée par son représentant autorisé. Cette instruction couvre l’adresse saisie et la langue de recherche via le point d’accès API dans l’UE. Elle n’autorise pas l’envoi de dossiers du personnel ou des clients à Geoapify. Le service est facultatif et la saisie manuelle de l’emplacement reste possible. Les dispositions précédentes relatives aux changements de prestataires et au droit d’objection continuent de s’appliquer.`,
});

const sources = Object.freeze({
  'mywaveplan.privacy': { version: '2026-11-11.1', kind: 'privacy_notice', sections: geoapifyPrivacySections },
  'mywaveplan.school-processing': { version: '2026-11-04.2', kind: 'school_processing', sections: geoapifySchoolProcessingSections },
});
const hash = text => createHash('sha256').update(text).digest('hex');

// Returns an unpublished candidate, preserving the source verbatim. A release
// importer must verify implementation, environment, approval and destination hash.
export function prepareGeoapifyAmendment(source, { version } = {}) {
  const policy = sources[source?.document_id];
  if (!policy || source.version !== policy.version || source.kind !== policy.kind ||
      !geoapifyLegalLocales.includes(source.language) || typeof source.content !== 'string' || !source.content.trim())
    throw new Error('Unexpected legal source; review the amendment against the current document.');
  if (!source.content_hash || hash(source.content) !== source.content_hash)
    throw new Error('Legal source content does not match its recorded hash.');
  if (typeof version !== 'string' || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(version) || version === source.version)
    throw new Error('Choose a new reviewed document version.');
  if (/Geoapify/i.test(source.content))
    throw new Error('Source already mentions Geoapify; review instead of appending twice.');
  const content = source.content + '\n\n' + policy.sections[source.language];
  return {
    document_id: source.document_id, version, language: source.language,
    title: source.title, kind: source.kind, content, content_hash: hash(content),
    source_version: source.version, source_content_hash: source.content_hash,
  };
}
