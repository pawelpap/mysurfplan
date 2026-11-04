import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  Brand,
  Button,
  Field,
  Message,
  request,
} from "../components/workspace/ui";
import { LanguageSelector, useLocale } from "../components/locale";
import { legalHref } from "../lib/locale/preferences.mjs";
import { safeNext } from "../lib/lesson-input.mjs";

export async function getServerSideProps({ req, res }) {
  res.setHeader("Cache-Control", "private, no-store");
  const { accountConfig } = await import("../lib/account-server.mjs");
  const config = accountConfig(req);
  return { props: { accountFlows: Boolean(config && (config.environment === "staging" || config.publicAccounts)) } };
}

export default function Login({ accountFlows }) {
  const router = useRouter();
  const { locale, t } = useLocale();
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
      setError("login.missing");
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
      const messages = { 401: "login.invalid", 429: "login.rateLimit" };
      setError(messages[e.status] || (demo ? "login.demoUnavailable" : "login.unavailable"));
      setBusy(false);
    }
  }
  return (
    <main className="login-shell" lang={locale}>
      <Head>
        <title>{(t("login.title")) + " · MyWavePlan"}</title>
      </Head>
      <div className="login-brand">
        <Brand />
        <LanguageSelector compact />
      </div>
      <section className="login-panel" aria-labelledby="login-title">
        <p className="login-welcome">{t("login.welcome")}</p>
        <h1 id="login-title">{t("login.title")}</h1>
        <p>
          {t(school ? "login.booking" : "login.intro")}
        </p>
        {router.query.passwordChanged === "1" && <Message success>{t("account.passwordChanged")}</Message>}
        {router.query.accountClosed === "1" && <Message success>{t("account.closed")}</Message>}
        <form className="auth-form" onSubmit={submit}>
          <Field
            label={t("login.identifier")}
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
          />
          <Field
            label={t("login.password")}
            type={visible ? "text" : "password"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
          />
          <div className="login-password-actions">
            <button
              className="inline-link password-toggle"
              type="button"
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
            >
              {t(visible ? "login.hidePassword" : "login.showPassword")}
            </button>
            {accountFlows && <Link href={{ pathname: "/account/recover", query: { next: safeNext(router.query.next) } }}>
              {t("account.forgot")}
            </Link>}
          </div>
          <Message>{error && t(error)}</Message>
          <div className="login-account-actions">
            <Button tone="primary" type="submit" disabled={busy}>
              {t(busy ? "login.busy" : "login.title")}
            </Button>
            {accountFlows && <Link className="button secondary"
              href={{ pathname: "/account/register", query: { next: safeNext(router.query.next) } }}>
              {t("account.registerTitle")}
            </Link>}
          </div>
        </form>
        <div className="login-demo">
          <Button tone="quiet" onClick={() => login(true)} disabled={busy}>
            {t("login.demo")}
          </Button>
          <small>{t("login.demoHint")}</small>
        </div>
        <div className="auth-help">
          <p><Link href={legalHref("privacy", locale)}>{t("legal.privacy")}</Link> · <Link href={legalHref("terms", locale)}>{t("legal.terms")}</Link> · <Link href={legalHref("storage", locale)}>{t("legal.storage")}</Link></p>
          {accountFlows ? (
            <p className="login-support"><a href="mailto:support@mywaveplan.com">{t("account.support")}</a></p>
          ) : (
            <>
              <strong>{t("login.help")}</strong>
              <p>{t("login.helpBody")}</p>
            </>
          )}
          {school && (
            <p style={{ marginTop: 20 }}>
              <a href={`/${school}`}>{t("login.back")}</a>
            </p>
          )}
        </div>
      </section>
      <section className="login-story" aria-label={t("login.storyLabel")}>
        <div className="login-story-copy">
          <p className="eyebrow">{t("login.eyebrow")}</p>
          <h2>
            {t("login.storyFirst")}
            <br />
            {t("login.storySecond")}
          </h2>
          <p className="story-caption">
            {t("login.storyCaption")}
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
    </main>
  );
}

Login.systemTheme = true;
