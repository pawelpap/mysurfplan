import { useLocale } from '../locale';
import { useRef, useState } from 'react';
import { localeNames } from '../../lib/locale/preferences.mjs';
import { Button, Empty, Field, Loading, Message, PageHeading, SelectField, fullName, isPlatform, request, useData } from './ui';

const roleKeys = ['coach', 'school_admin'];
const errorKey = error => error.message?.startsWith('invitation.') || error.message === 'login.rateLimit'
  ? error.message : error.status === 403 ? 'invitation.forbidden' : error.status === 409 ? 'invitation.conflict' : 'invitation.unavailable';

export default function Memberships({ school, session }) {
  const { t, locale, formatDate } = useLocale();
  const source = useData(`/api/memberships?school=${encodeURIComponent(school.id)}`);
  const invitations = useData(`/api/invitations?school=${encodeURIComponent(school.id)}`);
  const relation = session.schools?.find(item => item.id === school.id);
  const canAdmin = isPlatform(session.role) || (relation?.owner && relation.status === 'active' && relation.open !== false);
  const [editing, setEditing] = useState(null);
  const [invite, setInvite] = useState(null);
  const coaches = useData(invite ? `/api/invitations?school=${encodeURIComponent(school.id)}&options=1` : null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const lock = useRef(false);
  const mayEdit = member => canAdmin || (!member.owner &&
    !(member.originalRoles ?? member.roles).includes('school_admin') && (member.originalStatus ?? member.status) !== 'suspended');
  const rolesLabel = roles => roles.map(role => t('team.' + role)).join(' · ');
  const reset = () => { if (!lock.current) { setEditing(null); setInvite(null); setError(''); } };
  const update = () => { source.reload(); invitations.reload(); window.dispatchEvent(new Event('account-access-changed')); };
  function startInvite() {
    setEditing(null); setError(''); setNotice('');
    setInvite({ email: '', roles: ['coach'], locale, legacyCoachId: '' });
  }
  async function save(event) {
    event.preventDefault();
    if (lock.current) return;
    if (!mayEdit(editing)) return;
    if (editing.status !== 'active' && editing.status !== editing.originalStatus && !window.confirm(t('team.confirmAccess', {
      name: fullName(editing), status: t('team.' + editing.status),
    }))) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await request('/api/memberships', { method: 'PUT', body: JSON.stringify({ school: school.id, userId: editing.userId, roles: editing.roles, status: editing.status }) });
      setEditing(null); setNotice('team.saved'); update();
    } catch (failure) { setError(errorKey(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function send(event) {
    event.preventDefault();
    if (lock.current) return;
    if (!invite.roles.length) { setError('team.chooseRole'); return; }
    if (invite.roles.includes('coach') && !invite.legacyCoachId && Array.isArray(coaches.data) &&
        coaches.data.some(coach => coach.email?.trim().toLowerCase() === invite.email.trim().toLowerCase())) {
      setError('team.recordRequired'); return;
    }
    lock.current = true; setBusy(true); setError('');
    try {
      await request('/api/invitations', { method: 'POST', body: JSON.stringify({ school: school.id, ...invite,
        legacyCoachId: invite.roles.includes('coach') && invite.legacyCoachId ? invite.legacyCoachId : null }) });
      setInvite(null); setNotice('team.sent'); invitations.reload();
    } catch (failure) { setError(errorKey(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function invitationAction(item, action) {
    if (lock.current) return;
    if (!window.confirm(t(action === 'revoke' ? 'team.confirmRevoke' : 'team.confirmResend', { email: item.email }))) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await request('/api/invitations', { method: 'POST', body: JSON.stringify({ school: school.id, id: item.id, action, locale: item.locale || locale }) });
      setNotice(action === 'revoke' ? 'team.revokedDone' : 'team.resent'); invitations.reload();
    } catch (failure) { setError(errorKey(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  const changeRoles = (value, setter, role, checked) => setter({ ...value,
    roles: checked ? [...value.roles, role] : value.roles.filter(item => item !== role),
    ...(role === 'coach' && !checked ? { legacyCoachId: '' } : {}),
  });
  function roleFields(value, setter, disabled = false) {
    return <fieldset className="team-role-fields" disabled={busy || disabled}>
      <legend>{t('team.roles')}</legend>
      {roleKeys.filter(role => role === 'coach' || canAdmin || value.roles.includes('school_admin')).map(role =>
        <label className={"team-role-option team-role-" + role} key={role}>
          <input type="checkbox" checked={value.roles.includes(role)} disabled={role === 'school_admin' && !canAdmin}
            onChange={event => changeRoles(value, setter, role, event.target.checked)} />
          <span><strong>{t('team.' + role)}</strong><small>{t(role === 'coach' ? 'team.coachHelp' : 'team.adminHelp')}</small></span>
        </label>)}
    </fieldset>;
  }
  if (invite) {
    const email = invite.email.trim().toLowerCase();
    const eligible = (Array.isArray(coaches.data) ? coaches.data : []).filter(coach => coach.email?.trim().toLowerCase() === email);
    return <div className="team-screen form-screen">
      <PageHeading title={t('team.invite')} description={school.name} back={{ label: t('team.title'), onClick: reset }} />
      <form className="surface padded team-form" onSubmit={send} aria-busy={busy}>
        <Field label={t('team.email')} type="email" autoComplete="email" maxLength={254} required disabled={busy}
          value={invite.email} onChange={event => setInvite({ ...invite, email: event.target.value, legacyCoachId: '' })} />
        {roleFields(invite, setInvite)}
        {invite.roles.includes('coach') && <>
          {coaches.loading ? <Loading /> : coaches.error ? <div><Message>{t('team.recordUnavailable')}</Message>
            <Button disabled={busy} onClick={coaches.reload}>{t('Try again')}</Button></div> :
            <SelectField className="team-record-select" label={t('team.record')} required={eligible.length > 0} disabled={busy} value={invite.legacyCoachId}
              onChange={event => setInvite({ ...invite, legacyCoachId: event.target.value })}
              options={[{ value: '', label: t(eligible.length ? 'team.chooseRecord' : 'team.newRecord') }, ...eligible.map(coach => ({ value: coach.id, label: coach.name }))]} />}
          <p className="muted-note team-record-help">{t('team.recordHelp')}</p>
        </>}
        <SelectField label={t('team.language')} value={invite.locale} disabled={busy} onChange={event => setInvite({ ...invite, locale: event.target.value })}
          options={Object.entries(localeNames).map(([value, label]) => ({ value, label }))} />
        <aside className="team-notice"><strong>{t('team.choose')}</strong><p>{t('team.inviteHelp')}</p></aside>
        <Message>{error && t(error)}</Message>
        <div className="actions"><Button type="submit" tone="primary" disabled={busy || !invite.roles.length || (invite.roles.includes('coach') && (coaches.loading || Boolean(coaches.error)))}>
          {t(busy ? 'team.busy' : 'team.send')}</Button><Button disabled={busy} onClick={reset}>{t('Cancel')}</Button></div>
      </form>
    </div>;
  }
  if (editing) {
    const writable = mayEdit(editing) && editing.originalStatus !== 'left';
    return <div className="team-screen form-screen">
      <PageHeading title={fullName(editing)} description={school.name} back={{ label: t('team.title'), onClick: reset }} />
      <form className="surface padded team-form" onSubmit={save} aria-busy={busy}>
        {editing.owner && <p className="team-notice">{t('team.ownerProtected')}</p>}
        {editing.originalStatus === 'left' ? <p>{t('team.leftHelp')}</p> : !writable && <p className="team-notice">{t('team.readOnly')}</p>}
        {roleFields(editing, setEditing, !writable)}
        <SelectField label={t('team.status')} value={editing.status} disabled={busy || !writable || editing.owner}
          onChange={event => setEditing({ ...editing, status: event.target.value })}
          options={['active', 'suspended', 'left'].map(value => ({ value, label: t('team.' + value) }))} />
        <p className="muted-note">{t('team.preserved')}</p>
        {writable ? <><Message>{error && t(error)}</Message><div className="actions"><Button type="submit" tone="primary" disabled={busy}>{t(busy ? 'team.busy' : 'Save changes')}</Button><Button disabled={busy} onClick={reset}>{t('Cancel')}</Button></div></> : <Button onClick={reset}>{t('team.back')}</Button>}
      </form>
    </div>;
  }
  return <div className="team-screen">
    <PageHeading title={t('team.title')} description={school.name} action={<Button tone="primary" disabled={busy} onClick={startInvite}>+ {t('team.invite')}</Button>} />
    <p className="team-intro">{t('team.intro')}</p>
    <Message success>{notice && t(notice)}</Message><Message>{error && t(error)}</Message>
    <section aria-labelledby="team-members"><h2 id="team-members">{t('team.members')}</h2>
      {source.loading ? <Loading /> : source.error ? <><Message>{t('invitation.unavailable')}</Message><Button onClick={source.reload}>{t('Try again')}</Button></>
        : source.data.length ? <div className="surface team-members">{source.data.map(member => <button type="button" className="team-member" key={member.id} disabled={busy}
          onClick={() => { setError(''); setEditing({ ...member, originalStatus: member.status, originalRoles: [...member.roles] }); }}>
          <strong>{fullName(member)}</strong><span>{[member.owner ? t('team.owner') : '', rolesLabel(member.roles)].filter(Boolean).join(' · ') || t('team.noRoles')}</span>
          <span className="pill">{t('team.' + member.status)}</span><span className="row-action">{t(mayEdit(member) && member.status !== 'left' ? 'team.manage' : 'team.view')} →</span>
        </button>)}</div> : <Empty title={t('team.noMembers')}>{t('team.noMembersBody')}</Empty>}
      <p className="muted-note">{t('team.preserved')}</p>
      {!canAdmin && <p className="muted-note">{t('team.ownerOnly')}</p>}
    </section>
    <section className="team-invitations" aria-labelledby="team-invitations"><h2 id="team-invitations">{t('team.invitations')}</h2>
      {invitations.loading ? <Loading /> : invitations.error ? <><Message>{t('invitation.unavailable')}</Message><Button onClick={invitations.reload}>{t('Try again')}</Button></>
        : invitations.data.length ? <div className="surface">{invitations.data.map(item => {
          const allowed = canAdmin || !item.roles.includes('school_admin');
          return <article className="team-invitation" key={item.id}>
            <div className="team-invitation-identity"><strong>{item.email}</strong><span>{rolesLabel(item.roles)}</span></div>
            <div><span className="pill">{t('team.' + item.status)}</span><small>{t('team.expires', { date: formatDate(item.expiresAt, { dateStyle: 'medium', timeStyle: 'short' }) })}</small></div>
            <div className="actions">{allowed && ['pending', 'expired'].includes(item.status) &&
              <Button disabled={busy} onClick={() => invitationAction(item, 'reissue')}>{t('team.resend')}</Button>}
              {allowed && item.status === 'pending' && <Button disabled={busy} onClick={() => invitationAction(item, 'revoke')}>{t('team.revoke')}</Button>}</div>
          </article>;
        })}</div> : <p>{t('team.noInvitations')}</p>}
    </section>
  </div>;
}
