import { useLocale } from "./locale";
export default function DataLicences() {
  const { t } = useLocale();
  return <div className="legal-copy">
      <p>{t("Forecasts combine data from")}{" "}
        <a href="https://open-meteo.com/">Open-Meteo</a>{t(", NOAA GFS Wave and the weather models selected by Open-Meteo, including DWD. Sea-surface temperature uses Open-Meteo marine data, including the Copernicus Marine / Météo-France ocean forecast. Forecast data is provided under")}{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>{t(". MyWavePlan processes it into local surf estimates. Hosted API use is subject to")}{" "}
        <a href="https://open-meteo.com/en/terms">{t("Open-Meteo’s terms")}</a>.
      </p>
      <p>{t("Tide predictions are calculated from")}{" "}
        <a href="https://www.seanoe.org/data/00980/109129/">TICON-4</a> {t("harmonic constants, distributed through the")}{" "}
        <a href="https://github.com/openwatersio/tide-database">{t("Neaps tide database")}</a>{t(", under CC BY 4.0. The Portuguese catalogue uses the Cascais gauge. Heights use mean sea level; storm surge is excluded. Calculations use the MIT-licensed")}{" "}
        <a href="https://github.com/openwatersio/neaps">{t("Neaps tide predictor")}</a>
        .
      </p>
      <p>{t("Light times use")} <a href="https://github.com/mourner/suncalc">SunCalc</a>{t(", under BSD-2-Clause. First and last light refer to civil twilight.")}</p>
    </div>;
}
