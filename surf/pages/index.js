import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Lessons from "../components/workspace/lessons";
import Conditions from "../components/conditions";
import { ThemeSelector } from "../components/theme";
import People from "../components/workspace/people";
import Schools from "../components/workspace/schools";
import {
  Avatar,
  Brand,
  Button,
  Empty,
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
  const schools = useData(session ? "/api/schools" : null);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const menuButton = useRef(null);
  const sidebar = useRef(null);
  const main = useRef(null);
  const availableSchools = isPlatform(session?.role)
    ? schools.data
    : schools.data.filter((s) => s.id === session?.schoolId);
  const requestedSchool =
    typeof router.query.school === "string" ? router.query.school : "";
  const school =
    requestedSchool === "all" &&
    isPlatform(session?.role) &&
    router.query.view === "people"
      ? null
      : availableSchools.find(
          (s) => s.slug === requestedSchool || s.id === requestedSchool,
        ) ||
        availableSchools[0] ||
        null;
  const allowed = [
    "conditions",
    "lessons",
    ...(isAdmin(session?.role) ? ["people"] : []),
    ...(isPlatform(session?.role) ? ["schools"] : []),
    "profile",
  ];
  const view = allowed.includes(router.query.view)
    ? router.query.view
    : "conditions";
  const labels = {
    lessons: "Lessons",
    conditions: "Conditions",
    people: "People",
    schools: "Schools",
    profile: "My profile",
  };

  useEffect(() => {
    if (auth.url && !auth.loading && !auth.error && !session)
      window.location.replace(
        `/login?school=${encodeURIComponent(requestedSchool)}&next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
  }, [auth.url, auth.loading, auth.error, session]);
  useEffect(() => {
    if (main.current) main.current.focus({ preventScroll: true });
  }, [router.asPath]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [
      ...sidebar.current.querySelectorAll("button:not(:disabled),a,select"),
    ];
    focusable()[0]?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        setMenu(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
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
  async function logout() {
    try {
      await request("/api/auth/session", { method: "DELETE" });
      window.location.assign("/login");
    } catch (e) {
      setError(e.message);
    }
  }
  if (auth.error)
    return (
      <div className="auth-page">
        <Brand />
        <Message>{auth.error}</Message>
        <Button onClick={auth.reload}>Try again</Button>
      </div>
    );
  if (!session || (schools.loading && !schools.data.length))
    return (
      <div className="auth-page">
        <Brand />
        <Loading label="Opening your workspace…" />
      </div>
    );
  if (schools.error)
    return (
      <div className="auth-page">
        <Brand />
        <Message>{schools.error}</Message>
        <Button onClick={schools.reload}>Try again</Button>
      </div>
    );
  return (
    <div className="workspace">
      <Head>
        <title>{labels[view]} · MyWavePlan</title>
        <meta name="robots" content="noindex" />
      </Head>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="mobile-bar">
        <Brand />
        <button
          ref={menuButton}
          className="menu-toggle"
          aria-label={menu ? "Close menu" : "Open menu"}
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
          aria-label="Close navigation"
          onClick={() => {
            setMenu(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebar}
        id="workspace-navigation"
        className={`sidebar ${menu ? "open" : ""}`}
        {...(menu
          ? { role: "dialog", "aria-modal": true, "aria-label": "Navigation" }
          : {})}
      >
        <Brand />
        <div className="school-context">
          <label htmlFor="current-school">
            <small>Current school</small>
          </label>
          {isPlatform(session.role) ? (
            <select
              id="current-school"
              value={school?.slug || "all"}
              onChange={(e) =>
                go(view === "profile" ? "lessons" : view, {
                  school: e.target.value,
                })
              }
            >
              {view === "people" && <option value="all">All schools</option>}
              {availableSchools.map((s) => (
                <option value={s.slug} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <strong>{school?.name || "No school assigned"}</strong>
          )}
          {school && (
            <a
              className="public-link"
              href={`/${school.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Open public schedule ↗
            </a>
          )}
        </div>
        <nav aria-label="Main navigation">
          {allowed
            .filter((v) => v !== "profile")
            .map((v) => (
              <button
                key={v}
                className={`nav-link ${view === v ? "active" : ""}`}
                aria-current={view === v ? "page" : undefined}
                onClick={() => go(v)}
              >
                {labels[v]}
              </button>
            ))}
        </nav>
        <div className="sidebar-footer">
          <ThemeSelector />
          <button
            className="account-button"
            onClick={() => go("profile")}
            aria-current={view === "profile" ? "page" : undefined}
          >
            <Avatar person={session} />
            <span>
              <strong>{fullName(session)}</strong>
              <small>{roleName(session.role)}</small>
            </span>
          </button>
          <Button tone="quiet" onClick={logout}>
            Log out
          </Button>
          <a className="legal-link" href="/legal">
            Legal
          </a>
        </div>
      </aside>
      <main className="workspace-main" id="main" tabIndex={-1} ref={main}>
        <div className="context-line">
          <span>
            {view === "schools"
              ? "Platform workspace"
              : school?.name || "All schools"}
          </span>
        </div>
        <Message>{error}</Message>
        {view === "lessons" && (
          <Lessons
            key={school?.id || "none"}
            school={school}
            session={session}
            query={router.query}
            go={(values) => go("lessons", values)}
            onForecast={(spot, date) => go("conditions", { spot, date })}
          />
        )}
        {view === "conditions" && (
          <Conditions
            session={session}
            query={router.query}
            go={(values) => go("conditions", values)}
          />
        )}
        {view === "people" && (
          <People
            key={school?.id || "all"}
            school={school}
            schools={availableSchools}
            session={session}
            query={router.query}
            go={(values) => go("people", values)}
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
            onEdit={
              isAdmin(session.role)
                ? () =>
                    go("people", {
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
function Profile({ session, onEdit }) {
  return (
    <div className="form-screen">
      <PageHeading
        title="My profile"
        description="Your account and school access."
        action={
          onEdit && (
            <Button tone="primary" onClick={onEdit}>
              Edit profile
            </Button>
          )
        }
      />
      <section className="surface padded">
        <div className="account-summary">
          <Avatar person={session} />
          <div>
            <h2>{fullName(session)}</h2>
            <p className="muted">{roleName(session.role)}</p>
          </div>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Email</dt>
            <dd>{session.email}</dd>
          </div>
          <div>
            <dt>Telephone</dt>
            <dd>{session.phone || "Not provided"}</dd>
          </div>
          {session.description && (
            <div className="wide">
              <dt>About</dt>
              <dd>{session.description}</dd>
            </div>
          )}
        </dl>
      </section>
      {!onEdit && (
        <p className="muted-note">
          Contact your school admin to update your account details.
        </p>
      )}
    </div>
  );
}
export function getServerSideProps() {
  return { props: {} };
}
