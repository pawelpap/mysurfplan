export const storageNotice = {
  document_id: 'mywaveplan.browser-storage', version: '2026-10-06.1', language: 'en-GB',
  title: 'Cookies and browser storage', kind: 'storage_information',
  content: `## Login session

The msp_session cookie keeps you signed in. It contains a signed session identifier linked to a server-side session record. It is limited to this website, lasts up to seven days and uses Secure, HttpOnly and SameSite=Lax in the deployed service. Logging out revokes the server session and clears the cookie. This cookie is needed for account access.

## Appearance

The mywaveplan:appearance entry in your browser's local storage remembers System, Light or Dark appearance for this website. It has no automatic expiry. It lasts until replaced or cleared through your browser settings. The login page follows your device's appearance. Staging and production keep separate preferences.

## Location

Nearest to me uses the browser's location permission. Coordinates are used in memory to calculate nearby spots on your device. This feature does not store coordinates in our browser storage or send them to MyWavePlan APIs. You can use alphabetical spot selection without granting location permission. Your browser controls its own permission record.

## Optional tracking

GA4, Meta Pixel, LinkedIn Insight Tag, Google Ads and Microsoft Clarity are planned tools. They are currently inactive. MyWavePlan does not currently load these tools or set their identifiers. We will update this information and provide separate choices before enabling optional analytics, advertising or session recording. Refusing optional purposes will not prevent core account or forecast access.

## Other resources

Poppins fonts and application icons are served by MyWavePlan. Forecast and tide-data requests go from our server to their providers. OpenStreetMap is an external link, not an embedded map. If a profile has an external image, your browser may contact that image host to display it. Following an external link takes you to that provider's service and policies.

## Clearing storage

You can remove this website's cookies and local storage in your browser settings. Removing the session cookie signs you out in that browser. Use Log out to revoke the server-side session as well. Removing the appearance entry restores the device setting. Optional choices and agreement records for an account are separate from these browser settings.

## Contact

Questions about browser storage can be sent to support@mywaveplan.com. The privacy notice explains account and service processing.`,
};
