import Link from "next/link";
import { LegalLayout, LegalText, legalSections } from "../../components/legal";
import { useLocale, LocaleProvider } from "../../components/locale";
import { legalDocuments } from "../../lib/legal/contracts.mjs";
import { findLegalDocument, legalDocumentRequest } from "../../lib/legal/navigation.mjs";
import { defaultLocale, legalHref, localeNames } from "../../lib/locale/preferences.mjs";

export default function LegalDocument(props) {
  return <LocaleProvider pageLocale={props.locale}><DocumentPage {...props} /></LocaleProvider>;
}

function DocumentPage({ document, locale, slug, selection, canSaveLocale, signedIn, pending = false, historicalFallback = false }) {
  const { t } = useLocale();
  const draft = document.status === "staging_preview" && document.language !== defaultLocale;
  const date = document.effective_at && new Date(document.effective_at).toLocaleDateString(locale, {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Lisbon",
  });
  const metadata = !pending && <p className="legal-metadata">
    {t("Version")} {document.version}{date ? t(" · Updated ") + date : ""}
  </p>;
  return <LegalLayout title={pending ? t(document.title) : document.title} slug={slug}
    titleLanguage={document.language} sections={document.content ? legalSections(document.content) : []}
    signedIn={signedIn} preview={document.status === "staging_preview"} metadata={metadata}
    selection={selection} currentDocument={pending ? undefined : document} canSaveLocale={canSaveLocale}>
    {pending ? <p>{t("This document is being prepared. Contact support@mywaveplan.com for privacy or service questions.")}</p> : <>
      {draft && <p className="environment-note">
        {t("Translation draft for review.")}{" "}
        <Link href={legalHref(slug, defaultLocale, document.version)}>{t("Review the English document")}</Link>
      </p>}
      {historicalFallback ? <div className="environment-note">
        <p>{t("legal.historicalTranslationUnavailable", { language: localeNames[document.language] })}</p>
        <Link href={legalHref(slug, document.language, document.version)}>{t("legal.openExactVersion")}</Link>{" · "}
        <Link href={legalHref(slug, locale)}>{t("legal.openLatestForLanguage")}</Link>
      </div> : document.language !== locale &&
        <p className="environment-note">{t("Translation unavailable. Showing the English document.")}</p>}
      <LegalText content={document.content} language={document.language} />
      {["terms", "school_processing"].includes(document.kind) &&
        <p className="legal-document-next"><Link className="document-action" href="/legal/records">{t("Review your agreement status")}</Link></p>}
    </>}
  </LegalLayout>;
}

export async function getServerSideProps({ req, res, params, query }) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const request = legalDocumentRequest(query, null, req.headers["accept-language"]);
  if (!request) return { notFound: true };

  const { getAuthSession } = await import("../../lib/auth");
  const session = await getAuthSession(req);
  const signedIn = Boolean(session);
  const documentRequest = session?.preferredLocale
    ? legalDocumentRequest(query, session.preferredLocale, req.headers["accept-language"])
    : request;
  const { locale, selection, version } = documentRequest;
  const slug = params.document;
  const props = { slug, locale, signedIn, selection, canSaveLocale: signedIn && !session.demo };

  if (slug === "storage") {
    const { getStorageNotice, isStorageStagingPreview } = await import("../../lib/legal/storage-notice.mjs");
    const preview = isStorageStagingPreview(req.headers.host, process.env.VERCEL_PROJECT_ID);
    const document = await findLegalDocument(
      ({ version, language }) => getStorageNotice(version, language, { preview }), documentRequest,
    );
    return document ? { props: { ...props, document, historicalFallback: Boolean(version && document.language !== locale) } } : { notFound: true };
  }
  const descriptor = legalDocuments.find(d => d.slug === slug);
  if (!descriptor) return { notFound: true };
  const { sql } = await import("../../lib/db");
  const { createLegalStore } = await import("../../lib/legal/store.mjs");
  const store = createLegalStore(sql);
  const preview = await store.preview(req);
  const document = await findLegalDocument(
    ({ language, version }) => store.document(descriptor.id, { language, version, preview }), documentRequest,
  );
  if (!document) {
    if (version) return { notFound: true };
    return { props: { ...props, document: { title: descriptor.title, language: locale }, pending: true } };
  }
  if (document.kind === "privacy_notice" && session && !session.demo) {
    try {
      await store.record({ action: "notice_delivery", userId: session.userId, documentId: document.document_id,
        version: document.version, language: document.language, contentHash: document.content_hash }, { preview });
    } catch { /* Public notice availability does not depend on evidence writes. */ }
  }
  return { props: { ...props, document: JSON.parse(JSON.stringify(document)), historicalFallback: Boolean(version && document.language !== locale) } };
}
