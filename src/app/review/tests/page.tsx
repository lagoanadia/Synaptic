import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { accessiblePursuits, getCards } from "@/lib/reviewData";
import { after } from "next/server";
import { aiBudget } from "@/lib/access";
import { needsQuizText, withDistractors } from "@/lib/quizDistractors";
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
  // While you look at this list, the quiz versions of cards that don't have
  // one yet get written, so "Repasar lo que falta" starts without waiting.
  const email = session.user.email;
  after(async () => {
    const todo = (await getCards(userId, { kind: "all" })).filter(needsQuizText).slice(0, 12);
    if (!todo.length) return;
    const budget = await aiBudget(userId, email);
    if (await budget.check()) return;
    const done = await withDistractors(todo);
    if (done !== todo) await budget.charge();
  });

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

  // Ready first, then the closest to ready.
  subjects.sort((a, b) => Number(b.seen >= b.total) - Number(a.seen >= a.total) || b.seen / b.total - a.seen / a.total);
  const readyCount = subjects.filter((s) => s.seen >= s.total).length;

  const ring = (color: string, v: number) => {
    const r = 15;
    const c = 2 * Math.PI * r;
    return (
      <svg width="38" height="38" viewBox="0 0 38 38" className="shrink-0" aria-hidden>
        <circle cx="19" cy="19" r={r} fill="none" stroke="var(--color-chip)" strokeWidth="4" />
        {v > 0 && <circle cx="19" cy="19" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 19 19)" />}
        {v >= 1 && <path d="m14 19.5 3.3 3.3 6.7-6.8" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    );
  };
  const head = (title: string, side?: React.ReactNode) => (
    <div className="flex items-end gap-3 border-b border-border-subtle pb-2">
      <h2 className="min-w-0 flex-1 text-[15px] font-semibold">{title}</h2>
      {side}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-1 flex-col gap-10 px-6 py-8 sm:px-12 lg:py-12">
      <div className="flex flex-col gap-1">
        <nav className="text-sm text-ink-faint">
          <Link href="/review" className="hover:text-ink hover:underline">
            {t("Repasar")}
          </Link>{" "}
          / <span className="text-ink-muted">{t("Mis tests")}</span>
        </nav>
        <h1 className="text-[2rem] font-bold tracking-tight">{t("Mis tests")}</h1>
      </div>

      {/* Only when some notes still have no questions. */}
      {withoutCards > 0 && <MakeAllCards pending={withoutCards} />}

      <section className="flex flex-col gap-3">
        {head(
          t("Test final"),
          subjects.length > 0 && <span className="shrink-0 text-xs text-ink-faint">{t("{0} de {1} listos", { 0: readyCount, 1: subjects.length })}</span>,
        )}
        {subjects.length === 0 && <p className="py-2 text-[13px] text-ink-faint">{t("Aún no tienes tarjetas en ninguna asignatura.")}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {subjects.map((s) => {
            const ready = s.seen >= s.total;
            const left = s.total - s.seen;
            return (
              <div key={s.id} className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-[0_0_0_1px_rgba(15,15,15,.07),0_1px_2px_rgba(15,15,15,.04)]">
                <div className="flex items-center gap-3">
                  {ring(s.color, s.total ? s.seen / s.total : 0)}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-[15px]">{s.title}</b>
                    <span className="text-xs text-ink-faint">{ready ? t("Todo repasado ✓") : t("Faltan {0} de {1} tarjetas", { 0: left, 1: s.total })}</span>
                  </span>
                </div>
                {ready ? (
                  <Link href={`/review/final?pursuit=${s.id}`} className="rounded-lg bg-accent px-3 py-2 text-center text-sm font-semibold text-white hover:brightness-95">
                    {t("Empezar test final")}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link href={`/review?pursuit=${s.id}&practice=1`} className="flex-1 rounded-lg bg-chip px-3 py-2 text-center text-sm font-medium hover:bg-hover">
                      {t("Repasar lo que falta")}
                    </Link>
                    <Link href={`/review/final?pursuit=${s.id}`} title={t("Hacerlo igualmente")} className="rounded-lg px-2.5 py-2 text-xs text-ink-faint hover:bg-chip hover:text-ink">
                      {t("Hacerlo ya")}
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {head(t("Guardados"))}
        {tests.length === 0 ? (
          <p className="py-2 text-[13px] text-ink-faint">{t("Al acabar un quiz o un test final, pulsa «Guardar test» y aparecerá aquí.")}</p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(15,15,15,.07),0_1px_2px_rgba(15,15,15,.04)]">
            {tests.map((x) => {
              const max = x.kind === "final" ? x.total * 2 : x.total;
              const pct = (n: number | null) => (n === null || !max ? "—" : `${Math.round((n / max) * 100)}%`);
              const href = x.kind === "final" ? `/review/final?test=${x.id}` : `/review?test=${x.id}`;
              return (
                <li key={x.id} className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 text-sm last:border-b-0">
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${x.kind === "final" ? "bg-accent-soft text-accent" : "bg-chip text-ink-muted"}`}>{x.kind === "final" ? t("Final") : t("Quiz")}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Link href={href} className="truncate font-medium hover:underline">
                      {x.title}
                    </Link>
                    <span className="text-xs text-ink-faint">
                      {t("{0} preguntas", { 0: x.total })} · {x.updatedAt.toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <span className="text-right text-xs leading-tight" title={t("Mejor · última")}>
                    <b className="block text-sm font-semibold">{pct(x.bestScore)}</b>
                    <span className="text-ink-faint">{pct(x.lastScore)}</span>
                  </span>
                  <Link href={href} className="shrink-0 rounded-lg bg-chip px-3 py-1.5 text-xs font-medium hover:bg-hover">
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
