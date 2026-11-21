import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { CheckIcon } from "@/app/icons";
import { LANGUAGE_INFO, asLanguage } from "@/lib/challenge";
import { LANGUAGE_STYLE, difficultyOf } from "@/app/challenges/look";

// "Retos": this subject's coding challenges, and a way to get more.
export async function ChallengeCards({
  pursuitId,
  items,
}: {
  pursuitId: string;
  items: { id: string; title: string; language: string; difficulty: string; passed: boolean }[];
}) {
  const t = await getT();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => {
        const lang = asLanguage(c.language);
        const d = difficultyOf(c.difficulty);
        return (
          <Link key={c.id} href={`/challenges/${c.id}`} className={`flex flex-col gap-3 rounded-lg border border-border-subtle p-4 hover:shadow-sm ${c.passed ? "bg-[#f4f8f3]" : "bg-white"}`}>
            <span className={`grid size-8 place-items-center rounded-md font-mono text-[11px] font-bold ${LANGUAGE_STYLE[lang].badge}`}>{LANGUAGE_INFO[lang].short}</span>
            <span className="text-sm font-semibold">{c.title}</span>
            <span className="flex items-center gap-2 text-xs text-ink-muted">
              <span className={`size-2 rounded-full ${d.bar}`} /> {t(d.label)}
              {c.passed && (
                <span className="ml-auto flex items-center gap-1 font-semibold text-[#448361]">
                  <CheckIcon size={12} />{" "}{t("Resuelto")}
                </span>
              )}
            </span>
          </Link>
        );
      })}
      <Link href={`/challenges?pursuit=${pursuitId}`} className="grid min-h-28 place-items-center rounded-lg border border-dashed border-[#d3d1cb] text-sm text-ink-faint hover:text-ink">
        {t("+ Dame 3 retos")}
      </Link>
    </div>
  );
}

// "Mis entregas": per unit, the teacher's assignment, what the student
// handed in and the reference code, as "Unificar con Drive" placed them.
export async function DeliveryRows({ units }: { units: import("@/lib/driveDeliveries").UnitDelivery[] }) {
  const t = await getT();
  if (!units.length)
    return (
      <p className="text-sm text-ink-faint">
        {t("Aquí aparecerán el enunciado, tu entrega y el código de cada unidad cuando")}{" "}
        <Link href="/drive" className="text-accent hover:underline">{t("Unificar con Drive")}</Link>{" "}
        {t("los coloque.")}
      </p>
    );
  const open = (id: string) => `https://drive.google.com/file/d/${id}/view`;
  const chip = "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium";
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(15,15,15,.07),0_1px_2px_rgba(15,15,15,.04)]">
        {units.map((u) => (
          <li key={u.unit} className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2.5 last:border-b-0">
            <b className="w-12 shrink-0 text-sm font-semibold">UD{u.unit}</b>
            {u.statement ? (
              <a href={open(u.statement)} target="_blank" rel="noopener noreferrer" title={t("No lo edites: si el profe sube una versión nueva, se sustituye.")} className={`${chip} bg-chip hover:bg-hover`}>
                📄 {t("Enunciado")}
              </a>
            ) : (
              <span className={`${chip} text-ink-faint`}>📄 {t("Sin enunciado")}</span>
            )}
            {u.submission ? (
              <a href={open(u.submission)} target="_blank" rel="noopener noreferrer" className={`${chip} bg-[#e6f2ea] text-[#2f7a4f] hover:brightness-95`}>
                <CheckIcon size={13} className="block" /> {t("Mi entrega")}
              </a>
            ) : (
              <span className={`${chip} ${u.statement ? "bg-[#fbf3db] text-[#a8740f]" : "text-ink-faint"}`}>{u.statement ? t("Pendiente de entregar") : t("Sin entrega")}</span>
            )}
            {u.code.map((c) => (
              <a key={c.id} href={open(c.id)} target="_blank" rel="noopener noreferrer" title={c.name} className={`${chip} bg-chip hover:bg-hover`}>
                {"</>"} {c.name.replace(/^[A-Z]+_UD\d+_/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ")}
              </a>
            ))}
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-faint">{t("Los enunciados son del profe: no los edites, porque una versión nueva los sustituye. Tus trabajos sin entregar siguen siendo Docs editables en tu Drive.")}</p>
    </div>
  );
}
