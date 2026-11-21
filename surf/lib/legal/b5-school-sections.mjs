// B5 resource disclosures. Historical documents use their original source modules.
export const b5LegalVersion = '2026-11-11.2';
export const b5StagingLegalVersion = '2026-11-11.2-staging-test';
export const b5ResourceSections = Object.freeze({
  'en-GB': `## School maps and photographs

The optional school-location map loads OpenStreetMap tiles only after you choose to load it. The OpenStreetMap Foundation and its delivery providers receive your IP address, browser request details, the viewed map area and this website's origin as the referrer. Map tiles can remain in your browser's normal HTTP cache under the provider's cache settings. Loading this map does not request your device's GPS location. You can enter or correct coordinates without loading it. Hiding the map stops further map requests; it does not erase earlier provider requests or cached tiles. See the [OpenStreetMap privacy policy](https://osmfoundation.org/wiki/Privacy_Policy).

Uploaded personal photographs and school draft images are stored privately using Vercel Blob. Access to personal photographs requires authorised account access. We validate and re-encode supported images, strip embedded metadata and store sanitised masters and resized versions. We do not retain the original uploaded file as an unprocessed original. Choosing an uploaded profile photograph or removing a photograph replaces that profile choice; removal does not silently restore an older external photograph. An existing external photograph remains external until replaced or removed.

Only an explicit school-publication action creates public school-image versions and a versioned presentation containing the selected public text, contacts, location and branding. A draft save, preview or reset does not publish changes. Public images and presentations can be copied by visitors or cached by networks.

Unreferenced uploads normally become eligible for queued cleanup after a 24-hour grace period. Replaced publication versions are retained for at least 30 days and longer while a live reference requires them, including an email-delivery retry reference when that journey is available. Cleanup uses bounded batches and retries; eligibility is not a guaranteed deletion time. Removing or replacing an image does not instantly erase public browser caches, network caches or copies already obtained by others.`,
  'pt-PT': `## Mapas e fotografias da escola

O mapa opcional de localização da escola só carrega mosaicos do OpenStreetMap depois de escolher carregá-lo. A OpenStreetMap Foundation e os seus prestadores de distribuição recebem o endereço IP, os detalhes do pedido do navegador, a área do mapa visualizada e a origem deste site como referência. Os mosaicos podem permanecer na cache HTTP normal do navegador, segundo as definições de cache do prestador. Carregar este mapa não pede a localização GPS do dispositivo. Pode introduzir ou corrigir coordenadas sem o carregar. Ocultar o mapa interrompe novos pedidos, mas não elimina pedidos anteriores nem os mosaicos em cache. Consulte a [política de privacidade do OpenStreetMap](https://osmfoundation.org/wiki/Privacy_Policy).

As fotografias pessoais carregadas e as imagens em rascunho da escola são guardadas de forma privada no Vercel Blob. O acesso às fotografias pessoais exige acesso autorizado à conta. Validamos e recodificamos os formatos suportados, removemos os metadados incorporados e guardamos versões principais tratadas e versões redimensionadas. Não conservamos o ficheiro original carregado sem tratamento. Escolher uma fotografia de perfil carregada ou remover uma fotografia substitui essa escolha; a remoção não repõe silenciosamente uma fotografia externa anterior. Uma fotografia externa existente continua externa até ser substituída ou removida.

Apenas uma ação explícita de publicação cria versões públicas das imagens da escola e uma apresentação com versão que contém os textos, contactos, localização e identidade visual escolhidos para divulgação pública. Guardar um rascunho, pré-visualizar ou repor as predefinições não publica alterações. Os visitantes podem copiar imagens e apresentações públicas e as redes podem guardá-las em cache.

Os carregamentos sem referências tornam-se normalmente elegíveis para limpeza em fila após um período de 24 horas. As versões de publicação substituídas são conservadas durante pelo menos 30 dias e por mais tempo enquanto uma referência ativa as exigir, incluindo uma referência de nova tentativa de entrega de e-mail quando esse percurso estiver disponível. A limpeza usa lotes limitados e novas tentativas; a elegibilidade não garante um momento de eliminação. Remover ou substituir uma imagem não apaga imediatamente as caches públicas nem as cópias já obtidas por terceiros.`,
  es: `## Mapas y fotografías de la escuela

El mapa opcional de ubicación de la escuela solo carga teselas de OpenStreetMap después de que elija cargarlo. OpenStreetMap Foundation y sus proveedores de distribución reciben su dirección IP, los detalles de la solicitud del navegador, el área del mapa visualizada y el origen de este sitio como referencia. Las teselas pueden permanecer en la caché HTTP normal del navegador según los ajustes del proveedor. Cargar este mapa no solicita la ubicación GPS del dispositivo. Puede introducir o corregir coordenadas sin cargarlo. Ocultar el mapa detiene nuevas solicitudes, pero no borra las anteriores ni las teselas almacenadas en caché. Consulte la [política de privacidad de OpenStreetMap](https://osmfoundation.org/wiki/Privacy_Policy).

Las fotografías personales subidas y las imágenes en borrador de la escuela se guardan de forma privada en Vercel Blob. El acceso a las fotografías personales requiere acceso autorizado a la cuenta. Validamos y recodificamos los formatos compatibles, eliminamos los metadatos incorporados y guardamos versiones principales tratadas y versiones redimensionadas. No conservamos el archivo original subido sin tratar. Elegir una fotografía de perfil subida o eliminar una fotografía sustituye esa elección; eliminarla no restaura silenciosamente una fotografía externa anterior. Una fotografía externa existente sigue siendo externa hasta que se sustituya o elimine.

Solo una acción explícita de publicación crea versiones públicas de las imágenes de la escuela y una presentación con versión que incluye los textos, contactos, ubicación e identidad visual elegidos para su difusión pública. Guardar un borrador, previsualizar o restablecer los valores predeterminados no publica cambios. Los visitantes pueden copiar las imágenes y presentaciones públicas y las redes pueden almacenarlas en caché.

Los archivos subidos sin referencias normalmente pasan a ser elegibles para la limpieza en cola tras un periodo de 24 horas. Las versiones de publicación sustituidas se conservan durante al menos 30 días y durante más tiempo mientras una referencia activa las necesite, incluida una referencia de reintento de entrega de correo cuando ese recorrido esté disponible. La limpieza usa lotes limitados y reintentos; la elegibilidad no garantiza una fecha de eliminación. Eliminar o sustituir una imagen no borra inmediatamente las cachés públicas ni las copias ya obtenidas por terceros.`,
  fr: `## Cartes et photographies de l’école

La carte facultative de localisation de l’école charge les tuiles OpenStreetMap uniquement après votre choix de la charger. L’OpenStreetMap Foundation et ses prestataires de diffusion reçoivent votre adresse IP, les détails de la requête du navigateur, la zone de carte affichée et l’origine de ce site comme référent. Les tuiles peuvent rester dans le cache HTTP habituel du navigateur selon les paramètres du prestataire. Charger cette carte ne demande pas la position GPS de l’appareil. Vous pouvez saisir ou corriger les coordonnées sans la charger. Masquer la carte arrête les nouvelles requêtes, mais n’efface ni les requêtes précédentes ni les tuiles en cache. Consultez la [politique de confidentialité d’OpenStreetMap](https://osmfoundation.org/wiki/Privacy_Policy).

Les photographies personnelles importées et les images en brouillon de l’école sont stockées de manière privée dans Vercel Blob. L’accès aux photographies personnelles nécessite un accès autorisé au compte. Nous validons et réencodons les formats pris en charge, supprimons les métadonnées intégrées et conservons des versions principales traitées et des versions redimensionnées. Nous ne conservons pas le fichier d’origine importé sans traitement. Choisir une photographie de profil importée ou supprimer une photographie remplace ce choix ; sa suppression ne rétablit pas silencieusement une ancienne photographie externe. Une photographie externe existante reste externe jusqu’à son remplacement ou sa suppression.

Seule une action explicite de publication crée des versions publiques des images de l’école et une présentation versionnée contenant les textes, coordonnées, emplacement et identité visuelle choisis pour l’affichage public. Enregistrer un brouillon, prévisualiser ou rétablir les valeurs par défaut ne publie pas les modifications. Les visiteurs peuvent copier les images et présentations publiques et les réseaux peuvent les mettre en cache.

Les fichiers importés sans référence deviennent normalement admissibles au nettoyage en file d’attente après un délai de 24 heures. Les versions de publication remplacées sont conservées pendant au moins 30 jours et davantage tant qu’une référence active les nécessite, notamment une référence de nouvelle tentative de livraison d’e-mail lorsque ce parcours est disponible. Le nettoyage utilise des lots limités et de nouvelles tentatives ; l’admissibilité ne garantit pas une date de suppression. Supprimer ou remplacer une image n’efface pas immédiatement les caches publics ni les copies déjà obtenues par des tiers.`,
});

export const b5SchoolProviderSections = Object.freeze({
  'en-GB': `## School images and service-email providers

The school also authorises Vercel Blob, supplied by the existing Vercel provider, to store its private draft images and sanitised image versions, and to deliver the public derivatives that its representative explicitly publishes. Images can include personal data and must stay within this agreement's adult-service scope. Mailjet sends the school's staff invitations and other available service emails with open and click tracking off. The existing provider-change, objection and transfer-safeguard provisions continue to apply.

School-publication versions preserve the selected public presentation and image references. Replaced versions are retained for at least 30 days and longer while a live reference requires them, including an email-delivery retry reference when that journey is available. Unreferenced uploads normally become eligible for queued cleanup after 24 hours. Bounded cleanup and retries do not guarantee immediate erasure; public caches and copies already obtained by others can remain.

The optional OpenStreetMap map is a direct browser resource loaded only on request. Its provider receives browser network details and the viewed area under its own privacy policy. Loading it does not authorise sending school staff or customer records. Manual coordinates remain available.`,
  'pt-PT': `## Prestadores de imagens e e-mails de serviço da escola

A escola autoriza também o Vercel Blob, fornecido pelo prestador Vercel já indicado, a guardar as imagens privadas em rascunho e as versões tratadas das imagens, e a distribuir as versões públicas que o seu representante publicar expressamente. As imagens podem conter dados pessoais e devem respeitar o âmbito do serviço para adultos deste acordo. O Mailjet envia os convites da equipa e outros e-mails de serviço disponíveis, com o seguimento de aberturas e cliques desativado. Mantêm-se as disposições existentes sobre alterações de prestadores, oposição e garantias de transferências.

As versões publicadas da escola preservam a apresentação pública escolhida e as referências das imagens. As versões substituídas são conservadas durante pelo menos 30 dias e por mais tempo enquanto uma referência ativa as exigir, incluindo uma referência de nova tentativa de entrega de e-mail quando esse percurso estiver disponível. Os carregamentos sem referências tornam-se normalmente elegíveis para limpeza em fila após 24 horas. A limpeza limitada e as novas tentativas não garantem a eliminação imediata; as caches públicas e as cópias já obtidas por terceiros podem permanecer.

O mapa opcional do OpenStreetMap é um recurso direto do navegador, carregado apenas a pedido. O prestador recebe dados de rede do navegador e a área visualizada, segundo a sua própria política de privacidade. Carregá-lo não autoriza o envio de registos de trabalhadores ou clientes da escola. Continua a ser possível introduzir coordenadas manualmente.`,
  es: `## Proveedores de imágenes y correos de servicio de la escuela

La escuela también autoriza a Vercel Blob, suministrado por el proveedor Vercel ya indicado, a guardar sus imágenes privadas en borrador y las versiones tratadas, y a distribuir las versiones públicas que su representante publique expresamente. Las imágenes pueden contener datos personales y deben respetar el ámbito del servicio para adultos de este acuerdo. Mailjet envía las invitaciones del equipo y otros correos de servicio disponibles con el seguimiento de aperturas y clics desactivado. Siguen vigentes las disposiciones existentes sobre cambios de proveedores, oposición y garantías de transferencias.

Las versiones publicadas de la escuela conservan la presentación pública elegida y las referencias de las imágenes. Las versiones sustituidas se conservan durante al menos 30 días y durante más tiempo mientras una referencia activa las necesite, incluida una referencia de reintento de entrega de correo cuando ese recorrido esté disponible. Los archivos subidos sin referencias normalmente pasan a ser elegibles para la limpieza en cola tras 24 horas. La limpieza limitada y los reintentos no garantizan la eliminación inmediata; las cachés públicas y las copias ya obtenidas por terceros pueden permanecer.

El mapa opcional de OpenStreetMap es un recurso directo del navegador que solo se carga a petición. Su proveedor recibe los datos de red del navegador y el área visualizada según su propia política de privacidad. Cargarlo no autoriza el envío de registros del personal o de clientes de la escuela. La introducción manual de coordenadas sigue disponible.`,
  fr: `## Prestataires d’images et d’e-mails de service de l’école

L’école autorise également Vercel Blob, fourni par le prestataire Vercel déjà indiqué, à stocker ses images privées en brouillon et leurs versions traitées, et à diffuser les versions publiques que son représentant publie expressément. Les images peuvent contenir des données personnelles et doivent respecter le périmètre du service réservé aux adultes de cet accord. Mailjet envoie les invitations de l’équipe et les autres e-mails de service disponibles sans suivi des ouvertures ni des clics. Les dispositions existantes relatives aux changements de prestataires, au droit d’objection et aux garanties de transfert continuent de s’appliquer.

Les versions publiées de l’école conservent la présentation publique choisie et les références des images. Les versions remplacées sont conservées pendant au moins 30 jours et davantage tant qu’une référence active les nécessite, notamment une référence de nouvelle tentative de livraison d’e-mail lorsque ce parcours est disponible. Les fichiers importés sans référence deviennent normalement admissibles au nettoyage en file d’attente après 24 heures. Le nettoyage limité et les nouvelles tentatives ne garantissent pas une suppression immédiate ; les caches publics et les copies déjà obtenues par des tiers peuvent subsister.

La carte facultative OpenStreetMap est une ressource directe du navigateur chargée uniquement sur demande. Son prestataire reçoit les données réseau du navigateur et la zone affichée selon sa propre politique de confidentialité. La charger n’autorise pas l’envoi de dossiers du personnel ou des clients de l’école. La saisie manuelle des coordonnées reste possible.`,
});

// Replaces the earlier resource-only claim, without changing historical notices.
export const b5OldResourceSentence = Object.freeze({
  'en-GB': 'OpenStreetMap is an external link.',
  'pt-PT': 'O OpenStreetMap é uma ligação externa.',
  es: 'OpenStreetMap es un enlace externo.',
  fr: 'OpenStreetMap est un lien externe.',
});
export const b5NewResourceSentence = Object.freeze({
  'en-GB': 'OpenStreetMap links and the optional school map are described below.',
  'pt-PT': 'As ligações ao OpenStreetMap e o mapa opcional da escola são descritos abaixo.',
  es: 'Los enlaces a OpenStreetMap y el mapa opcional de la escuela se describen a continuación.',
  fr: 'Les liens OpenStreetMap et la carte facultative de l’école sont décrits ci-dessous.',
});

export const b5StagingTestIntroduction = Object.freeze({
  'en-GB': '## Staging test document\n\nThis is a non-binding staging test copy. It creates no production agreement or production permission. Any acceptance records only a test interaction in staging. The complete candidate text below is prepared for owner review before production publication.',
  'pt-PT': '## Documento de teste em staging\n\nEsta é uma cópia de teste sem força vinculativa no ambiente de staging. Não cria um acordo nem uma autorização em produção. Qualquer aceitação regista apenas uma interação de teste em staging. O texto completo proposto abaixo destina-se à revisão do responsável antes da publicação em produção.',
  es: '## Documento de prueba en staging\n\nEsta es una copia de prueba no vinculante en el entorno de staging. No crea ningún acuerdo ni permiso en producción. Cualquier aceptación registra únicamente una interacción de prueba en staging. El texto completo propuesto a continuación se prepara para la revisión del responsable antes de publicarlo en producción.',
  fr: '## Document de test en staging\n\nIl s’agit d’une copie de test sans force contraignante dans l’environnement de staging. Elle ne crée aucun accord ni aucune autorisation en production. Toute acceptation enregistre uniquement une interaction de test en staging. Le texte complet proposé ci-dessous est préparé pour examen par le responsable avant publication en production.',
});
