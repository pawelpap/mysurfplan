import Link from "next/link";
import { useLocale } from "../locale";
import { useState } from "react";
import {
  Avatar,
  Button,
  Empty,
  Field,
  FormActions,
  Loading,
  Message,
  PageHeading,
  SelectField,
  dateLabel,
  fullName,
  isPlatform,
  request,
  roleName,
  useData,
} from "./ui";

export default function People({ school, schools, session, query, go }) {
  const { t } = useLocale();
  const source = useData("/api/users");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [notice, setNotice] = useState("");
  const selected = source.data.find((p) => p.id === query.person);
  const roles = [
    "student",
    "coach",
    "school_admin",
    ...(isPlatform(session.role) ? ["platform_admin"] : []),
  ];
  const back = () => go({});
  const saved = () => {
    source.reload();
    go({});
    setNotice("Person saved.");
  };
  if (query.action === "new")
    return (
      <PersonForm
        school={school}
        schools={schools}
        roles={roles}
        onCancel={back}
        onSaved={saved}
      />
    );
  if (source.loading) return <Loading label={t("Loading people…")} />;
  if (source.error)
    return (
      <>
        <Message>{source.error}</Message>
        <Button onClick={source.reload}>{t("Try again")}</Button>
      </>
    );
  if (query.person && !selected)
    return (
      <Empty
        title={t("Person not found")}
        action={<Button onClick={back}>{t("Back to people")}</Button>}
      >{t("This account is not available in the selected school.")}</Empty>
    );
  if (selected && query.action === "edit")
    return (
      <PersonForm
        key={selected.id}
        person={selected}
        school={school}
        schools={schools}
        roles={roles}
        onCancel={() => go({ person: selected.id })}
        onSaved={saved}
      />
    );
  if (selected)
    return (
      <PersonDetail
        person={selected}
        schools={schools}
        session={session}
        onBack={back}
        onEdit={() => go({ person: selected.id, action: "edit" })}
        onRemoved={() => {
          source.reload();
          back();
          setNotice("Person deactivated.");
        }}
      />
    );
  const people = source.data.filter(
    (p) =>
      (!role || p.role === role) &&
      `${fullName(p)} ${p.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={t("Accounts")}
        description={t("Manage personal accounts across the platform.")}
        action={
          <Button
            tone="primary"
            onClick={() => {
              setNotice("");
              go({ action: "new" });
            }}
          >{t("+ Add person")}</Button>
        }
      />
      <Message success>{notice}</Message>
      <div className="toolbar">
        <Field
          label={t("Search people")}
          type="search"
          placeholder={t("Name or email")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SelectField
          label={t("Role")}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: "", label: t("All roles") },
            ...roles.map((value) => ({ value, label: t(roleName(value)) })),
          ]}
        />
      </div>
      {people.length ? (
        <div className="surface">
          <div className="list-header people-row" aria-hidden="true">
            <span>{t("Name")}</span>
            <span>{t("Email")}</span>
            <span>{t("Role")}</span>
            <span />
          </div>
          {people.map((person) => (
            <button
              className="list-row people-row"
              key={person.id}
              onClick={() => {
                setNotice("");
                go({ person: person.id });
              }}
              aria-label={t("View {1}", { 1: fullName(person) })}
            >
              <span className="person-cell">
                <Avatar person={person} />
                <span>
                  <strong>{fullName(person)}</strong>
                  <small>{person.schoolName || t("All schools")}</small>
                </span>
              </span>
              <span>{person.email}</span>
              <span>
                <span className="pill">{t(roleName(person.role))}</span>
                {person.disabledAt && <span className="pill">{t("Disabled")}</span>}
              </span>
              <span className="row-action">{t("View →")}</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title={
            search || role ? t("No matching people") : t("No people in this school")
          }
          action={
            search || role ? (
              <Button
                onClick={() => {
                  setSearch("");
                  setRole("");
                }}
              >{t("Clear filters")}</Button>
            ) : (
              <Button tone="primary" onClick={() => go({ action: "new" })}>{t("Add a person")}</Button>
            )
          }
        >
          {search || role
            ? t("Try another name, email or role.")
            : t("Add an account for a student, instructor or school admin.")}
        </Empty>
      )}
      <div className="list-caption">
        <span>
          {people.length} {people.length === 1 ? "person" : "people"}
        </span>
      </div>
    </>
  );
}

function PersonDetail({ person, schools, session, onBack, onEdit, onRemoved }) {
  const { locale, t } = useLocale();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (
      !window.confirm(
        t("Deactivate {1}? They will no longer be able to log in with this account.", { 1: fullName(person) }),
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/users/${person.id}`, { method: "DELETE" });
      onRemoved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="form-screen">
      <PageHeading
        title={t("Person details")}
        back={{ label: t("People"), onClick: onBack }}
        action={
          <Button tone="primary" onClick={onEdit}>{t("Edit person")}</Button>
        }
      />
      <Message>{error}</Message>
      <section className="surface padded">
        <div className="account-summary">
          <Avatar person={person} />
          <div>
            <h2>{fullName(person)}</h2>
            <p className="muted">{t(isPlatform(person.role) ? "workspace.platformAdmin" : "workspace.personalAccount")}</p>
          </div>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>{t("Email")}</dt>
            <dd>{person.email}</dd>
          </div>
          <div>
            <dt>{t("Telephone")}</dt>
            <dd>{person.phone || t("Not provided")}</dd>
          </div>
          <div>
            <dt>{t("School")}</dt>
            <dd>{person.schoolName || t("All schools")}</dd>
          </div>
          <div>
            <dt>{t("Account status")}</dt>
            <dd>{person.disabledAt ? t("Disabled") : t("Active")}</dd>
          </div>
          <div>
            <dt>{t("Last login")}</dt>
            <dd>
              {person.lastLoginAt
                ? dateLabel(person.lastLoginAt, undefined, locale)
                : t("Has not logged in")}
            </dd>
          </div>
          {person.description && (
            <div className="wide">
              <dt>{t("About")}</dt>
              <dd>{person.description}</dd>
            </div>
          )}
        </dl>
      </section>
      {isPlatform(session.role) && <section className="surface padded profile-access team-account-memberships">
        <h2>{t('team.memberships')}</h2>
        {person.schools?.length ? <ul>{person.schools.map(membership => <li key={membership.id}>
          <div><strong>{membership.name}</strong><p>{[membership.owner ? t('team.owner') : '',
            ...(membership.roles || []).map(role => t('team.' + role))].filter(Boolean).join(' · ') || t('team.noRoles')}</p>
            <span className="pill">{t('team.' + membership.status)}</span></div>
          {schools.some(school => school.id === membership.id) && <Link href={{ pathname: '/', query: { view: 'people', school: membership.id } }}>{t('team.manageSchool')} →</Link>}
        </li>)}</ul> : <p>{t('team.noMemberships')}</p>}
      </section>}
      {person.id !== session.userId && (
        <div className="danger-zone">
          <Button tone="danger" onClick={remove} disabled={busy}>{t("Deactivate person")}</Button>
        </div>
      )}
    </div>
  );
}

function PersonForm({ person, school, schools, roles, onCancel, onSaved }) {
  const { t } = useLocale();
  const [form, setForm] = useState({
    name: person?.name || "",
    familyName: person?.familyName || "",
    email: person?.email || "",
    phone: person?.phone || "",
    description: person?.description || "",
    role: person?.role || "student",
    ...(!person ? { school: school?.id || "" } : {}),
    password: "",
    disabled: Boolean(person?.disabledAt),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bind = (name) => ({
    value: form[name],
    onChange: (e) => setForm((old) => ({ ...old, [name]: e.target.value })),
  });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(person ? `/api/users/${person.id}` : "/api/users", {
        method: person ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      window.dispatchEvent(new Event("account-access-changed"));
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-screen">
      <PageHeading
        title={person ? t("Edit person") : t("Add person")}
        description={
          person
            ? fullName(person)
            : t("Create an account so this person can log in.")
        }
        back={{
          label: person ? t("Person details") : t("People"),
          onClick: onCancel,
        }}
      />
      <form className="surface padded" autoComplete="off" onSubmit={submit}>
        <div className="form-grid">
          <Field
            label={t("First name")}
            required
            autoComplete="off"
            {...bind("name")}
          />
          <Field
            label={t("Family name")}
            required
            autoComplete="off"
            {...bind("familyName")}
          />
          <Field
            label={t("Email")}
            type="email"
            required
            autoComplete="off"
            {...bind("email")}
          />
          <Field
            label={t("Telephone (optional)")}
            type="tel"
            autoComplete="off"
            {...bind("phone")}
          />
          <SelectField
            label={t("Role")}
            options={(person ? ["student", "platform_admin"] : roles).map(
              (value) => ({
                value,
                label:
                  value === "student" ? t("Personal account") : t(roleName(value)),
              }),
            )}
            {...bind("role")}
          />
          {!person && form.role !== "platform_admin" && (
            <SelectField
              label={t("School")}
              required={form.role !== "student"}
              options={[
                { value: "", label: t("No school") },
                ...schools.map((s) => ({ value: s.id, label: s.name })),
              ]}
              {...bind("school")}
            />
          )}
        </div>
        <div className="form-section">
          <h2>{t("Account access")}</h2>
          {person && (
            <SelectField
              label={t("Account status")}
              value={form.disabled ? "disabled" : "active"}
              options={[
                { value: "active", label: t("Active") },
                { value: "disabled", label: t("Disabled") },
              ]}
              onChange={(e) =>
                setForm((old) => ({
                  ...old,
                  disabled: e.target.value === "disabled",
                }))
              }
            />
          )}
          <Field
            label={person ? t("New password (optional)") : t("Initial password")}
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            required={!person}
            hint={
              person
                ? t("Leave blank to keep the current password.")
                : t("At least 8 characters. Share the login details with the person securely.")
            }
            {...bind("password")}
          />
        </div>
        <Field label={t("About (optional)")}>
          {(id) => <textarea id={id} {...bind("description")} />}
        </Field>
        <FormActions
          busy={busy}
          error={error}
          onCancel={onCancel}
          label={person ? t("Save changes") : t("Create account")}
        />
      </form>
    </div>
  );
}
