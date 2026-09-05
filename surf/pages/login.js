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
    <main className="auth-page">
      <Head>
        <title>Log in · MyWavePlan</title>
      </Head>
      <Brand />
      <h1>Log in</h1>
      <p>
        {school
          ? "Log in to review your lesson and complete the booking."
          : "Open your school workspace and lesson schedule."}
      </p>
      <form className="auth-form" onSubmit={submit}>
        <Field
          label="Email"
          type="email"
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
    </main>
  );
}
