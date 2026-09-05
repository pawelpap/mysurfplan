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
  const source = useData(
    `/api/users${school ? `?school=${encodeURIComponent(school.slug)}` : ""}`,
  );
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
  if (source.loading) return <Loading label="Loading people…" />;
  if (source.error)
    return (
      <>
        <Message>{source.error}</Message>
        <Button onClick={source.reload}>Try again</Button>
      </>
    );
  if (query.person && !selected)
    return (
      <Empty
        title="Person not found"
        action={<Button onClick={back}>Back to people</Button>}
      >
        This account is not available in the selected school.
      </Empty>
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
        title="People"
        description={
          school
            ? `Manage login accounts for ${school.name}.`
            : "Manage accounts across all schools."
        }
        action={
          <Button
            tone="primary"
            onClick={() => {
              setNotice("");
              go({ action: "new" });
            }}
          >
            + Add person
          </Button>
        }
      />
      <Message success>{notice}</Message>
      <div className="toolbar">
        <Field
          label="Search people"
          type="search"
          placeholder="Name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SelectField
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: "", label: "All roles" },
            ...roles.map((value) => ({ value, label: roleName(value) })),
          ]}
        />
      </div>
      {people.length ? (
        <div className="surface">
          <div className="list-header people-row" aria-hidden="true">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
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
              aria-label={`View ${fullName(person)}`}
            >
              <span className="person-cell">
                <Avatar person={person} />
                <span>
                  <strong>{fullName(person)}</strong>
                  <small>{person.schoolName || "All schools"}</small>
                </span>
              </span>
              <span>{person.email}</span>
              <span>
                <span className="pill">{roleName(person.role)}</span>
              </span>
              <span className="row-action">View →</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title={
            search || role ? "No matching people" : "No people in this school"
          }
          action={
            search || role ? (
              <Button
                onClick={() => {
                  setSearch("");
                  setRole("");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button tone="primary" onClick={() => go({ action: "new" })}>
                Add a person
              </Button>
            )
          }
        >
          {search || role
            ? "Try another name, email or role."
            : "Add an account for a student, instructor or school admin."}
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

function PersonDetail({ person, session, onBack, onEdit, onRemoved }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (
      !window.confirm(
        `Deactivate ${fullName(person)}? They will no longer be able to log in with this account.`,
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
        title="Person details"
        back={{ label: "People", onClick: onBack }}
        action={
          <Button tone="primary" onClick={onEdit}>
            Edit person
          </Button>
        }
      />
      <Message>{error}</Message>
      <section className="surface padded">
        <div className="account-summary">
          <Avatar person={person} />
          <div>
            <h2>{fullName(person)}</h2>
            <p className="muted">{roleName(person.role)}</p>
          </div>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Email</dt>
            <dd>{person.email}</dd>
          </div>
          <div>
            <dt>Telephone</dt>
            <dd>{person.phone || "Not provided"}</dd>
          </div>
          <div>
            <dt>School</dt>
            <dd>{person.schoolName || "All schools"}</dd>
          </div>
          <div>
            <dt>Last login</dt>
            <dd>
              {person.lastLoginAt
                ? dateLabel(person.lastLoginAt)
                : "Has not logged in"}
            </dd>
          </div>
          {person.description && (
            <div className="wide">
              <dt>About</dt>
              <dd>{person.description}</dd>
            </div>
          )}
        </dl>
      </section>
      {person.id !== session.userId && (
        <div className="danger-zone">
          <Button tone="danger" onClick={remove} disabled={busy}>
            Deactivate person
          </Button>
        </div>
      )}
    </div>
  );
}

function PersonForm({ person, school, schools, roles, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: person?.name || "",
    familyName: person?.familyName || "",
    email: person?.email || "",
    phone: person?.phone || "",
    description: person?.description || "",
    role: person?.role || "student",
    school: person?.schoolId || school?.id || "",
    password: "",
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
        title={person ? "Edit person" : "Add person"}
        description={
          person
            ? fullName(person)
            : "Create an account so this person can log in."
        }
        back={{
          label: person ? "Person details" : "People",
          onClick: onCancel,
        }}
      />
      <form className="surface padded" autoComplete="off" onSubmit={submit}>
        <div className="form-grid">
          <Field
            label="First name"
            required
            autoComplete="off"
            {...bind("name")}
          />
          <Field
            label="Family name"
            required
            autoComplete="off"
            {...bind("familyName")}
          />
          <Field
            label="Email"
            type="email"
            required
            autoComplete="off"
            {...bind("email")}
          />
          <Field
            label="Telephone (optional)"
            type="tel"
            autoComplete="off"
            {...bind("phone")}
          />
          <SelectField
            label="Role"
            options={roles.map((value) => ({ value, label: roleName(value) }))}
            {...bind("role")}
          />
          {form.role !== "platform_admin" && (
            <SelectField
              label="School"
              required
              options={[
                { value: "", label: "Select school" },
                ...schools.map((s) => ({ value: s.id, label: s.name })),
              ]}
              {...bind("school")}
            />
          )}
        </div>
        <div className="form-section">
          <h2>Account access</h2>
          <Field
            label={person ? "New password (optional)" : "Initial password"}
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={256}
            required={!person}
            hint={
              person
                ? "Leave blank to keep the current password."
                : "At least 8 characters. Share the login details with the person securely."
            }
            {...bind("password")}
          />
        </div>
        <Field label="About (optional)">
          {(id) => <textarea id={id} {...bind("description")} />}
        </Field>
        <FormActions
          busy={busy}
          error={error}
          onCancel={onCancel}
          label={person ? "Save changes" : "Create account"}
        />
      </form>
    </div>
  );
}
