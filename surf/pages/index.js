import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Lessons from "../components/workspace/lessons";
import Conditions from "../components/conditions";
import { LanguageSelector, LocaleProvider, useLocale } from "../components/locale";
import { ThemeSelector } from "../components/theme";
import Memberships from "../components/workspace/memberships";
import AccountSecurity from "../components/workspace/account-security";
import PrivacyAgreements from "../components/workspace/privacy-agreements";
import { withSchool, schoolAccess } from "../lib/school-access.mjs";
import People from "../components/workspace/people";
import Schools from "../components/workspace/schools";
import {
  Avatar,
  Brand,
  Button,
  Empty,
  Field,
  Loading,
  Message,
  PageHeading,
  fullName,
  isAdmin,
  isPlatform,
  request,
  roleName,
  useData,
} from "../components/workspace/ui";

export default function Workspace() {
  const router = useRouter();
  const auth = useData(router.isReady ? "/api/auth/session" : null);
  const session = auth.data?.role ? auth.data : null;
  return (
    <LocaleProvider accountLocale={session?.preferredLocale}>
      <WorkspaceContent auth={auth} session={session} />
    </LocaleProvider>
  );
}

function WorkspaceContent({ auth, session }) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const schools = useData(session ? "/api/schools" : null);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const menuButton = useRef(null);
  const sidebar = useRef(null);
  const main = useRef(null);
  const availableSchools = isPlatform(session?.role)
    ? schools.data
    : schools.data.filter((s) =>
        session?.schools?.some((a) => a.id === s.id && a.open),
      );
  const requestedSchool =
    typeof router.query.school === "string" ? router.query.school : "";
  const school =
    requestedSchool === "all" &&
    isPlatform(session?.role) &&
    router.query.view === "accounts"
      ? null
      : availableSchools.find(
          (s) => s.slug === requestedSchool || s.id === requestedSchool,
        ) ||
        availableSchools[0] ||
        null;
  const scopedSession =
    school && session ? withSchool(session, school.id) : session;
  const schoolCapabilities = schoolAccess(session, school?.id);
  const allowed = session?.demo ? ["conditions", "privacy"] : [
    "conditions",
    "bookings",
    ...(session?.schools?.some(
      (s) => s.open && s.status === "active" && s.roles.includes("coach"),
    )
      ? ["teaching"]
      : []),
    ...(school ? ["lessons"] : []),
    ...(schoolCapabilities.manageSchool ? ["people"] : []),
    ...(isPlatform(session?.role) ? ["accounts", "schools"] : []),
    "profile",
    "privacy",
  ];
  const view = allowed.includes(router.query.view)
    ? router.query.view
    : "conditions";


  const reloadAuth = auth.reload;

  useEffect(() => {
    if (auth.url && !auth.loading && !auth.error && !session)
      window.location.replace(
        `/login?school=${encodeURIComponent(requestedSchool)}&next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
  }, [auth.url, auth.loading, auth.error, session, requestedSchool]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reloadAuth();
    };
    const channel =
      typeof BroadcastChannel === "function"
        ? new BroadcastChannel("account-access")
        : null;
    if (channel) channel.onmessage = refresh;
    window.addEventListener("focus", refresh);
    window.addEventListener("account-access-changed", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("account-access-changed", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
      channel?.close();
    };
  }, [reloadAuth]);
  useEffect(() => {
    reloadAuth();
    if (main.current) main.current.focus({ preventScroll: true });
  }, [router.asPath, reloadAuth]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [
      ...sidebar.current.querySelectorAll(
        "button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled)",
      ),
    ];
    // Focus the dialog, not a native select that can open an iOS picker.
    sidebar.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === "Escape") {
        setMenu(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];
        const atDialog = document.activeElement === sidebar.current;
        if (event.shiftKey && (document.activeElement === first || atDialog)) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && (document.activeElement === last || atDialog)) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);
  function go(nextView, values = {}) {
    setMenu(false);
    setError("");
    router.push(
      {
        pathname: "/",
        query: {
          view: nextView,
          ...(school
            ? { school: school.slug }
            : requestedSchool === "all"
              ? { school: "all" }
              : {}),
          ...values,
        },
      },
      undefined,
      { shallow: true },
    );
  }
  async function saveAccountLocale(next) {
    await request("/api/auth/locale", {
      method: "PATCH",
      body: JSON.stringify({ locale: next }),
    });
    reloadAuth();
  }

  async function logout(all = false) {
    setLoggingOut(true);
    setError("");
    try {
      await request(`/api/auth/session${all === true ? "?all=1" : ""}`, {
        method: "DELETE",
      });
      if (typeof BroadcastChannel === "function") {
        const channel = new BroadcastChannel("account-access");
        channel.postMessage("logout");
        channel.close();
      }
      window.location.assign("/login");
    } catch (e) {
      setError(e.message);
      setLoggingOut(false);
    }
  }
  if (auth.error)
    return (
      <div className="auth-page">
        <Brand />
        <Message>{auth.error}</Message>
        <Button onClick={auth.reload}>{t("Try again")}</Button>
      </div>
    );
  if (!session || (schools.loading && !schools.data.length))
    return (
      <div className="auth-page">
        <Brand />
        <Loading label={t("Opening your workspace…")} />
      </div>
    );
  if (schools.error)
    return (
      <div className="auth-page">
        <Brand />
        <Message>{schools.error}</Message>
        <Button onClick={schools.reload}>{t("Try again")}</Button>
      </div>
    );
  return (
    <div className="workspace" lang={locale}>
      <Head>
        <title>{(t(`workspace.${view}`)) + " · MyWavePlan"}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <a className="skip-link" href="#main" lang={locale}>
        {t("workspace.skip")}
      </a>
      <div className="mobile-bar" lang={locale}>
        <Brand />
        <button
          ref={menuButton}
          className="menu-toggle"
          aria-label={t(menu ? "workspace.closeMenu" : "workspace.openMenu")}
          aria-expanded={menu}
          aria-controls="workspace-navigation"
          onClick={() => setMenu(!menu)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      {menu && (
        <button
          className="overlay"
          lang={locale}
          aria-label={t("workspace.closeNav")}
          onClick={() => {
            setMenu(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebar}
        lang={locale}
        id="workspace-navigation"
        tabIndex={-1}
        className={`sidebar ${menu ? "open" : ""}`}
        {...(menu
          ? { role: "dialog", "aria-modal": true, "aria-label": t("workspace.navigation") }
          : {})}
      >
        <Brand />
        <div className="school-context">
          <label htmlFor="current-school">
            <small>{t("workspace.currentSchool")}</small>
          </label>
          {availableSchools.length > 1 || isPlatform(session.role) ? (
            <select
              id="current-school"
              value={school?.slug || "all"}
              onChange={(e) =>
                go(view === "profile" ? "lessons" : view, {
                  ...(view === "conditions"
                    ? { spot: router.query.spot, date: router.query.date }
                    : {}),
                  school: e.target.value,
                })
              }
            >
              {view === "accounts" && <option value="all">{t("workspace.allSchools")}</option>}
              {availableSchools.map((s) => (
                <option value={s.slug} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <strong>{school?.name || t("workspace.personalAccount")}</strong>
          )}
          {school && (
            <a
              className="public-link"
              href={`/${school.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("workspace.publicSchedule")}
            </a>
          )}
        </div>
        <nav aria-label={t("workspace.mainNav")}>
          {allowed
            .filter((v) => !["profile", "privacy"].includes(v))
            .map((v) => (
              <button
                key={v}
                className={`nav-link ${view === v ? "active" : ""}`}
                aria-current={view === v ? "page" : undefined}
                onClick={() => go(v)}
              >
                {t(`workspace.${v}`)}
              </button>
            ))}
        </nav>
        <div className="sidebar-footer">
          <ThemeSelector />
          <LanguageSelector saveAccountLocale={session.demo ? undefined : saveAccountLocale} />
          <button
            className="account-button"
            disabled={session.demo}
            onClick={() => go("profile")}
            aria-current={view === "profile" ? "page" : undefined}
          >
            <Avatar person={session} />
            <span>
              <strong>{session.demo ? t("workspace.demoName") : fullName(session)}</strong>
              <small>
                {session.demo ? t("workspace.demo") : isPlatform(session.role)
                  ? t("workspace.platformAdmin")
                  : t("workspace.personalAccount")}
              </small>
            </span>
          </button>
          <Button tone="quiet" onClick={() => logout()} disabled={loggingOut}>
            {t("workspace.logout")}
          </Button>
          <button className="legal-link" type="button" aria-current={view === "privacy" ? "page" : undefined} onClick={() => go("privacy")}>
            {t("workspace.legal")}
          </button>
        </div>
      </aside>
      <main className="workspace-main" id="main" tabIndex={-1} ref={main}>
        <div className="context-line">
          <span>
            {view === "schools"
              ? t("Platform workspace")
              : ["bookings", "teaching", "profile", "privacy"].includes(view)
                ? t("Personal workspace")
                : school?.name || t("Personal workspace")}
          </span>
        </div>
        <Message>{error}</Message>
        {view === "privacy" && <PrivacyAgreements session={session} />}
        {["lessons", "bookings", "teaching"].includes(view) && (
          <Lessons
            key={`${view}:${school?.id || "none"}:${JSON.stringify(session.schools)}`}
            school={school}
            session={view === "lessons" ? scopedSession : session}
            mode={view === "lessons" ? "school" : view}
            query={router.query}
            go={(values) => go(view, values)}
            onForecast={(spot, date) =>
              go("conditions", { spot, date, time: router.query.time })
            }
          />
        )}
        {view === "conditions" && (
          <Conditions
            session={session}
            query={router.query}
            go={(values) => go("conditions", values)}
            onLessons={school && !session.demo ? (values) => go("lessons", values) : null}
          />
        )}
        {view === "people" && school && (
          <Memberships
            key={school.id}
            school={school}
            session={scopedSession}
          />
        )}
        {view === "accounts" && (
          <People
            key={school?.id || "all"}
            school={school}
            schools={availableSchools}
            session={session}
            query={router.query}
            go={(values) => go("accounts", values)}
          />
        )}
        {view === "schools" && (
          <Schools
            schools={schools.data}
            query={router.query}
            go={(values) => go("schools", values)}
            reload={schools.reload}
            openLessons={(s) => go("lessons", { school: s.slug })}
          />
        )}
        {view === "profile" && (
          <Profile
            session={session}
            onLogoutAll={() => logout(true)}
            onSaved={auth.reload}
            loggingOut={loggingOut}
            onEdit={
              isAdmin(session.role)
                ? () =>
                    go("accounts", {
                      school: session.schoolSlug || "all",
                      person: session.userId,
                      action: "edit",
                    })
                : null
            }
          />
        )}
      </main>
    </div>
  );
}
function Profile({ session, onEdit, onLogoutAll, loggingOut, onSaved }) {
  const { t } = useLocale();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function save(event) {
    event.preventDefault();
    if (!edit || busy) return;
    setNotice('');
    setBusy(true);
    try {
      await request('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(edit) });
      setEdit(null);
      setNotice('account.profileSaved');
      onSaved();
    } catch (error) {
      setNotice(error.status === 400 ? 'account.invalidName' : 'account.unavailable');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-screen">
      <PageHeading
        title={t("My profile")}
        description={t("Your account and school access.")}
        action={
          !session.demo && !edit && <Button tone="primary" onClick={() => {
            setNotice('');
            setEdit({ name: session.name || '', familyName: session.familyName || '' });
          }}>{t("Edit profile")}</Button>
        }
      />
      {edit && <form className="surface padded auth-form" onSubmit={save}>
        <Field label={t('account.givenName')} autoComplete="given-name" maxLength={120} required
          value={edit.name} onChange={event => setEdit({ ...edit, name: event.target.value })} />
        <Field label={t('account.familyName')} autoComplete="family-name" maxLength={120}
          value={edit.familyName} onChange={event => setEdit({ ...edit, familyName: event.target.value })} />
        <Button tone="primary" type="submit" disabled={busy}>{t('account.saveProfile')}</Button>
        <Button onClick={() => setEdit(null)} disabled={busy}>{t('Cancel')}</Button>
      </form>}
      <Message success={notice === 'account.profileSaved'}>{notice && t(notice)}</Message>
      <section className="surface padded">
        <div className="account-summary">
          <Avatar person={session} />
          <div>
            <h2>{fullName(session)}</h2>
            <p className="muted">
              {isPlatform(session.role)
                ? t(roleName(session.role))
                : t("Personal account")}
            </p>
          </div>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>{t("Email")}</dt>
            <dd>{session.email}</dd>
          </div>
          <div>
            <dt>{t("Telephone")}</dt>
            <dd>{session.phone || t("Not provided")}</dd>
          </div>
          {session.description && (
            <div className="wide">
              <dt>{t("About")}</dt>
              <dd>{session.description}</dd>
            </div>
          )}
        </dl>
      </section>
      {session.schools?.length > 0 && (
        <section className="surface padded profile-access">
          <h2>{t("School access")}</h2>
          <dl className="detail-grid">
            {session.schools.map((s) => (
              <div key={s.id}>
                <dt>{s.name}</dt>
                <dd>
                  {!s.open
                    ? t("School closed")
                    : s.status === "suspended"
                      ? t("Staff access suspended")
                      : s.status === "left"
                        ? t("Staff access removed")
                        : [s.owner ? t("Owner") : "", ...s.roles.map(role => t(roleName(role)))]
                            .filter(Boolean)
                            .join(" · ") || t("Surfer")}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className="surface padded profile-access">
        <h2>{t("Account access")}</h2>
        <p className="muted">{t("Log out on all browsers and devices, including this one.")}</p>
        <Button onClick={onLogoutAll} disabled={loggingOut}>
          {loggingOut ? t("Logging out…") : t("Log out everywhere")}
        </Button>
      </section>
      {!session.demo && <AccountSecurity canReview={isPlatform(session.role)} />}
      {onEdit ? (
        <Button onClick={onEdit}>{t("account.manage")}</Button>
      ) : (
        <p className="muted-note">{t("Contact support to update your account details.")}</p>
      )}
    </div>
  );
}
export function getServerSideProps() {
  return { props: {} };
}
