import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  Brand,
  Button,
  Field,
  Message,
  request,
} from "../components/workspace/ui";
import { safeNext } from "../lib/lesson-input.mjs";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const school =
    typeof router.query.school === "string" &&
    /^[a-z0-9-]+$/i.test(router.query.school)
      ? router.query.school
      : "";
  async function submit(event) {
    event.preventDefault();
    const demo = !email.trim() && password === "";
    if (!demo && (!email.trim() || !password)) {
      setError("Enter both your username and password, or choose Try the demo.");
      return;
    }
    await login(demo);
  }
  async function login(demo = false) {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(demo ? { email: "", password: "" } : { email, password }),
      });
      window.location.assign(demo ? "/?view=conditions" : safeNext(router.query.next));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <Head>
        <title>Log in · MyWavePlan</title>
      </Head>
      <div className="login-brand">
        <Brand />
      </div>
      <section className="login-story" aria-label="MyWavePlan for surfers">
        <div className="login-story-copy">
          <p className="eyebrow">Made for surfers by surfers</p>
          <h2>
            Plan the lesson.
            <br />
            Catch the wave.
          </h2>
          <p className="story-caption">
            Lessons, people and forecasts in one place.
          </p>
        </div>
        <div className="login-sun" aria-hidden="true" />
        <svg className="login-surf" viewBox="0 0 560 430" aria-hidden="true">
          <path
            d="M36 318C120 218 230 235 310 312C376 375 458 368 532 292"
            stroke="var(--illustration-wave)"
            strokeWidth="17"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M24 362C116 304 246 315 350 366C435 408 494 405 550 345"
            stroke="var(--illustration-wave-secondary)"
            strokeWidth="11"
            strokeLinecap="round"
            fill="none"
            opacity="0.72"
          />
          <path
            d="M154 232C210 190 276 190 336 236"
            stroke="var(--illustration-board)"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M248 200C286 176 318 178 352 202"
            stroke="var(--illustration-surfer)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="334" cy="162" r="15" fill="var(--illustration-surfer)" />
        </svg>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <p className="login-welcome">Welcome back</p>
        <h1 id="login-title">Log in</h1>
        <p>
          {school
            ? "Log in to review your lesson and complete the booking."
            : "Open your school workspace and lesson schedule."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          <Field
            label="Email or username"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
          />
          <Field
            label="Password"
            type={visible ? "text" : "password"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
          />
          <button
            className="inline-link password-toggle"
            type="button"
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? "Hide password" : "Show password"}
          </button>
          <Message>{error}</Message>
          <Button tone="primary" type="submit" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </Button>
          <Button onClick={() => login(true)} disabled={busy}>
            Try the demo
          </Button>
          <small>Explore forecasts as a student. No login details needed.</small>
        </form>
        <div className="auth-help">
          <strong>Need an account or help logging in?</strong>
          <p>
            Ask your school admin to create an account or reset your password.
          </p>
          {school && (
            <p style={{ marginTop: 20 }}>
              <a href={`/${school}`}>← Back to the school schedule</a>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

Login.systemTheme = true;
