import { useState } from 'react';
import { useLocale } from '../locale';
import { Button, Field, Loading, Message, request, useData } from './ui';

const endpoint = '/api/auth/security';
const support = 'mailto:support@mywaveplan.com';

export default function AccountSecurity({ canReview }) {
  const { t, formatDate } = useLocale();
  const status = useData(endpoint);
  const review = useData(canReview ? endpoint + '?review=1' : null);
  const [mode, setMode] = useState(null);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reviewId, setReviewId] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [supportCase, setSupportCase] = useState('');

  function open(next) {
    setMode(next);
    setCurrent('');
    setPassword('');
    setRepeat('');
    setConfirmed(false);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (mode === 'password' && password !== repeat) {
      setError('account.passwordMismatch');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await request(endpoint, { method: 'POST', body: JSON.stringify({
        action: mode, currentPassword: current,
        ...(mode === 'password' ? { newPassword: password } : { confirm: confirmed }),
      }) });
      if (mode === 'password') {
        window.location.assign('/login?next=%2F%3Fview%3Dprofile&passwordChanged=1');
        return;
      }
      if (data.outcome === 'closed') {
        window.location.assign('/login?accountClosed=1');
        return;
      }
      setReceipt(data);
      open(null);
      status.reload();
      if (canReview) review.reload();
    } catch (failure) {
      setError(failure.message.startsWith('account.') || failure.message === 'login.rateLimit'
        ? failure.message : 'account.unavailable');
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge(event, id) {
    event.preventDefault();
    setReviewError('');
    setBusy(true);
    try {
      await request(endpoint, { method: 'PATCH', body: JSON.stringify({ id, supportCase: supportCase.trim() }) });
      setReviewId(null);
      setSupportCase('');
      setReceipt(null);
      review.reload();
      status.reload();
    } catch (failure) {
      setReviewError(failure.status === 400 ? 'account.invalidSupportCase' : 'account.unavailable');
    } finally {
      setBusy(false);
    }
  }

  const active = status.loading ? receipt : status.data?.id ? status.data : receipt;
  const pending = Boolean(active?.id && !active.reviewedAt);
  return <>
    <section className="surface padded profile-access">
      <h2>{t('account.securityTitle')}</h2>
      <p className="muted">{t('account.passwordSessionEffect')}</p>
      <Button onClick={() => open(mode === 'password' ? null : 'password')} aria-expanded={mode === 'password'} disabled={busy}>
        {t('account.changePassword')}
      </Button>
      {mode === 'password' && <form className="auth-form" onSubmit={submit}>
        <Field label={t('account.currentPassword')} type="password" autoComplete="current-password"
          maxLength={256} required value={current} onChange={event => setCurrent(event.target.value)} />
        <Field label={t('account.newPassword')} type="password" autoComplete="new-password"
          maxLength={256} required hint={t('account.passwordHint')} value={password} onChange={event => setPassword(event.target.value)} />
        <Field label={t('account.repeat')} type="password" autoComplete="new-password"
          maxLength={256} required value={repeat} onChange={event => setRepeat(event.target.value)} />
        <Message>{error && t(error)}</Message>
        <Button type="submit" tone="primary" disabled={busy}>{t(busy ? 'account.busy' : 'account.changePassword')}</Button>
      </form>}
    </section>
    <section className="surface padded profile-access">
      <h2>{t('account.closureTitle')}</h2>
      <p>{t('account.closureBody')}</p>
      {status.loading && !receipt && <Loading />}
      {status.error && <Message>{t('account.unavailable')}</Message>}
      {active?.id && <p role="status">
        {t(pending ? 'account.closurePending' : 'account.closureReviewed', {
          date: formatDate(active.requestedAt, { dateStyle: 'medium' }),
        })}
      </p>}
      <Button onClick={() => open(mode === 'closure' ? null : 'closure')} aria-expanded={mode === 'closure'} disabled={busy}>
        {t('account.requestClosure')}
      </Button>
      {mode === 'closure' && <form className="auth-form" onSubmit={submit}>
        <Field label={t('account.currentPassword')} type="password" autoComplete="current-password"
          maxLength={256} required value={current} onChange={event => setCurrent(event.target.value)} />
        <label className="agreement-check"><input type="checkbox" required checked={confirmed}
          onChange={event => setConfirmed(event.target.checked)} />{t('account.closureConfirm')}</label>
        <Message>{error && t(error)}</Message>
        <Button type="submit" tone="danger" disabled={busy}>{t(busy ? 'account.busy' : 'account.requestClosure')}</Button>
      </form>}
      <p><a href={support}>{t('account.support')}</a></p>
    </section>
    {canReview && <section className="surface padded profile-access">
      <h2>{t('account.closureQueue')}</h2>
      <p className="muted">{t('account.closureQueueBody')}</p>
      {review.loading && <Loading />}
      {review.error && <Message>{t('account.unavailable')}</Message>}
      {!review.loading && !review.error && !review.data?.pending?.length && <p>{t('account.closureQueueEmpty')}</p>}
      {review.data?.pending?.length > 0 && <ul>
        {review.data.pending.map(row => <li key={row.id}>
          <p><strong>{row.name}</strong><br />{row.email} · {formatDate(row.requestedAt, { dateStyle: 'medium' })}</p>
          {reviewId === row.id ? <form className="auth-form" onSubmit={event => acknowledge(event, row.id)}>
            <p>{t('account.markReviewedConfirm')}</p>
            <Field label={t('account.supportCase')} required maxLength={80} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{0,79}"
              value={supportCase} onChange={event => setSupportCase(event.target.value)} />
            <Message>{reviewError && t(reviewError)}</Message>
            <Button type="submit" tone="primary" disabled={busy}>{t('account.markReviewed')}</Button>
            <Button onClick={() => setReviewId(null)} disabled={busy}>{t('Cancel')}</Button>
          </form> : <Button onClick={() => { setReviewId(row.id); setSupportCase(''); setReviewError(''); }} disabled={busy}>{t('account.markReviewed')}</Button>}
        </li>)}
      </ul>}
      {review.data?.reviewed?.length > 0 && <details>
        <summary>{t('account.reviewedRequests')}</summary>
        <ul>{review.data.reviewed.map(row => <li key={row.id}>
          <p><strong>{row.name}</strong><br />{row.email} · {formatDate(row.reviewedAt, { dateStyle: 'medium' })}
            <br />{t('account.supportCase')} {row.supportCase}</p>
        </li>)}</ul>
      </details>}
    </section>}
  </>;
}
