import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Brand, Button, Loading, Message } from '../components/workspace/ui';
import { LanguageSelector, LocaleProvider, useLocale } from '../components/locale';
import { isLocale } from '../lib/locale/preferences.mjs';
import { accountNext } from '../lib/account-flow.mjs';
import { clearInvitation, invitationContinuation, invitationNext } from '../lib/invitation-continuation.mjs';

export async function getServerSideProps({ query, res }) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return { props: { linkLocale: isLocale(query.language) ? query.language : null } };
}
function tabStorage() { try { return window.sessionStorage; } catch { return null; } }
async function call(url, body, method = 'POST', signal) {
  const response = await fetch(url, { method, signal, headers: { 'Content-Type': 'application/json', 'X-MyWavePlan-Request': '1' },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) {
    const error = new Error(typeof json.error === 'string' &&
      (json.error.startsWith('invitation.') || json.error === 'login.rateLimit') ? json.error : 'invitation.unavailable');
    error.status = response.status;
    throw error;
  }
  return json.data;
}
export default function InvitationPage({ linkLocale }) {
  const { locale } = useLocale();
  const [selected, setSelected] = useState(linkLocale);
  function changeLanguage(value) {
    setSelected(value);
    window.history.replaceState(window.history.state, '', '/invitation' + (value ? '?language=' + encodeURIComponent(value) : ''));
  }
  return <LocaleProvider pageLocale={selected ?? locale}>
    <InvitationContent onLanguage={changeLanguage} selected={selected} />
  </LocaleProvider>;
}
InvitationPage.systemTheme = true;

function InvitationContent({ onLanguage, selected }) {
  const { locale, t, formatDate } = useLocale();
  const [continuation, setContinuation] = useState(null);
  const [session, setSession] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [accepted, setAccepted] = useState(null);
  const actionLock = useRef(false);
  const forget = useCallback(() => clearInvitation(tabStorage()), []);

  useEffect(() => {
    function capture() {
      const fragment = window.location.hash;
      // Strip the secret before any network requests or navigation.
      if (fragment) {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
        setAccepted(null); setPreview(null); setError('');
      }
      setContinuation(old => !fragment && old ? old : invitationContinuation(fragment, tabStorage()));
    }
    capture();
    window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, []);

  useEffect(() => {
    if (!continuation) return;
    if (!continuation.token || accepted) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(''); setPreview(null);
    async function load() {
      try {
        const current = await call('/api/auth/session', null, 'GET', controller.signal);
        if (controller.signal.aborted) return;
        setSession(current || null);
        if (!current || current.demo) return;
        const offer = await call('/api/invitations/preview', { token: continuation.token }, 'POST', controller.signal);
        if (!controller.signal.aborted) setPreview(offer);
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure.status === 401) { setSession(null); return; }
        if (failure.message === 'invitation.invalidLink') {
          forget(); setContinuation({ token: '', stored: false });
        } else setError(failure.message);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    load();
    return () => controller.abort();
  }, [continuation, attempt, accepted, forget]);

  const next = invitationNext(locale);
  const login = { pathname: '/login', query: { next, language: locale } };
  const register = { pathname: '/account/register', query: { next, language: locale } };
  async function accept() {
    if (actionLock.current || !preview?.verified || !preview?.emailMatches || !continuation?.token) return;
    actionLock.current = true; setBusy(true); setError('');
    try {
      const result = await call('/api/invitations/accept', { token: continuation.token });
      forget(); setContinuation({ token: '', stored: false }); setPreview(null);
      setAccepted(accountNext(result?.next));
      window.dispatchEvent(new Event('account-access-changed'));
    } catch (failure) {
      if (failure.status === 401) { setSession(null); setPreview(null); }
      else if (failure.message === 'invitation.invalidLink') { forget(); setContinuation({ token: '', stored: false }); }
      else setError(failure.message);
    } finally { actionLock.current = false; setBusy(false); }
  }
  async function switchAccount() {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError('');
    try {
      await call('/api/auth/session', null, 'DELETE');
      window.location.assign('/login?language=' + encodeURIComponent(locale) + '&next=' + encodeURIComponent(next));
    } catch (failure) { setError(failure.message); actionLock.current = false; setBusy(false); }
  }
  const missing = continuation && !continuation.token;
  const wrong = session && (session.demo || (preview && !preview.emailMatches));
  const unverified = session && preview?.emailMatches && !preview.verified;
  const state = accepted ? 'success' : missing ? 'unavailable' : wrong ? 'wrong' : unverified ? 'unverified' : session ? 'review' : 'signedout';
  const title = accepted ? 'invitation.success' : missing ? 'invitation.unavailableTitle' : wrong ? 'invitation.wrongTitle'
    : unverified ? 'invitation.unverified' : session ? 'invitation.title' : 'invitation.invited';
  return <main className="invitation-shell" lang={locale}>
    <Head><title>{t(title) + " · MyWavePlan"}</title><meta name="referrer" content="no-referrer" /></Head>
    <header className="invitation-header"><Link href="/" onClick={forget} aria-label="MyWavePlan"><Brand /></Link>
      <LanguageSelector compact selection={selected ?? undefined} onLocaleChange={onLanguage} /></header>
    <section className="invitation-content" data-state={state} aria-labelledby="invitation-title" aria-busy={loading || busy}>
      <h1 id="invitation-title">{t(title)}</h1>
      {loading ? <Loading /> : accepted ? <div className="surface padded invitation-card">
        <p role="status">{t('invitation.successHelp')}</p>
        <Link className="button primary" href={accepted}>{t('invitation.continue')}</Link>
      </div> : missing ? <div className="surface padded invitation-card">
        <p>{t('invitation.invalidLink')}</p><Link className="button secondary" href="/" onClick={forget}>{t('invitation.back')}</Link>
      </div> : <>
        {!continuation?.stored && <p className="team-notice">{t('invitation.storageHelp')}</p>}
        <Message>{error && t(error)}</Message>
        {error && <Button disabled={busy} onClick={() => setAttempt(n => n + 1)}>{t('Try again')}</Button>}
        {!session ? <div className="surface padded invitation-card">
          <p className="invitation-intro">{t('invitation.signInHelp')}</p>
          <Link className="button primary" href={login}>{t('invitation.signIn')}</Link>
          <Link className="button secondary" href={register}>{t('invitation.register')}</Link>
          <p className="muted-note">{t('invitation.reopen')}</p>
        </div> : wrong ? <div className="surface padded invitation-card">
          <p className="invitation-intro">{t('invitation.wrongBody')}</p>
          <Button disabled={busy} onClick={switchAccount}>{t(busy ? 'team.busy' : 'invitation.switch')}</Button>
        </div> : unverified ? <div className="surface padded invitation-card">
          <p className="invitation-intro">{t('invitation.unverifiedHelp')}</p><a className="button primary" href="mailto:support@mywaveplan.com">{t('invitation.support')}</a>
          <Button disabled={busy} onClick={switchAccount}>{t('invitation.different')}</Button>
        </div> : preview && <div className="surface padded invitation-card">
          <h2>{preview.schoolName}</h2><p className="invitation-intro">{t('invitation.review')}</p>
          <ul className="invitation-roles">{preview.roles.map(role => <li key={role} className={"invitation-role-" + role}><strong>{t('team.' + role)}</strong>
            <p>{t(role === 'coach' ? 'team.coachHelp' : 'team.adminHelp')}</p></li>)}</ul>
          {preview.legacyCoachId && <p className="team-notice">{t('invitation.claimNotice')}</p>}
          <p className="muted-note invitation-identity"><span>{t('invitation.signedInLabel')}</span><span>{session.email}</span>
            {t('team.expires', { date: formatDate(preview.expiresAt, { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
          <Button tone="primary" disabled={busy} onClick={accept}>{t(busy ? 'team.busy' : 'invitation.accept')}</Button>
          <Button tone="quiet" disabled={busy} onClick={switchAccount}>{t('invitation.different')}</Button>
        </div>}
      </>}
      <p className="muted-note">{t('invitation.unchanged')}</p>
      {!missing && !accepted && <Link href="/" onClick={forget}>{t('invitation.back')}</Link>}
    </section>
  </main>;
}
