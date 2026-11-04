import { storageTranslations } from "./storage-translations.mjs";
import { storagePreviewContent, storagePreviewVersion } from "./storage-preview.mjs";
import { legalStagingProjectId } from "./contracts.mjs";

export function isStorageStagingPreview(host, projectId) {
  return host === 'staging.mywaveplan.com' && projectId === legalStagingProjectId;
}

const previousStorageNotice = {
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

const storageNotice = {
  ...previousStorageNotice,
  version: '2026-11-04.1',
  content: previousStorageNotice.content
    .replace('your appearance choice.', 'your appearance and language choices.')
    .replace('## Location permission', `## Language choice

The mywaveplan:language entry in local storage remembers the language you choose in this browser until you change or clear it. If you sign in and choose a language in the workspace, MyWavePlan also saves it to your account. Your account language applies when you sign in on another device. Choose the browser default to clear the saved choice for this browser and, if signed in, your account.

## Location permission`),
};

export function getStorageNotice(version, locale = 'en-GB', { preview = false } = {}) {
  if (version === previousStorageNotice.version)
    return locale === previousStorageNotice.language ? previousStorageNotice : null;
  const translation = storageTranslations[locale];
  const current = translation ? { ...storageNotice, ...translation, language: locale } : storageNotice;
  if (preview && (!version || version === storagePreviewVersion)) {
    return { ...current, version: storagePreviewVersion, status: 'staging_preview', content: storagePreviewContent[current.language] };
  }
  return !version || version === storageNotice.version ? current : null;
}
