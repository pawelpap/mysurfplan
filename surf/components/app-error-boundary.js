import { useLocale } from "./locale";
import { Component } from "react";
import { Brand } from "./workspace/ui";

export default class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Central, privacy-reviewed reporting remains part of roadmap item A6.
    console.error("MyWavePlan could not render this page", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <ErrorScreen />;
  }
}

function ErrorScreen() {
  const { locale, t } = useLocale();
  return (
    <main className="auth-page" aria-labelledby="page-error-title" lang={locale}>
      <Brand />
      <h1 id="page-error-title">{t("This page couldn’t finish loading")}</h1>
      <p>{t("Please reload the page to try again.")}</p>
      <button type="button" className="button primary" onClick={() => window.location.reload()}>
        {t("Reload page")}
      </button>
    </main>
  );
}
