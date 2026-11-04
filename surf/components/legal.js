import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Brand, request } from "./workspace/ui";
import { LanguageSelector, useLocale } from "./locale";
import { ThemeSelector } from "./theme";
import { legalDocuments } from "../lib/legal/contracts.mjs";
import { legalLanguageSwitchHref } from "../lib/legal/navigation.mjs";
import { legalHref } from "../lib/locale/preferences.mjs";

export function legalSections(content) {
  return content.split(/\n\s*\n/).flatMap((block, i) =>
    block.startsWith("## ") ? [{ id: "section-" + i, title: block.slice(3) }] : []);
}

export function LegalLayout({
  title, children, slug, titleLanguage, sections = [], signedIn = false, preview = false,
  metadata, selection, currentDocument, canSaveLocale = false,
}) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const links = <>
    {legalDocuments.map(d => <Link key={d.id} href={legalHref(d.slug, locale)}
      aria-current={d.slug === slug ? "page" : undefined}>{t(d.title)}</Link>)}
    <Link href={legalHref("storage", locale)} aria-current={slug === "storage" ? "page" : undefined}>{t("Cookies and browser storage")}</Link>
    <Link href="/legal" aria-current={!slug ? "page" : undefined}>{t("Data licences")}</Link>
  </>;
  const contents = <nav aria-label={t("On this page")} lang={titleLanguage}>
    {sections.map(s => <a key={s.id} href={"#" + s.id}>{s.title}</a>)}
  </nav>;
  async function saveLocale(next) {
    await request("/api/auth/locale", { method: "PATCH", body: JSON.stringify({ locale: next }) });
  }
  return <>
    <Head><title>{`${title} · MyWavePlan`}</title><meta name="robots" content="noindex, nofollow" /></Head>
    <a className="skip-link" href="#document" lang={locale}>{t("Skip to document")}</a>
    <div className="legal-page" lang={locale}>
      <header className="legal-header">
        <Link href="/" className="legal-brand" aria-label={t("MyWavePlan home")}><Brand /></Link>
        <div className="legal-header-actions">
          <ThemeSelector compact />
          <LanguageSelector compact selection={selection} saveAccountLocale={canSaveLocale ? saveLocale : undefined}
            onLocaleChange={slug ? next => router.push(legalLanguageSwitchHref(slug, next, currentDocument)) : undefined} />
        </div>
      </header>
      <div className="legal-tools">
        <details className="legal-menu"><summary>{t("Legal documents")}</summary><nav aria-label={t("Legal documents")}>{links}</nav></details>
        <Link className="document-action" href={signedIn ? "/?view=privacy" : "/login"}>{t(signedIn ? "Back to workspace" : "Log in")}</Link>
      </div>
      {preview && <p className="environment-note">{t("Staging · Preview of the production document.")}</p>}
      <div className={`legal-reading-layout ${sections.length ? "with-contents" : ""}`}>
        {sections.length > 0 && <aside className="legal-contents"><h2>{t("On this page")}</h2>{contents}</aside>}
        <main id="document" tabIndex={-1} data-legal-document>
          <h1 lang={titleLanguage}>{title}</h1>
          {metadata}
          {sections.length > 0 && <details className="legal-mobile-contents"><summary>{t("On this page")}</summary>{contents}</details>}
          {children}
        </main>
      </div>
      <footer className="legal-footer"><Link href="/legal/records">{t("Privacy and agreements")}</Link><a href="mailto:support@mywaveplan.com">{t("Contact support")}</a></footer>
    </div>
  </>;
}

function inlineText(text) {
  return text.split(/(\[[^\]]+\]\(https:\/\/[^)]+\))/g).map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
    return link ? <a key={i} href={link[2]} rel="noreferrer">{link[1]}</a> : part;
  });
}

// Stored policy text cannot execute HTML.
export function LegalText({ content, language }) {
  return <div className="legal-copy" lang={language}>{content.split(/\n\s*\n/).map((block, i) => {
    if (block.startsWith("## ")) return <h2 key={i} id={"section-" + i}>{block.slice(3)}</h2>;
    if (block.startsWith("### ")) return <h3 key={i}>{block.slice(4)}</h3>;
    if (block.split("\n").every(line => line.startsWith("- ")))
      return <ul key={i}>{block.split("\n").map((line, j) => <li key={j}>{inlineText(line.slice(2))}</li>)}</ul>;
    return <p key={i}>{inlineText(block)}</p>;
  })}</div>;
}
