import Head from "next/head";
import Link from "next/link";
import { LanguageSelector, useLocale } from "../components/locale";
import { Brand } from "../components/workspace/ui";

export default function NotFound() {
  const { locale, t } = useLocale();
  return <main className="auth-page" lang={locale}>
    <Head><title>{(t("Page not found")) + " · MyWavePlan"}</title></Head>
    <Brand />
    <LanguageSelector compact />
    <h1>{t("Page not found")}</h1>
    <p>{t("This page could not be found.")}</p>
    <Link className="button primary" href="/">{t("Back to MyWavePlan")}</Link>
  </main>;
}
