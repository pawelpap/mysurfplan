import { agreementAcceptance } from './legal/agreement-status.mjs';
// Derive progress from saved settings and the accepted version, preserving the
// original language/hash evidence when the interface language changes.
export function schoolSetupProgress(school, legal = {}) {
  const document = legal.documents?.find(value => value.kind === 'school_processing');
  const status=document&&agreementAcceptance(document,legal.acceptances||[],school.id);
  const acceptance=status&&['exact','other-language'].includes(status.status)?status.record:null;
  const steps = [
    { key: 'basics', complete: Boolean(school.name?.trim() && school.timezone) },
    { key: 'description', complete: Boolean(school.description?.trim()) },
    { key: 'contact', complete: Boolean(school.contactEmail?.trim() || school.contactPhone?.trim()) },
    { key: 'spots', complete: Boolean(school.operatingSpotIds?.length) },
    { key: 'agreement', complete: Boolean(document?.status === 'published' && acceptance?.status === 'published') },
  ];
  return { steps, done: steps.filter(step => step.complete).length, total: steps.length,
    preview: document?.status === 'staging_preview', previewAccepted: Boolean(acceptance && document?.status === 'staging_preview') };
}
