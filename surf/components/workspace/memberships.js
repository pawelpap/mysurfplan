import { useLocale } from "../locale";
import { useState } from "react";
import {
  Button,
  Empty,
  Loading,
  Message,
  PageHeading,
  SelectField,
  FormActions,
  fullName,
  isPlatform,
  request,
  roleName,
  useData,
} from "./ui";
export default function Memberships({ school, session }) {
  const { t } = useLocale();
  const source = useData(
    `/api/memberships?school=${encodeURIComponent(school.id)}`,
  );
  const accounts = useData(isPlatform(session.role) ? "/api/users" : null);
  const [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/api/memberships", {
        method: "PUT",
        body: JSON.stringify({
          school: school.id,
          userId: editing.userId,
          roles: editing.roles,
          status: editing.status,
        }),
      });
      source.reload();
      setEditing(null);
      window.dispatchEvent(new Event("account-access-changed"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (source.loading) return <Loading label={t("Loading school access…")} />;
  if (source.error)
    return (
      <>
        <Message>{source.error}</Message>
        <Button onClick={source.reload}>{t("Try again")}</Button>
      </>
    );
  if (editing)
    return (
      <div className="form-screen">
        <PageHeading
          title={t("School access")}
          description={editing.name || school.name}
          back={{ label: t("People"), onClick: () => setEditing(null) }}
        />
        <form className="surface padded" onSubmit={save}>
          {!editing.id && (
            <SelectField
              label={t("Person")}
              required
              value={editing.userId}
              onChange={(e) =>
                setEditing({ ...editing, userId: e.target.value })
              }
              options={[
                { value: "", label: t("Choose an existing account") },
                ...accounts.data.map((p) => ({
                  value: p.id,
                  label: fullName(p),
                })),
              ]}
            />
          )}
          <fieldset>
            <legend>{t("Roles in")} {school.name}</legend>
            <div className="check-list">
              {["school_admin", "coach"].map((role) => (
                <label key={role}>
                  <input
                    type="checkbox"
                    checked={editing.roles.includes(role)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        roles: e.target.checked
                          ? [...editing.roles, role]
                          : editing.roles.filter((r) => r !== role),
                      })
                    }
                  />
                  {t(roleName(role))}
                </label>
              ))}
            </div>
          </fieldset>
          <SelectField
            label={t("School access")}
            value={editing.status}
            onChange={(e) => setEditing({ ...editing, status: e.target.value })}
            options={[
              { value: "active", label: t("Active") },
              { value: "suspended", label: t("Suspended") },
              { value: "left", label: t("Removed") },
            ]}
          />
          {editing.owner && (
            <p className="muted-note">{t("School owner. Ownership must be transferred before removing access.")}</p>
          )}
          <FormActions
            busy={busy}
            error={error}
            onCancel={() => setEditing(null)}
          />
        </form>
      </div>
    );
  return (
    <>
      <PageHeading
        title={t("People")}
        description={school.name}
        action={
          isPlatform(session.role) && (
            <Button
              tone="primary"
              onClick={() => {
                setError("");
                setEditing({ userId: "", roles: ["coach"], status: "active" });
              }}
            >{t("+ Add school access")}</Button>
          )
        }
      />
      {source.data.length ? (
        <div className="surface">
          {source.data.map((p) => (
            <button
              className="list-row people-row"
              key={p.id}
              onClick={() => {
                setError("");
                setEditing({ ...p, name: fullName(p) });
              }}
            >
              <strong>{fullName(p)}</strong>
              <span>
                {p.owner ? t("Owner · ") : ""}
                {p.roles.map(role => t(roleName(role))).join(" · ") || t("No staff role")}
              </span>
              <span className="pill">
                {
                  t({ active: "Active", suspended: "Suspended", left: "Removed" }[
                    p.status
                  ] || p.status)
                }
              </span>
              <span className="row-action">{t("Manage →")}</span>
            </button>
          ))}
        </div>
      ) : (
        <Empty title={t("No school staff accounts")}>{t("A platform administrator can associate an existing account with this school.")}</Empty>
      )}
    </>
  );
}
