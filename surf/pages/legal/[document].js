import Link from 'next/link';
import { LegalLayout, LegalText, legalSections } from '../../components/legal';
import { legalDocuments } from '../../lib/legal/contracts.mjs';

export default function LegalDocument({ document, pending = false, signedIn = false }) {
  const metadata = !pending && <p className="legal-metadata">Version {document.version}{document.effective_at ? ' · Updated ' + new Date(document.effective_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'Europe/Lisbon' }) : ''}</p>;
  return <LegalLayout title={document.title} language={document.language} sections={document.content ? legalSections(document.content) : []} signedIn={signedIn} preview={document.status === 'staging_preview'} metadata={metadata}>
    {pending ? <p>This document is being prepared. Contact support@mywaveplan.com for privacy or service questions.</p> : <>
      <LegalText content={document.content} />
      {['terms','school_processing'].includes(document.kind) && <p className="legal-document-next"><Link className="document-action" href="/legal/records">Review your agreement status</Link></p>}
    </>}
  </LegalLayout>;
}

export async function getServerSideProps({ req, res, params, query }) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  const language = query.language || 'en-GB';
  const { getAuthSession } = await import('../../lib/auth');
  const session = await getAuthSession(req);
  const signedIn = Boolean(session);
  if (typeof language !== 'string' || !['en-GB','pt-PT','es'].includes(language) ||
      (query.version !== undefined && (typeof query.version !== 'string' || query.version.length > 80))) return { notFound:true };
  if (params.document === 'storage') {
    const { storageNotice } = await import('../../lib/legal/storage-notice.mjs');
    if (language !== storageNotice.language || (query.version && query.version !== storageNotice.version)) return { notFound:true };
    return { props:{ document:storageNotice, signedIn } };
  }
  const descriptor = legalDocuments.find(d => d.slug === params.document);
  if (!descriptor) return { notFound:true };
  const { sql } = await import('../../lib/db');
  const { createLegalStore } = await import('../../lib/legal/store.mjs');
  const store = createLegalStore(sql);
  const preview = await store.preview(req);
  const document = await store.document(descriptor.id,{ language, version:query.version,preview });
  if (!document) {
    if (language !== 'en-GB' || query.version) return { notFound:true };
    return { props:{document:{title:descriptor.title,language},pending:true,signedIn} };
  }
  if (document.kind === 'privacy_notice') {
    // Delivery is recorded by the server serving the notice, never a required
    // checkbox, consent or assertion that the person has read it.
    try {
      if (session && !session.demo) await store.record({action:'notice_delivery',userId:session.userId,documentId:document.document_id,version:document.version,language:document.language,contentHash:document.content_hash},{preview});
    } catch { /* Public notice availability does not depend on evidence writes. */ }
  }
  return { props:{document:JSON.parse(JSON.stringify(document)),signedIn} };
}
