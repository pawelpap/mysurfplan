// Derive progress from saved settings and exact published legal evidence.
export function schoolSetupProgress(school, legal = {}) {
  const document = legal.documents?.find(value => value.kind === 'school_processing');
  const acceptance = document && legal.acceptances?.find(record => record.school_id === school.id &&
    record.document_id === document.document_id && record.version === document.version &&
    record.language === document.language && record.content_hash === document.content_hash);
  const steps = [
    { key: 'basics', complete: Boolean(school.name?.trim() && school.timezone) },
    { key: 'description', complete: Boolean(school.description?.trim()) },
    { key: 'contact', complete: Boolean(school.contactEmail?.trim() || school.contactPhone?.trim()) },
    { key: 'spots', complete: Boolean(school.operatingSpotIds?.length) },
    { key: 'agreement', complete: Boolean(document?.status === 'published' && acceptance) },
  ];
  return { steps, done: steps.filter(step => step.complete).length, total: steps.length,
    preview: document?.status === 'staging_preview', previewAccepted: Boolean(acceptance && document?.status === 'staging_preview') };
}
