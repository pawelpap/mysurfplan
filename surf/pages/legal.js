import Head from "next/head";
import { Brand } from "../components/workspace/ui";

export default function Legal() {
  return (
    <main className="legal-page">
      <Head>
        <title>Legal · MyWavePlan</title>
      </Head>
      <Brand />
      <h1>Data licences</h1>
      <p>
        Forecasts combine data from{" "}
        <a href="https://open-meteo.com/">Open-Meteo</a>, NOAA GFS Wave and the
        weather models selected by Open-Meteo, including DWD. Sea-surface
        temperature uses Open-Meteo marine data, including the Copernicus Marine
        / Météo-France ocean forecast. Forecast data is provided under{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        MyWavePlan processes it into local surf estimates. Hosted API use is
        subject to{" "}
        <a href="https://open-meteo.com/en/terms">Open-Meteo’s terms</a>.
      </p>
      <p>
        Tide predictions are calculated from{" "}
        <a href="https://www.seanoe.org/data/00980/109129/">TICON-4</a> harmonic
        constants, distributed through the{" "}
        <a href="https://github.com/openwatersio/tide-database">
          Neaps tide database
        </a>
        , under CC BY 4.0. The Portuguese catalogue uses the Cascais gauge.
        Heights use mean sea level; storm surge is excluded. Calculations use
        the MIT-licensed{" "}
        <a href="https://github.com/openwatersio/neaps">Neaps tide predictor</a>
        .
      </p>
      <p>
        Light times use <a href="https://github.com/mourner/suncalc">SunCalc</a>
        , under BSD-2-Clause. First and last light refer to civil twilight.
      </p>
      <p>
        <a href="/">Back to MyWavePlan</a>
      </p>
    </main>
  );
}
