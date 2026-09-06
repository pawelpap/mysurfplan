# Home-screen installation and icons

MyWavePlan uses the existing wave logo for browser tabs and phone home screens. The web app manifest opens the installed app at Conditions in a standalone window. Normal login and permissions still apply.

The owner explicitly authorised staging and production deployment for this change on 6 September 2026. Revision `1b474234a0187c53d7047d0f64fe9fb534c15582` passed staging verification (`dpl_BGDLjaWwUpohyH5cxQMaA2Jmfqar`), then production verification (`dpl_2rgdYZy7hcmtLSVu9nLnVcABNKUi`). The release is complete. This permission is specific to this release; the standing review workflow applies to later changes.

## Add to a phone

On iPhone or iPad, open https://mywaveplan.com in Safari, open Share and choose Add to Home Screen. Enable Open as Web App if offered, then tap Add. Depending on the Safari layout, Share may be inside the More menu. See [Apple's instructions](https://support.apple.com/en-gb/guide/iphone/iphea86e5236/ios).

On Android, open the site in Chrome and choose Install app or Add to Home screen from the browser menu, then confirm. Use a normal browser window. Browser-managed installation is deliberate; no additional install banner is added to the application.

The shortcut is named MyWavePlan. It opens Conditions, asking for login first if needed. The app still needs a network connection for forecasts and school data. No service worker or offline data cache is added, so the existing forecast refresh behaviour remains intact.

## Assets and metadata

| Asset | Purpose |
| --- | --- |
| `public/favicon.svg` | Scalable browser-tab icon with rounded teal background |
| `public/favicon.ico` | Legacy browser fallback with 16, 32 and 48 px frames |
| `public/apple-touch-icon.png` | Opaque 180 × 180 px Apple home-screen icon; iOS applies its own corners |
| `public/icons/icon-192.png` | Standard 192 × 192 px app icon |
| `public/icons/icon-512.png` | Standard 512 × 512 px app icon |
| `public/icons/icon-maskable-512.png` | Opaque Android maskable icon; all wave artwork fits inside the central 80% circle |
| `public/icons/app-icon.svg` and `app-icon-maskable.svg` | Vector sources for the PNG exports |
| `public/manifest.webmanifest` | Stable app identity `/`, root scope, name, icons, `standalone` display and `/?view=conditions` launch URL |

Icon artwork reuses the paths and colours of the existing `Brand` component. The PNGs were exported with Sharp from the bundled workspace tools; no runtime dependency was added. When changing the logo, update the SVG sources and re-export the listed sizes. Keep Apple and maskable backgrounds opaque and validate masking before release.

Shared metadata in `pages/_document.js` is served on login, workspace, public schedule and legal pages. All icon and manifest URLs are public, root-relative and stay on the current origin, so staging cannot install a shortcut pointing at production. No account, school or selected spot is embedded in the manifest.

The page's `theme-color` follows the System/Light/Dark preference, including the early head script and later changes. The manifest uses the normal light background as its initial fallback. The default iOS status-bar style and standard viewport are retained, allowing the browser to handle safe areas.

## Verification

Local checks passed: all 44 automated tests and the production build; icon dimensions and opacity; three valid ICO frames; maskable safe-circle geometry; public asset responses and MIME types; Chrome manifest parsing, icon decoding and installation diagnostics with no errors in a temporary regular profile; login from the launch URL returning to Conditions; metadata retained through navigation; browser-colour synchronisation; 390 and 320 px mobile layout; and no browser exceptions.

The same browser and asset checks passed on the staging and production custom domains. Deployment references and rollback are recorded in [HANDOVER.md](HANDOVER.md). Automated checks inspect mobile metadata and viewport behaviour; they do not operate a physical iPhone Home Screen. A physical-device installation is not claimed as tested.

Technical references: [MDN installability requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [MDN app icons and masking](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons), and [Chrome menu installation without a service worker](https://developer.chrome.com/blog/update-install-criteria).
