import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Brand, Button, Field, Message, request } from '../../components/workspace/ui';
import { LanguageSelector, LocaleProvider, useLocale } from '../../components/locale';
import { accountNext, validAccountToken, validNewPassword } from '../../lib/account-flow.mjs';
import { isLocale, legalHref } from '../../lib/locale/preferences.mjs';

export async function getServerSideProps({ params, query, req, res }) {
  if (!['register', 'recover', 'verify', 'reset'].includes(params.step)) return { notFound: true };
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const { accountConfig } = await import('../../lib/account-server.mjs');
  const config = accountConfig(req);
  return { props: {
    step: params.step,
    available: Boolean(config),
    privateEmailTest: config?.environment === 'production' && !config.publicAccounts,
    next: accountNext(query.next),
    linkLocale: isLocale(query.language) ? query.language : null,
  } };
}

export default function AccountPage(props) {
  const { locale } = useLocale();
  return <LocaleProvider pageLocale={props.linkLocale ?? locale}>
    <AccountForm key={props.step} {...props} />
  </LocaleProvider>;
}
AccountPage.systemTheme = true;

function AccountForm({ step, available, privateEmailTest, next, linkLocale }) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const completing = step === 'verify' || step === 'reset';
  const verifying = step === 'verify';
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [adult, setAdult] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(null);
  const [terms, setTerms] = useState(null);
  const [termsAttempt, setTermsAttempt] = useState(0);
  const [termsFailed, setTermsFailed] = useState(false);
  const [sent, setSent] = useState(false);
  const [finished, setFinished] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!completing) return;
    function loadToken() {
      if (!window.location.hash) {
        setToken(value => value ?? '');
        return;
      }
      const hash = window.location.hash.slice(1);
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      setToken(validAccountToken(hash) ? hash : '');
    }
    loadToken();
    window.addEventListener('hashchange', loadToken);
    return () => window.removeEventListener('hashchange', loadToken);
  }, [completing]);

  useEffect(() => {
    if (!verifying || !available || !token) return;
    let current = true;
    request('/api/auth/terms?locale=' + locale)
      .then(document => { if (current) { setTerms(document); setTermsFailed(!document); } })
      .catch(() => { if (current) { setTerms(null); setTermsFailed(true); } });
    return () => { current = false; };
  }, [verifying, available, token, locale, termsAttempt]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (completing && password !== repeat) return setError('account.passwordMismatch');
    if (completing && !validNewPassword(password)) return setError('account.passwordHint');
    if (verifying && (!currentTerms || acceptedTerms !== termsKey || !adult)) return setError('account.completeFields');
    setBusy(true);
    try {
      const payload = completing ? { token, password, locale,
        ...(verifying ? { name, adult, accepted: true, terms: currentTerms } : {}) }
        : { email, next, locale };
      const data = await request('/api/auth/' + step, { method: 'POST', body: JSON.stringify(payload) });
      if (completing) {
        setFinished(data.next);
        setToken('');
        setPassword('');
        setRepeat('');
      } else {
        setSent(true);
      }
    } catch (failure) {
      setError(failure.message.startsWith('account.') || failure.message === 'login.rateLimit'
        ? failure.message : 'account.unavailable');
      if (failure.status === 409) {
        setTerms(null);
        setAcceptedTerms(null);
        setTermsAttempt(value => value + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  const currentTerms = terms?.language === locale ? terms : null;
  const termsKey = currentTerms && [currentTerms.language, currentTerms.version, currentTerms.contentHash].join(':');
  const loginHref = { pathname: '/login', query: { next: finished ?? next } };
  const requestHref = '/account/' + (verifying ? 'register' : 'recover');
  const title = t(`account.${step}Title`);
  return (
    <main className="account-shell" lang={locale}>
      <Head><title>{title + ' · MyWavePlan'}</title></Head>
      <header className="login-brand">
        <Brand />
        <LanguageSelector compact selection={linkLocale ?? undefined}
          onLocaleChange={linkLocale ? selected => router.replace({
            pathname: router.pathname, query: { step, ...(selected ? { language: selected } : {}) },
          }, undefined, { shallow: false }) : undefined} />
      </header>
      <section className="login-panel" aria-labelledby="account-title">
        <p className="login-welcome">MyWavePlan</p>
        <h1 id="account-title">{sent ? t('account.checkTitle') : title}</h1>
        {!available ? <Message>{t('account.unavailable')}</Message>
          : finished ? <p role="status">{t(verifying ? 'account.created' : 'account.resetDone')}</p>
          : completing && !token ? <div aria-live="polite">
            {token === '' && <><Message>{t('account.invalidLink')}</Message><Link href={requestHref}>{t('account.newLink')}</Link></>}
          </div>
          : <>
            <p role={sent ? 'status' : undefined}>{sent ? t('account.checkBody') : t(privateEmailTest && !completing ? 'account.privateEmailTest' : `account.${step}Intro`)}</p>
            {sent && <p>{t('account.checkHelp')}</p>}
            <form className="auth-form" onSubmit={submit}>
              {!completing && <Field label={t('account.email')} type="email" autoComplete="email"
                maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} />}
              {verifying && <Field label={t('account.name')} autoComplete="name" maxLength={120} required
                value={name} onChange={event => setName(event.target.value)} />}
              {completing && <>
                <Field label={t('account.password')} type="password" autoComplete="new-password"
                  hint={t('account.passwordHint')} required maxLength={256}
                  value={password} onChange={event => setPassword(event.target.value)} />
                <Field label={t('account.repeat')} type="password" autoComplete="new-password" required maxLength={256}
                  value={repeat} onChange={event => setRepeat(event.target.value)} />
              </>}
              {verifying && <>
                <label className="agreement-check"><input type="checkbox" checked={adult} required
                  onChange={event => setAdult(event.target.checked)} />{t('account.adult')}</label>
                {currentTerms ? <>
                  <Link href={legalHref('terms', currentTerms.language, currentTerms.version)} target="_blank" rel="noreferrer">
                    {t('legal.terms')} · {currentTerms.version}
                  </Link>
                  <label className="agreement-check"><input type="checkbox" checked={acceptedTerms === termsKey} required
                    onChange={event => setAcceptedTerms(event.target.checked ? termsKey : null)} />{t('account.accept')}</label>
                </> : termsFailed ? <>
                  <Message>{t('account.unavailable')}</Message>
                  <Button onClick={() => {
                    setTermsFailed(false);
                    setError('');
                    setAcceptedTerms(null);
                    setTermsAttempt(value => value + 1);
                  }}>{t('account.retryTerms')}</Button>
                </> : <p role="status">{t('account.loadingTerms')}</p>}
              </>}
              <Message>{error && t(error)}</Message>
              {error === 'account.invalidLink' && <Link href={requestHref}>{t('account.newLink')}</Link>}
              <Button tone="primary" type="submit" disabled={busy || (verifying && !currentTerms)}>
                {t(busy ? 'account.busy' : completing ? `account.${step}Title` : sent ? 'account.resend' : 'account.send')}
              </Button>
            </form>
          </>}
        <div className="auth-help">
          <p><Link href={loginHref}>{t('account.back')}</Link></p>
          <p><Link href={legalHref('privacy', locale)} target="_blank" rel="noreferrer">{t('account.privacy')}</Link></p>
          <p><a href="mailto:support@mywaveplan.com">{t('account.support')}</a></p>
        </div>
      </section>
    </main>
  );
}
