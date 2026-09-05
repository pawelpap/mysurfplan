import { useEffect, useId, useState } from "react";

export const isAdmin = (role) =>
  ["admin", "platform_admin", "school_admin"].includes(role);
export const isPlatform = (role) => ["admin", "platform_admin"].includes(role);
export const roleName = (role) =>
  ({
    platform_admin: "Platform admin",
    admin: "Platform admin",
    school_admin: "School admin",
    coach: "Instructor",
    student: "Student",
  })[role] || "Member";
export const fullName = (person) =>
  [person?.name, person?.familyName].filter(Boolean).join(" ") ||
  person?.email ||
  "Unnamed person";
export const initials = (person) =>
  fullName(person)
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export const dateLabel = (value) =>
  new Date(value).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const timeLabel = (value) =>
  new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

export async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const json = await response.json().catch(() => ({}));
  if (response.status === 401 && !url.includes("/auth/")) {
    window.location.assign(
      `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
    );
    throw new Error("Please log in again.");
  }
  if (!response.ok || json.ok === false)
    throw new Error(json.error || "Something went wrong. Please try again.");
  return json.data;
}

export function useData(url) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({
    url: null,
    data: [],
    loading: false,
    error: "",
  });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setState((old) => ({
      url,
      data: old.url === url ? old.data : [],
      loading: true,
      error: "",
    }));
    request(url, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ url, data: data || [], loading: false, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ url, data: [], loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [url, version]);
  return {
    ...(state.url === url
      ? state
      : { data: [], loading: Boolean(url), error: "" }),
    reload: () => setVersion((v) => v + 1),
  };
}

export function Brand() {
  return (
    <span className="brand">
      <svg className="brand-icon" viewBox="0 0 96 96" aria-hidden="true">
        <rect x="6" y="6" width="84" height="84" rx="24" fill="#0D6E7A" />
        <path
          d="M18 58C30 39 48 40 58 50C65 57 74 57 82 48"
          stroke="#DFF5EA"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M19 66C37 54 50 55 62 64C70 70 77 70 84 63"
          stroke="#F4C96B"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M38 38C46 29 58 30 66 38"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      MyWavePlan
    </span>
  );
}
export function Button({
  children,
  tone = "secondary",
  className = "",
  ...props
}) {
  return (
    <button type="button" {...props} className={`button ${tone} ${className}`}>
      {children}
    </button>
  );
}
export function Field({ label, hint, children, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? children(id) : <input id={id} {...props} />}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function SelectField({ label, options, ...props }) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
export function Message({ children, success = false }) {
  return children ? (
    <div
      className={`message ${success ? "success" : "error"}`}
      role={success ? "status" : "alert"}
    >
      {children}
    </div>
  ) : null;
}
export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading({ label = "Loading…" }) {
  return (
    <div className="loading" role="status">
      {label}
    </div>
  );
}
export function PageHeading({ title, description, back, action, children }) {
  return (
    <header className="page-heading">
      {back && (
        <button className="back-link" onClick={back.onClick}>
          ← {back.label}
        </button>
      )}
      <div className="heading-row">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </header>
  );
}
export function Avatar({ person }) {
  return person?.photoUrl ? (
    <img className="avatar" src={person.photoUrl} alt="" />
  ) : (
    <span className="avatar">{initials(person)}</span>
  );
}
export function FormActions({ busy, label = "Save changes", onCancel, error }) {
  return (
    <div className="form-footer">
      <Message>{error}</Message>
      <div className="actions">
        <Button type="submit" tone="primary" disabled={busy}>
          {busy ? "Saving…" : label}
        </Button>
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
