import Head from 'next/head';
import Link from 'next/link';
import { Brand } from './workspace/ui';
import { ThemeSelector } from './theme';
import { legalDocuments } from '../lib/legal/contracts.mjs';

export function legalSections(content) {
  return content.split(/\n\s*\n/).flatMap((block,i) => block.startsWith('## ') ? [{ id:'section-' + i, title:block.slice(3) }] : []);
}
export function LegalLayout({ title, children, language = 'en-GB', sections = [], signedIn = false, preview = false, metadata }) {
  const links = <>
    {legalDocuments.map(d => <Link key={d.id} href={'/legal/' + d.slug} aria-current={d.title === title ? 'page' : undefined}>{d.title}</Link>)}
    <Link href="/legal/storage" aria-current={title === 'Cookies and browser storage' ? 'page' : undefined}>Cookies and browser storage</Link>
    <Link href="/legal" aria-current={title === 'Data licences' ? 'page' : undefined}>Data licences</Link>
  </>;
  const contents = <nav aria-label="On this page">{sections.map(s => <a key={s.id} href={'#' + s.id}>{s.title}</a>)}</nav>;
  return <>
    <Head><title>{`${title} · MyWavePlan`}</title><meta name="robots" content="noindex, nofollow" /></Head>
    <a className="skip-link" href="#document">Skip to document</a>
    <div className="legal-page" lang={language}>
      <header className="legal-header"><Link href="/" className="legal-brand" aria-label="MyWavePlan home"><Brand /></Link><ThemeSelector compact /></header>
      <div className="legal-tools">
        <details className="legal-menu"><summary>Legal documents</summary><nav aria-label="Legal documents">{links}</nav></details>
        <Link className="document-action" href={signedIn ? '/?view=privacy' : '/'}>{signedIn ? 'Back to workspace' : 'Log in'}</Link>
      </div>
      {preview && <p className="environment-note">Staging · Preview of the production document.</p>}
      <div className={`legal-reading-layout ${sections.length ? 'with-contents' : ''}`}>
        {sections.length > 0 && <aside className="legal-contents"><h2>On this page</h2>{contents}</aside>}
        <main id="document" tabIndex={-1} data-legal-document>
          <h1>{title}</h1>
          {metadata}
          {sections.length > 0 && <details className="legal-mobile-contents"><summary>On this page</summary>{contents}</details>}
          {children}
        </main>
      </div>
      <footer className="legal-footer"><Link href="/legal/records">Privacy and agreements</Link><a href="mailto:support@mywaveplan.com">Contact support</a></footer>
    </div>
  </>;
}

function inlineText(text) {
  return text.split(/(\[[^\]]+\]\(https:\/\/[^)]+\))/g).map((part,i) => {
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
    return link ? <a key={i} href={link[2]} rel="noreferrer">{link[1]}</a> : part;
  });
}
// Stored policy text cannot execute HTML.
export function LegalText({ content }) {
  return <div className="legal-copy">{content.split(/\n\s*\n/).map((block,i) => {
    if (block.startsWith('## ')) return <h2 key={i} id={'section-' + i}>{block.slice(3)}</h2>;
    if (block.startsWith('### ')) return <h3 key={i}>{block.slice(4)}</h3>;
    if (block.split('\n').every(line => line.startsWith('- '))) return <ul key={i}>{block.split('\n').map((line,j) => <li key={j}>{inlineText(line.slice(2))}</li>)}</ul>;
    return <p key={i}>{inlineText(block)}</p>;
  })}</div>;
}
