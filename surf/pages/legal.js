import { useLocale } from "../components/locale";
import { LegalLayout } from "../components/legal";
import DataLicences from "../components/data-licences";

export default function Legal() {
  const { t } = useLocale();
  return <LegalLayout title={t("Data licences")}><DataLicences /></LegalLayout>;
}
