import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { accessiblePursuits } from "@/lib/reviewData";
import { folderColor } from "@/lib/covers";
import { getLang, getT } from "@/lib/i18n/server";
import { LOCALE } from "@/lib/i18n";
import { TestRowMenu } from "./TestRowMenu";
import { MakeAllCards } from "./MakeAllCards";

// Your saved tests to take again, and each subject's final test (written
// answers), which opens up once you've gone over all its cards.
export default async function TestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const t = await getT();
  const locale = LOCALE[await getLang()];

  const [tests, folders, withoutCards] = await Promise.all([
    prisma.savedTest.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.pursuit.findMany({
      where: { AND: [accessiblePursuits(userId), { loose: false }, { section: { study: true, OR: [{ kind: "study" }, { kind: null }] } }] },
      orderBy: [{ section: { order: "asc" } }, { createdAt: "asc" }],
      select: { id: true, title: true, cover: true },
    }),
    prisma.note.count({ where: { flashcards: { none: {} }, content: { not: "" }, pursuit: { ownerId: userId, loose: false, section: { study: true } } } }),
  ]);
  const ids = folders.map((f) => f.id);
  const [all, seen] = await Promise.all([
    prisma.flashcard.groupBy({ by: ["pursuitId"], where: { pursuitId: { in: ids } }, _count: { _all: true } }),
    prisma.flashcard.groupBy({ by: ["pursuitId"], where: { pursuitId: { in: ids }, reviewedAt: { not: null } }, _count: { _all: true } }),
  ]);
  const count = (rows: typeof all, id: string) => rows.find((r) => r.pursuitId === id)?._count._all ?? 0;
  const subjects = folders.map((f) => ({ ...f, total: count(all, f.id), seen: count(seen, f.id), color: folderColor(f.id, f.cover) })).filter((f) => f.total > 0);

  const ring = (color: string, v: number) => {
    const r = 10;
    const c = 2 * Math.PI * r;
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" className="shrink-0" aria-hidden>
        <circle cx="13" cy="13" r={r} fill="none" stroke="#ebebea" strokeWidth="3.5" />
        <circle cx="13" cy="13" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 13 13)" />
      </svg>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-10 px-6 py-8 sm:px-12 lg:py-12">
      <div className="flex flex-col gap-1">
        <nav className="text-sm text-ink-faint">
          <Link href="/review" className="hover:text-ink hover:underline">
            {t("Repasar")}
          </Link>{" "}
          / <span className="text-ink-muted">{t("Mis tests")}</span>
        </nav>
        <h1 className="text-[2rem] font-bold tracking-tight">{t("Mis tests")}</h1>
      </div>

      <section className="flex flex-col gap-3">
        <div className="border-b border-border-subtle pb-2">
          <h2 className="text-sm font-semibold">{t("Preguntas de todos tus apuntes")}</h2>
          <p className="text-[13px] text-ink-faint">{t("La IA lee los apuntes que aún no tienen preguntas y las crea, para que los quizzes y el test final los cubran todos.")}</p>
        </div>
        <MakeAllCards pending={withoutCards} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="border-b border-border-subtle pb-2">
          <h2 className="text-sm font-semibold">{t("Test final")}</h2>
          <p className="text-[13px] text-ink-faint">{t("Preguntas de respuesta escrita que la IA corrige con criterio. Se abre cuando ya has repasado todas las tarjetas de la asignatura.")}</p>
        </div>
        {subjects.length === 0 && <p className="text-[13px] text-ink-faint">{t("Aún no tienes tarjetas en ninguna asignatura.")}</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {subjects.map((s) => {
            const ready = s.seen >= s.total;
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border-subtle bg-white px-4 py-3">
                {ring(s.color, s.total ? s.seen / s.total : 0)}
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-sm">{s.title}</b>
                  <span className="text-xs text-ink-faint">{ready ? t("Todo repasado ✓") : t("{0} de {1} tarjetas repasadas", { 0: s.seen, 1: s.total })}</span>
                </span>
                {ready ? (
                  <Link href={`/review/final?pursuit=${s.id}`} className="shrink-0 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white">
                    {t("Empezar")}
                  </Link>
                ) : (
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <Link href={`/review?pursuit=${s.id}&practice=1`} className="rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium hover:bg-chip">
                      {t("Repasar lo que falta")}
                    </Link>
                    <Link href={`/review/final?pursuit=${s.id}`} className="text-[11px] text-ink-faint hover:text-ink hover:underline">
                      {t("Hacerlo igualmente")}
                    </Link>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="border-b border-border-subtle pb-2 text-sm font-semibold">{t("Guardados")}</h2>
        {tests.length === 0 ? (
          <p className="py-2 text-[13px] text-ink-faint">{t("Al acabar un quiz o un test final, pulsa «Guardar test» y aparecerá aquí para rehacerlo.")}</p>
        ) : (
          <ul className="flex flex-col">
            {tests.map((x) => {
              const max = x.kind === "final" ? x.total * 2 : x.total;
              const pct = (n: number | null) => (n === null || !max ? "—" : `${Math.round((n / max) * 100)}%`);
              return (
                <li key={x.id} className="flex items-center gap-3 border-b border-[#f1f1ef] px-1 py-2.5 text-sm">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${x.kind === "final" ? "bg-ink text-white" : "bg-chip text-ink-muted"}`}>{x.kind === "final" ? t("Final") : t("Quiz")}</span>
                  <Link href={x.kind === "final" ? `/review/final?test=${x.id}` : `/review?test=${x.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {x.title}
                  </Link>
                  <span className="hidden text-xs text-ink-faint sm:inline">{t("{0} preguntas", { 0: x.total })}</span>
                  <span className="w-24 text-right text-xs text-ink-muted" title={t("Mejor · última")}>
                    {pct(x.bestScore)} · {pct(x.lastScore)}
                  </span>
                  <span className="hidden w-16 text-right text-xs text-ink-faint sm:inline">{x.updatedAt.toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
                  <Link href={x.kind === "final" ? `/review/final?test=${x.id}` : `/review?test=${x.id}`} className="shrink-0 rounded-md border border-border-subtle px-2.5 py-1 text-xs hover:bg-chip">
                    {t("Rehacer")}
                  </Link>
                  <TestRowMenu id={x.id} title={x.title} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
