export const storageNotice = {
  document_id: 'mywaveplan.browser-storage', version: '2026-10-06.2', language: 'en-GB',
  title: 'Cookies and browser storage', kind: 'storage_information',
  content: `## Storage at a glance

MyWavePlan uses a login cookie for account access and browser storage for your appearance choice. Optional analytics, advertising and session recording are off.

## Login cookie

The msp_session cookie keeps you signed in for up to seven days. It contains a signed session identifier linked to a server record. It is limited to this website and protected with Secure, HttpOnly and SameSite=Lax settings. This cookie is needed for account access.

Logging out revokes the session and clears the cookie. Removing the cookie through browser settings signs you out in that browser, but does not itself revoke the server session.

## Appearance choice

The mywaveplan:appearance entry in local storage remembers whether you choose System, Light or Dark. It remains until you change or clear it. Removing it restores the device setting. The login page follows your device's appearance.

## Location permission

Nearest to me asks for your browser's location permission. Coordinates are used in memory to calculate nearby spots on your device. They are not saved in MyWavePlan browser storage or sent to MyWavePlan APIs. You can choose spots alphabetically without granting permission. Your browser manages its own permission record.

## Optional tracking

Optional tracking is off. If optional tools are introduced, their storage and purposes will be explained before activation and you will have separate choices. Declining optional tracking will not prevent account or forecast access.

## Other website resources

Fonts and application icons are served directly by MyWavePlan. Forecast and tide requests go from our server to environmental-data providers. OpenStreetMap is an external link. If an external profile photograph is displayed, your browser contacts its image host. External services have their own policies.

## Managing storage and asking questions

Your browser settings let you remove this website's cookies and local storage. This is separate from deleting account information or agreement records. Use Log out to end the server session as well.

Contact support@mywaveplan.com for questions. Our privacy notice explains how account and service information is used.`,
};
