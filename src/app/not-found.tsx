import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { BrokenThread, errorButton } from "./BrokenThread";

export const metadata = { title: "Página no encontrada" };

export default async function NotFound() {
  const t = await getT();
  return (
    <BrokenThread title={t("Esta página no está en el mapa.")} text={t("Puede que se haya movido o que nunca existiera.")}>
      <Link href="/" className={errorButton}>
        {t("← Volver al inicio")}
      </Link>
    </BrokenThread>
  );
}
