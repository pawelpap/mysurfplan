import Head from 'next/head';
import Link from 'next/link';
import { Brand } from './workspace/ui';
import { ThemeSelector } from './theme';
import { legalDocuments } from '../lib/legal/contracts.mjs';

export function LegalLayout({ title, children, language = 'en-GB' }) {
  return <>
    <Head><title>{`${title} · MyWavePlan`}</title><meta name="robots" content="noindex, nofollow" /></Head>
    <a className="skip-link" href="#document">Skip to document</a>
    <div className="legal-page" lang={language}>
      <header className="legal-header"><Brand /><ThemeSelector compact /></header>
      <nav className="legal-navigation" aria-label="Legal documents">
        {legalDocuments.map(d => <Link key={d.id} href={'/legal/' + d.slug}>{d.title}</Link>)}
        <Link href="/legal/storage">Cookies and browser storage</Link>
        <Link href="/legal">Data licences</Link>
        <Link href="/legal/records">Your legal records</Link>
      </nav>
      <main id="document" tabIndex={-1} data-legal-document><h1>{title}</h1>{children}</main>
      <footer className="legal-footer"><Link href="/">Back to MyWavePlan</Link><a href="mailto:support@mywaveplan.com">Contact support</a></footer>
    </div>
  </>;
}

function inlineText(text) {
  return text.split(/(\[[^\]]+\]\(https:\/\/[^)]+\))/g).map((part,i) => {
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
    return link ? <a key={i} href={link[2]} rel="noreferrer">{link[1]}</a> : part;
  });
}
// A deliberately small renderer. Stored policy text never executes HTML.
export function LegalText({ content }) {
  return <div className="legal-copy">{content.split(/\n\s*\n/).map((block,i) => {
    if (block.startsWith('## ')) return <h2 key={i} id={'section-' + i}>{block.slice(3)}</h2>;
    if (block.startsWith('### ')) return <h3 key={i}>{block.slice(4)}</h3>;
    if (block.split('\n').every(line => line.startsWith('- '))) return <ul key={i}>{block.split('\n').map((line,j) => <li key={j}>{inlineText(line.slice(2))}</li>)}</ul>;
    return <p key={i}>{inlineText(block)}</p>;
  })}</div>;
}
