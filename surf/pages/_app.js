import Head from "next/head";
import "../styles/themes.css";
import "../styles/app.css";
import { ThemeProvider } from "../components/theme";
import { SpotLocationProvider } from "../components/spot-select";
export default function MyWavePlan({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <ThemeProvider>
        <SpotLocationProvider>
          <Component {...pageProps} />
        </SpotLocationProvider>
      </ThemeProvider>
    </>
  );
}
