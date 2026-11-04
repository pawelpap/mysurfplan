import { useLocale } from "../locale";
import { useState } from "react";
import {
  Button,
  Empty,
  Field,
  FormActions,
  Message,
  PageHeading,
  request,
} from "./ui";

export default function Schools({ schools, query, go, reload, openLessons }) {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const selected = schools.find((s) => s.id === query.record);
  const saved = () => {
    reload();
    go({});
    setNotice("School saved.");
  };
  if (query.action === "new" || (selected && query.action === "edit"))
    return (
      <SchoolForm
        school={selected}
        onCancel={() => go(selected ? { record: selected.id } : {})}
        onSaved={saved}
      />
    );
  if (query.record && !selected)
    return (
      <Empty
        title={t("School not found")}
        action={<Button onClick={() => go({})}>{t("Back to schools")}</Button>}
      >{t("This school may have been removed.")}</Empty>
    );
  if (selected)
    return (
      <SchoolDetail
        school={selected}
        onBack={() => go({})}
        onEdit={() => go({ record: selected.id, action: "edit" })}
        onLessons={() => openLessons(selected)}
        onRemoved={() => {
          reload();
          go({});
          setNotice("School removed.");
        }}
      />
    );
  const filtered = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={t("Schools")}
        description={t("Open a school to manage its details or lesson schedule.")}
        action={
          <Button tone="primary" onClick={() => go({ action: "new" })}>{t("+ Add school")}</Button>
        }
      />
      <Message success>{notice}</Message>
      <div className="toolbar">
        <Field
          label={t("Search schools")}
          type="search"
          placeholder={t("School name")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {filtered.length ? (
        <div className="surface">
          <div className="list-header school-row" aria-hidden="true">
            <span>{t("School")}</span>
            <span>{t("Contact email")}</span>
            <span />
          </div>
          {filtered.map((s) => (
            <button
              key={s.id}
              className="list-row school-row"
              onClick={() => {
                setNotice("");
                go({ record: s.id });
              }}
            >
              <span>
                <strong>{s.name}</strong>
                <small>/{s.slug}</small>
              </span>
              <span>{s.contact_email || t("Not provided")}</span>
              <span className="row-action">{t("View →")}</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty title={t("No schools found")}>
          {search
            ? t("Try another school name.")
            : t("Add your first school to begin.")}
        </Empty>
      )}
    </>
  );
}
function SchoolForm({ school, onCancel, onSaved }) {
  const { t } = useLocale();
  const [name, setName] = useState(school?.name || "");
  const [email, setEmail] = useState(school?.contact_email || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(school ? `/api/schools/${school.id}` : "/api/schools", {
        method: school ? "PUT" : "POST",
        body: JSON.stringify({ name: name.trim(), contactEmail: email.trim() }),
      });
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
        title={school ? t("Edit school") : t("Add school")}
        back={{
          label: school ? t("School details") : t("Schools"),
          onClick: onCancel,
        }}
      />
      <form className="surface padded" onSubmit={submit}>
        <div className="form-grid">
          <Field
            label={t("School name")}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label={t("Contact email (optional)")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {school && (
          <p className="muted-note">{t("Changing the name also changes the public schedule address. Update any links you have shared.")}</p>
        )}
        <FormActions
          busy={busy}
          error={error}
          onCancel={onCancel}
          label={school ? t("Save changes") : t("Create school")}
        />
      </form>
    </div>
  );
}
function SchoolDetail({ school, onBack, onEdit, onLessons, onRemoved }) {
  const { t } = useLocale();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (
      !window.confirm(
        t("Remove {1}? Its public schedule will no longer be available.", { 1: school.name }),
      )
    )
      return;
    setBusy(true);
    try {
      await request(`/api/schools/${school.id}`, { method: "DELETE" });
      onRemoved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="form-screen">
      <PageHeading
        title={school.name}
        back={{ label: t("Schools"), onClick: onBack }}
        action={
          <Button tone="primary" onClick={onEdit}>{t("Edit school")}</Button>
        }
      />
      <Message>{error}</Message>
      <section className="surface padded">
        <dl className="detail-grid">
          <div>
            <dt>{t("Contact email")}</dt>
            <dd>{school.contact_email || t("Not provided")}</dd>
          </div>
          <div>
            <dt>{t("Public schedule")}</dt>
            <dd>
              <a href={`/${school.slug}`} target="_blank" rel="noreferrer">
                /{school.slug} ↗
              </a>
            </dd>
          </div>
        </dl>
        <div className="task-actions">
          <Button tone="primary" onClick={onLessons}>{t("Manage lessons")}</Button>
        </div>
      </section>
      <div className="danger-zone">
        <Button tone="danger" disabled={busy} onClick={remove}>{t("Remove school")}</Button>
      </div>
    </div>
  );
}
