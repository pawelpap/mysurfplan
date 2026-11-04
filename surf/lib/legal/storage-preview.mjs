// Staging copy from the 4 November translation review. Historical notices are separate.
export const storagePreviewVersion = "2026-11-04.2";

export const storagePreviewContent = {
  "en-GB": `## Storage at a glance

MyWavePlan uses a login cookie for account access and browser storage for your appearance and language choices. Optional analytics, advertising and session recording are off.

## Login cookie

The msp_session cookie keeps you signed in for up to seven days. It contains a signed session identifier linked to a server record. It is limited to this website and protected with Secure, HttpOnly and SameSite=Lax settings. This cookie is needed for account access.

Logging out revokes the session and clears the cookie. Removing the cookie through browser settings signs you out in that browser, but does not itself revoke the server session.

## Appearance choice

The mywaveplan:appearance entry in local storage remembers whether you choose System, Light or Dark. It remains until you change or clear it. Removing it restores the device setting. The login page follows your device's appearance.

## Language choice

The mywaveplan:language entry in local storage remembers your language choice in this browser until you change or clear it. If you choose a language in the workspace or on a legal document page while signed in to your personal account, MyWavePlan also saves it to your account. The saved account language applies when you sign in on another device. In the demo, language choices are saved only in the browser. Choosing the browser default clears the preference from this browser. If you make that choice in the workspace or on a legal document page while signed in to your personal account, it also clears the saved account preference.

## Location permission

Nearest to me asks for your browser's location permission. Coordinates are used in memory to calculate nearby spots on your device. They are not saved in MyWavePlan browser storage or sent to MyWavePlan APIs. You can choose spots alphabetically without granting permission. Your browser manages its own permission record.

## Optional tracking

Optional tracking is off. If optional tools are introduced, their storage and purposes will be explained before activation and you will have separate choices. Declining optional tracking will not prevent account or forecast access.

## Other website resources

Fonts and application icons are served directly by MyWavePlan. Forecast and tide requests go from our server to environmental-data providers. OpenStreetMap is an external link. If an external profile photograph is displayed, your browser contacts its image host. External services have their own policies.

## Managing storage and asking questions

Your browser settings let you remove this website's cookies and local storage. This is separate from deleting account information or agreement records. Use Log out to end the server session as well.

Contact support@mywaveplan.com for questions. Our privacy notice explains how account and service information is used.`,
  "pt-PT": `## Resumo

O MyWavePlan utiliza um cookie para manter a sessão iniciada e o armazenamento do navegador para memorizar as suas escolhas de aparência e idioma. A análise de utilização, a publicidade e a gravação de sessões estão desativadas.

## Cookie de sessão

O cookie msp_session mantém a sessão iniciada durante até sete dias. Contém um identificador de sessão assinado, associado a um registo no servidor. Está limitado a este site e é protegido pelas definições Secure, HttpOnly e SameSite=Lax. É necessário para aceder à conta.

Terminar a sessão revoga-a no servidor e elimina o cookie. Eliminar o cookie nas definições do navegador termina a sessão nesse navegador, mas não revoga, por si só, a sessão no servidor.

## Aparência

A entrada mywaveplan:appearance no armazenamento local memoriza a opção Sistema, Claro ou Escuro. Mantém-se até a alterar ou eliminar. Eliminá-la repõe a aparência do dispositivo. A página de início de sessão segue a aparência do dispositivo.

## Idioma

A entrada mywaveplan:language no armazenamento local memoriza a escolha de idioma neste navegador até a alterar ou eliminar. Se escolher um idioma na área de trabalho ou numa página de documentos legais com sessão iniciada na conta pessoal, o MyWavePlan guarda a escolha também na conta. O idioma guardado na conta aplica-se quando inicia sessão noutro dispositivo. Na demonstração, a escolha de idioma fica guardada apenas no navegador. Escolher a predefinição do navegador elimina a preferência deste navegador. Se fizer essa escolha na área de trabalho ou numa página de documentos legais com sessão iniciada na conta pessoal, também elimina a preferência da conta.

## Permissão de localização

A opção Mais perto de mim pede autorização de localização ao navegador. As coordenadas são usadas em memória para calcular quais os locais de surf mais próximos no seu dispositivo. Não são guardadas no armazenamento do MyWavePlan nem enviadas para as suas APIs. Pode ordenar os locais alfabeticamente sem conceder autorização. O navegador gere o seu próprio registo de permissões.

## Seguimento opcional

O seguimento opcional está desativado. Se forem introduzidas ferramentas opcionais, o respetivo armazenamento e as finalidades serão explicados antes da ativação e haverá escolhas separadas. Recusar o seguimento opcional não impede o acesso à conta ou às previsões.

## Outros recursos do site

O MyWavePlan fornece diretamente os tipos de letra e os ícones. Os pedidos de previsão e de marés partem do nosso servidor para os fornecedores de dados ambientais. O OpenStreetMap é uma ligação externa. Quando é apresentada uma fotografia de perfil externa, o navegador contacta o respetivo servidor. Os serviços externos têm as suas próprias políticas.

## Gerir o armazenamento e esclarecer dúvidas

Nas definições do navegador pode eliminar os cookies e o armazenamento local deste site. Isto é independente da eliminação dos dados da conta ou dos registos de acordos. Use Terminar sessão para encerrar também a sessão no servidor.

Para esclarecer dúvidas, contacte support@mywaveplan.com. O aviso de privacidade explica como utilizamos os dados da conta e do serviço.`,
  "es": `## Resumen

MyWavePlan utiliza una cookie para mantener la sesión iniciada y el almacenamiento del navegador para recordar sus preferencias de apariencia e idioma. Las herramientas de analítica, publicidad y grabación de sesiones están desactivadas.

## Cookie de sesión

La cookie msp_session mantiene la sesión iniciada durante un máximo de siete días. Contiene un identificador de sesión firmado, vinculado a un registro del servidor. Su uso se limita a este sitio y está protegida con las opciones Secure, HttpOnly y SameSite=Lax. Es necesaria para acceder a la cuenta.

Cerrar sesión revoca la sesión en el servidor y elimina la cookie. Eliminar la cookie desde los ajustes del navegador cierra la sesión en ese navegador, pero no revoca por sí solo la sesión en el servidor.

## Apariencia

La entrada mywaveplan:appearance del almacenamiento local recuerda si elige Sistema, Claro u Oscuro. Se conserva hasta que la cambie o la elimine. Al eliminarla se recupera la apariencia del dispositivo. La página de inicio de sesión sigue la apariencia del dispositivo.

## Idioma

La entrada mywaveplan:language del almacenamiento local recuerda el idioma elegido en este navegador hasta que lo cambie o lo borre. Si elige un idioma en el espacio de trabajo o en una página de documentos legales con una sesión iniciada en su cuenta personal, MyWavePlan también lo guarda en su cuenta. El idioma guardado en la cuenta se aplica cuando inicia sesión en otro dispositivo. En la demostración, la elección se guarda solo en el navegador. Elegir la opción predeterminada del navegador borra la preferencia de este navegador. Si lo hace en el espacio de trabajo o en una página de documentos legales con una sesión iniciada en su cuenta personal, también borra la preferencia de la cuenta.

## Permiso de ubicación

La opción Más cerca de mí pide permiso al navegador para usar la ubicación. Las coordenadas se usan en memoria para calcular qué spots están más cerca en su dispositivo. MyWavePlan no las guarda en el navegador ni las envía a sus API. Puede ordenar los spots alfabéticamente sin conceder permiso. Su navegador gestiona su propio registro de permisos.

## Seguimiento opcional

El seguimiento opcional está desactivado. Si se incorporan herramientas opcionales, explicaremos qué almacenan y con qué fines antes de activarlas y ofreceremos opciones separadas. Rechazar el seguimiento opcional no impide el acceso a la cuenta ni a las previsiones.

## Otros recursos del sitio

MyWavePlan sirve directamente las fuentes y los iconos. Las solicitudes de previsiones y mareas van de nuestro servidor a los proveedores de datos ambientales. OpenStreetMap es un enlace externo. Si se muestra una foto de perfil externa, el navegador contacta con el servidor que aloja la imagen. Los servicios externos tienen sus propias políticas.

## Gestionar el almacenamiento y resolver dudas

Puede eliminar las cookies y el almacenamiento local de este sitio desde los ajustes del navegador. Esto es independiente de la eliminación de los datos de la cuenta o de los registros de acuerdos. Use Cerrar sesión para finalizar también la sesión en el servidor.

Si tiene dudas, escriba a support@mywaveplan.com. El aviso de privacidad explica cómo se usan los datos de la cuenta y del servicio.`,
  "fr": `## En bref

MyWavePlan utilise un cookie pour maintenir votre connexion et le stockage du navigateur pour mémoriser vos préférences d’apparence et de langue. La mesure d’audience, la publicité et l’enregistrement de sessions sont désactivés.

## Cookie de session

Le cookie msp_session vous permet de rester connecté pendant sept jours au maximum. Il contient un identifiant de session signé, associé à un enregistrement sur le serveur. Il est limité à ce site et protégé par les attributs Secure, HttpOnly et SameSite=Lax. Il est nécessaire pour accéder à votre compte.

La déconnexion révoque la session sur le serveur et efface le cookie. Effacer le cookie dans les réglages du navigateur vous déconnecte dans ce navigateur, mais ne révoque pas à lui seul la session sur le serveur.

## Apparence

L’entrée mywaveplan:appearance du stockage local mémorise le choix entre Système, Clair et Sombre. Elle est conservée jusqu’à ce que vous la modifiiez ou l’effaciez. L’effacer rétablit l’apparence de l’appareil. La page de connexion suit l’apparence de l’appareil.

## Langue

L’entrée mywaveplan:language du stockage local mémorise le choix de langue de ce navigateur jusqu’à ce que vous le modifiiez ou l’effaciez. Si vous choisissez une langue dans l’espace de travail ou sur une page de document juridique en étant connecté à votre compte personnel, MyWavePlan enregistre également le choix dans votre compte. La langue enregistrée dans le compte s’applique lorsque vous vous connectez sur un autre appareil. En mode démonstration, le choix est enregistré uniquement dans le navigateur. Choisir la langue par défaut du navigateur efface la préférence de ce navigateur. Si vous faites ce choix dans l’espace de travail ou sur une page de document juridique en étant connecté à votre compte personnel, la préférence du compte est également effacée.

## Autorisation de localisation

L’option Les plus proches demande au navigateur l’autorisation d’accéder à votre position. Les coordonnées sont utilisées en mémoire pour calculer les spots proches sur votre appareil. Elles ne sont ni enregistrées dans le stockage de MyWavePlan ni envoyées à ses API. Vous pouvez trier les spots par ordre alphabétique sans accorder cette autorisation. Votre navigateur gère son propre registre d’autorisations.

## Suivi facultatif

Le suivi facultatif est désactivé. Si des outils facultatifs sont introduits, nous expliquerons leur stockage et leurs finalités avant de les activer. Vous disposerez de choix distincts. Le refus du suivi facultatif ne bloque pas l’accès au compte ni aux prévisions.

## Autres ressources du site

Les polices et les icônes sont fournies directement par MyWavePlan. Notre serveur envoie les demandes de prévisions et de marées aux fournisseurs de données environnementales. OpenStreetMap est un lien externe. Si une photo de profil externe s’affiche, votre navigateur contacte le serveur qui héberge l’image. Les services externes ont leurs propres politiques.

## Gérer le stockage et poser des questions

Les réglages du navigateur permettent de supprimer les cookies et le stockage local de ce site. Cette opération est distincte de la suppression des données du compte ou des justificatifs d’accord. Utilisez Se déconnecter pour mettre aussi fin à la session sur le serveur.

Pour toute question, écrivez à support@mywaveplan.com. Notre notice de confidentialité explique comment nous utilisons les données du compte et du service.`,
};
