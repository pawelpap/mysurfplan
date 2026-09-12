# Browser translation stability, 12 September 2026

Application commit: `a31a27ebd129d33cae3c9b6e043c5e758885b00a`.

Deployed and verified on both environments:

| Environment | Verified application deployment |
| --- | --- |
| Staging | `dpl_32dEY16XTufk6epbC79q9Bm1zRwK` |
| Production | `dpl_49eifT4WpaChUoqhxQzRmZztKeVu` |

Subsequent documentation-only commits keep the same application code.

## Incident and confirmed reproduction

A tester reported that the forecast appeared for about two seconds after demo login, then disappeared into the generic client-side exception screen. The owner suspects French or Portuguese automatic translation in the two reported browser incidents. Their actual devices, browser versions and error logs are unavailable, so attribution of either individual incident remains unconfirmed.

On the preceding staging release, a controlled browser test replaced text nodes with nested `font` elements, following the mutation pattern documented in [React issue 11538](https://github.com/react/react/issues/11538). The main forecast loaded while spot-summary responses were held. Releasing those responses after the text replacement consistently caused `NotFoundError: Failed to execute 'removeChild' on 'Node'` and the same generic Next.js exception screen. React attempted to remove the spot card's original loading text node after the translator had replaced it. The separate earlier invalid-credentials screenshot does not prove this rendering failure affected authentication.

## Change

- Keep changing text inside stable React-owned elements. In particular, the spot-card loading state is now an element rather than a bare text sibling next to an icon.
- Compose changing text-only values as one string and isolate values beside icons or other elements. This also prevents translated copies of times, directions and forecast measurements remaining stale after state updates.
- Add an application error boundary with a reload action. A deliberate browser-only malformed response verifies recovery without losing the student session. This catches rendering failures; central error/rejection reporting remains planned under A6.
- Preserve browser translation. No global DOM prototype patches, translation blocking, new dependencies, database changes, permission changes, calibration changes or CSS changes are included.

## Verification

- Production build and all 108 unit tests passed. Lint has no errors; the existing avatar image warning remains.
- The preceding release fails the controlled translation regression. The fixed production build, staging and production pass French-locale mobile and Portuguese-locale desktop scenarios: translated login, delayed spot summaries, delayed automatic location selection, chart cursor, day selection, all/night hours, catalogue filters, recovery and retained student-only demo identity.
- Both environments pass all seven public-demo API groups, including existing teststudent password login, empty-field demo login, 17 spots, 16 forecast dates, denied staff/private operations and independent logout.
- Repeated diagnostic sign-ins reached staging's expected 429 login limit. Security settings were unchanged. Both complete suites passed after the window expired.
- Visual comparison uses the same forecast responses and fixed time for the preceding production UI and corrected production build. At 1440 px desktop and 430 px iPhone Pro Max widths, fonts, colours and element dimensions match. Desktop geometry is identical; mobile's maximum text rounding difference is 0.015625 px. Spot-card and expanded-hour screenshots are byte-identical; calendar and detail screenshots were also visually reviewed. The established screen design is preserved.
- Isolated browser contexts preserve the owner's tabs and sessions. Test sessions are revoked on completion. No actual Google translation service or physical phone was used; the regression exercises its documented DOM-mutation pattern rather than certifying every translator/browser combination.

## Maintenance

Run `node scripts/check-translation-browser.mjs https://staging.mywaveplan.com` and the production equivalent after changes to forecast loading or dynamic text. The same script accepts `http://localhost:3011` for a local production build and proxies its API requests to staging. The `--expect-crash` option is only for the preceding unfixed release. Keep rate limits in mind when repeating authentication tests.

Keep the stable text-element structure when editing tiles and metrics. A6 still needs privacy-reviewed central browser error collection, source maps, release/environment attribution, redaction, alerting and physical-device verification. This repair does not complete A6 or the planned localisation work.
