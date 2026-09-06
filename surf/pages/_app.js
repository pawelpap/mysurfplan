import "../styles/themes.css";
import "../styles/app.css";
import { ThemeProvider } from "../components/theme";
import { SpotLocationProvider } from "../components/spot-select";
export default function MyWavePlan({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <SpotLocationProvider>
        <Component {...pageProps} />
      </SpotLocationProvider>
    </ThemeProvider>
  );
}
