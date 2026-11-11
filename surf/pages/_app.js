import Head from "next/head";
import "../styles/fonts.css";
import "../styles/themes.css";
import "../styles/app.css";
import "../styles/conditions.css";
import "../styles/team.css";
import "../styles/locale-layout.css";
import "../styles/school-setup.css";
import "leaflet/dist/leaflet.css";
import "../styles/school-branding.css";
import "../styles/ownership.css";
import { LocaleProvider } from "../components/locale";
import { ThemeProvider } from "../components/theme";
import { SpotLocationProvider } from "../components/spot-select";
import AppErrorBoundary from "../components/app-error-boundary";
export default function MyWavePlan({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <LocaleProvider>
        <AppErrorBoundary>
          <ThemeProvider systemOnly={Component.systemTheme === true}>
            <SpotLocationProvider>
              <Component {...pageProps} />
            </SpotLocationProvider>
          </ThemeProvider>
        </AppErrorBoundary>
      </LocaleProvider>
    </>
  );
}
