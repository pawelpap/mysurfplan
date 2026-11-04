import assert from "node:assert/strict";
import test from "node:test";
import { agreementAcceptance } from "../lib/legal/agreement-status.mjs";
import { findLegalDocument, legalDocumentRequest, legalLanguageSwitchHref } from "../lib/legal/navigation.mjs";
import { getStorageNotice, isStorageStagingPreview } from "../lib/legal/storage-notice.mjs";
import { legalHref } from "../lib/locale/preferences.mjs";

function documentRequest(href, header = "es-ES") {
  const url = new URL(href, "http://localhost");
  return legalDocumentRequest(Object.fromEntries(url.searchParams), null, header);
}

const loadStorage = ({ version, language }) => getStorageNotice(version, language);

test("the storage draft is available only to the staging host and project; exact older texts remain available", () => {
  const stageProject = "prj_sWC9MbvG8rWtAO0YpuSNiOqZwYlO";
  const preview = isStorageStagingPreview("staging.mywaveplan.com", stageProject);
  assert.equal(preview, true);
  assert.equal(isStorageStagingPreview("staging.mywaveplan.com", undefined), false);
  assert.equal(isStorageStagingPreview("staging.mywaveplan.com", "another-project"), false);
  assert.equal(isStorageStagingPreview("mywaveplan.com", stageProject), false);

  for (const language of ["en-GB", "pt-PT", "es", "fr"]) {
    const latest = getStorageNotice(undefined, language, { preview });
    assert.equal(latest.version, "2026-11-04.2");
    assert.equal(latest.language, language);
    assert.equal(latest.status, "staging_preview");
    assert.equal(getStorageNotice(latest.version, language), null);
    assert.deepEqual(getStorageNotice("2026-11-04.1", language, { preview }), getStorageNotice(undefined, language));
  }
});

test("switching an English-only historical notice retains the version and original text", async () => {
  const original = getStorageNotice("2026-10-06.2");
  const switched = documentRequest(legalLanguageSwitchHref("storage", "es", original));
  assert.equal(switched.locale, "es");
  assert.equal(switched.version, original.version);
  assert.deepEqual(await findLegalDocument(loadStorage, switched), original);

  // Only a separate, unpinned link may open the latest translated notice.
  const latest = await findLegalDocument(loadStorage, documentRequest(legalHref("storage", "es")));
  assert.equal(latest.language, "es");
  assert.notEqual(latest.version, original.version);

  // An exact evidence link cannot silently open a document in another language.
  const exact = documentRequest(legalHref("storage", "es", original.version));
  assert.equal(await findLegalDocument(loadStorage, exact), null);
});

test("switching to an available translation opens the same version, including Browser default", async () => {
  const source = getStorageNotice("2026-11-04.1", "fr");
  const automatic = documentRequest(legalLanguageSwitchHref("storage", null, source));
  assert.equal(automatic.selection, null);
  assert.equal(automatic.locale, "es");
  const translated = await findLegalDocument(loadStorage, automatic);
  assert.equal(translated.version, source.version);
  assert.equal(translated.language, "es");
});

test("a historical policy falls back to the rendered source language without a latest-version lookup", async () => {
  const original = { version: "v1", language: "fr" };
  const calls = [];
  const load = (query) => {
    calls.push(query);
    return query.language === "fr" && query.version === "v1" ? original : null;
  };
  const switched = documentRequest(legalLanguageSwitchHref("terms", "pt-PT", original));
  assert.equal(await findLegalDocument(load, switched), original);
  assert.deepEqual(calls, [
    { version: "v1", language: "pt-PT" },
    { version: "v1", language: "fr" },
  ]);
});

test("another language of the same agreement version links to its original evidence", () => {
  const french = { document_id: "mywaveplan.adult-pilot-terms", version: "v2", language: "fr", content_hash: "fr-v2" };
  const english = { ...french, language: "en-GB", content_hash: "en-v2", school_id: null };
  const older = { ...french, version: "v1", content_hash: "fr-v1", school_id: null };

  assert.deepEqual(agreementAcceptance(french, [older, english]), { status: "other-language", record: english });
  assert.deepEqual(agreementAcceptance(french, [older]), { status: "other-version", record: older });
  assert.deepEqual(agreementAcceptance(french, [english, french]), { status: "exact", record: french });
  assert.equal(agreementAcceptance(french, [{ ...french, content_hash: "different" }]).status, "none");
});

test("agreement status cannot use another school's acceptance", () => {
  const document = { document_id: "mywaveplan.school-processing", version: "v1", language: "fr", content_hash: "fr-v1" };
  const otherSchool = { ...document, school_id: "school-b" };
  const sameSchool = { ...document, school_id: "school-a", language: "en-GB", content_hash: "en-v1" };
  assert.deepEqual(agreementAcceptance(document, [otherSchool, sameSchool], "school-a"), {
    status: "other-language", record: sameSchool,
  });
  assert.equal(agreementAcceptance(document, [otherSchool], "").status, "none");
});
