import Head from "next/head";
import "../styles/themes.css";
import "../styles/app.css";
import "../styles/conditions.css";
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
      <AppErrorBoundary>
        <ThemeProvider systemOnly={Component.systemTheme === true}>
          <SpotLocationProvider>
            <Component {...pageProps} />
          </SpotLocationProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </>
  );
}
