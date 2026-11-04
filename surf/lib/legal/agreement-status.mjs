export function agreementAcceptance(document, records, schoolId = null) {
  let sameVersion = null;
  let differentVersion = null;
  for (const record of records) {
    if (record.document_id !== document.document_id || (record.school_id ?? null) !== schoolId) continue;
    if (record.version !== document.version) {
      differentVersion ??= record;
    } else if (record.language !== document.language) {
      sameVersion ??= record;
    } else if (record.content_hash === document.content_hash) {
      return { status: "exact", record };
    }
  }
  if (sameVersion) return { status: "other-language", record: sameVersion };
  if (differentVersion) return { status: "other-version", record: differentVersion };
  return { status: "none", record: null };
}
