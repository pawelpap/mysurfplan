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
    setError("");
    setBusy(true);
    try {
      await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      window.location.assign(safeNext(router.query.next));
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
      <section className="login-story" aria-label="MyWavePlan for surf schools">
        <div className="login-story-copy">
          <p className="eyebrow">Made for surf schools</p>
          <h2>
            Plan the lesson.
            <br />
            Catch the wave.
          </h2>
          <p className="story-caption">Lessons and people, in one place.</p>
        </div>
        <div className="login-sun" aria-hidden="true" />
        <svg className="login-surf" viewBox="0 0 560 430" aria-hidden="true">
          <path
            d="M36 318C120 218 230 235 310 312C376 375 458 368 532 292"
            stroke="#0D6E7A"
            strokeWidth="17"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M24 362C116 304 246 315 350 366C435 408 494 405 550 345"
            stroke="#11A096"
            strokeWidth="11"
            strokeLinecap="round"
            fill="none"
            opacity="0.72"
          />
          <path
            d="M154 232C210 190 276 190 336 236"
            stroke="#EF5C49"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M248 200C286 176 318 178 352 202"
            stroke="#203039"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="334" cy="162" r="15" fill="#203039" />
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
            spellCheck={false}
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            type={visible ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
