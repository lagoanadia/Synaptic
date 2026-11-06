import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "../../../Logo";
import { DeleteButton } from "../../DeleteButton";
import { createPursuit, deletePursuit, deleteSection } from "../../actions";
import { ArrowLeft, BoltIcon, CardsIcon, QuestionIcon, TrashIcon } from "../../../icons";
import { SHARED, UNSORTED, getConcepts, pursuitWhere, type ReviewScope } from "@/lib/reviewData";
import { startOfWeek } from "@/lib/review";
import { tileColor } from "@/lib/tileColor";

const shortDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A Section: what to do today on top (one primary action), then every
// subject as a card that says its state in words.
export default async function SectionPage({ params }: { params: Promise<{ sectionId: string }> }) {
  const { sectionId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const isVirtual = sectionId === UNSORTED || sectionId === SHARED;
  const section = isVirtual ? null : await prisma.section.findFirst({ where: { id: sectionId, userId } });
  if (!isVirtual && !section) notFound();

  const name = section?.name ?? (sectionId === SHARED ? "Compartido" : "Sin clasificar");
  const scope: ReviewScope = { kind: "section", sectionId };
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const [pursuits, weekConcepts] = await Promise.all([
    prisma.pursuit.findMany({
      where: pursuitWhere(userId, scope),
      orderBy: { lastTouchedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        ownerId: true,
        projects: { select: { dueDate: true, cards: { select: { status: true } } } },
        _count: { select: { flashcards: { where: { dueDate: { lte: now } } }, notes: true } },
      },
    }),
    getConcepts(userId, scope, { since: startOfWeek(now), take: 12 }),
  ]);

  const due = pursuits.reduce((n, p) => n + p._count.flashcards, 0);
  const q = `section=${sectionId}`;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-8 px-6 py-10 lg:px-14">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="group flex items-center gap-3">
          <Link href="/pursuits" aria-label="Todas las secciones" className="rounded-full p-2 text-ink-muted hover:bg-chip hover:text-ink">
            <ArrowLeft size={18} className="block" />
          </Link>
          <Logo href="/pursuits" withWordmark={false} />
          <h1 className="text-3xl font-extrabold text-tile-cyan italic">{name}</h1>
          {section && (
            <DeleteButton
              action={deleteSection.bind(null, section.id)}
              confirmMessage={`¿Eliminar la sección "${section.name}"? Sus asignaturas pasan a Sin clasificar; no se borra nada de dentro.`}
              className="rounded-full p-1.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-chip hover:text-red-600 focus:opacity-100"
            >
              <TrashIcon size={16} title={`Eliminar sección ${section.name}`} />
            </DeleteButton>
          )}
        </div>
      </header>

      {/* Today */}
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(13,13,13,0.06)] lg:flex-row lg:items-center" aria-label="Hoy">
        <Link
          href={due > 0 ? `/review?mode=flash&${q}` : `/review?mode=learn&${q}`}
          className="flex shrink-0 items-center gap-3 rounded-2xl bg-tile-blue px-6 py-4 text-white transition-transform hover:-translate-y-0.5"
        >
          <CardsIcon size={26} />
          <span className="text-lg font-extrabold">{due > 0 ? `Repasar ${plural(due, "tarjeta")}` : "Aprender"}</span>
        </Link>
        <nav className="flex flex-wrap gap-2" aria-label="Otras formas de practicar">
          {[
            { mode: "learn", label: "Aprender", Icon: QuestionIcon },
            { mode: "match", label: "Unir", Icon: BoltIcon },
          ].map(({ mode, label, Icon }) => (
            <Link key={mode} href={`/review?mode=${mode}&${q}`} className="flex items-center gap-2 rounded-full bg-chip px-4 py-2.5 text-sm font-semibold hover:bg-accent-soft hover:text-accent">
              <Icon size={16} /> {label}
            </Link>
          ))}
          <Link href="/challenges" className="flex items-center gap-2 rounded-full bg-chip px-4 py-2.5 text-sm font-semibold hover:bg-mint/15 hover:text-mint">
            <span className="font-mono text-xs font-bold">{"</>"}</span> Código
          </Link>
        </nav>
        {weekConcepts.length > 0 && (
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:justify-end">
            <span className="shrink-0 text-xs font-semibold text-ink-muted">Nuevo esta semana</span>
            <div className="flex min-w-0 gap-1.5 overflow-x-auto">
              {weekConcepts.map((c) => (
                <Link
                  key={c.id}
                  href={`/pursuits/${c.pursuitId}?tab=pages`}
                  title={c.pursuitTitle}
                  className="shrink-0 rounded-full border border-border-subtle px-3 py-1.5 text-xs hover:border-tile-sky hover:text-tile-sky"
                >
                  {c.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Subjects */}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4" aria-label="Asignaturas">
        {pursuits.map((p, i) => {
          const nextDue = p.projects
            .map((pr) => pr.dueDate)
            .filter((d): d is Date => !!d && d >= today)
            .sort((a, b) => a.getTime() - b.getTime())[0];
          const openTasks = p.projects.reduce((n, pr) => n + pr.cards.filter((c) => c.status !== "DONE").length, 0);
          const cards = p._count.flashcards;
          const facts = [
            nextDue && { text: `Entrega ${shortDate(nextDue)}`, strong: nextDue.getTime() - today.getTime() < 3 * 86400000 },
            openTasks > 0 && { text: openTasks === 1 ? "1 tarea abierta" : `${openTasks} tareas abiertas`, strong: false },
            cards > 0 && { text: `${cards} por repasar`, strong: true },
          ].filter(Boolean) as { text: string; strong: boolean }[];
          return (
            <li key={p.id} className="group relative">
              <Link
                href={`/pursuits/${p.id}`}
                className={`flex h-full min-h-40 flex-col justify-between gap-4 rounded-3xl p-5 text-white transition-all hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(13,13,13,0.12)] ${
                  p.status === "ACTIVE" ? tileColor(i) : "bg-ink-muted"
                }`}
              >
                <span className="pr-8 text-xl leading-tight font-extrabold">{p.title}</span>
                <span className="flex flex-wrap gap-1.5">
                  {facts.length === 0 && <span className="text-xs">{p._count.notes > 0 ? plural(p._count.notes, "note") : "Vacío"}</span>}
                  {facts.map((f) => (
                    <span key={f.text} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${f.strong ? "bg-white text-ink" : "bg-white/25"}`}>
                      {f.text}
                    </span>
                  ))}
                  {p.status !== "ACTIVE" && <span className="rounded-full bg-white/25 px-2.5 py-1 text-xs">{p.status.toLowerCase()}</span>}
                </span>
              </Link>
              {p.ownerId === userId && (
                <DeleteButton
                  action={deletePursuit.bind(null, p.id)}
                  confirmMessage={`¿Eliminar "${p.title}" y todo lo que contiene? No se puede deshacer.`}
                  className="absolute top-4 right-4 rounded-full bg-black/15 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/30 focus:opacity-100"
                >
                  <TrashIcon size={15} title={`Eliminar ${p.title}`} />
                </DeleteButton>
              )}
            </li>
          );
        })}
        {sectionId !== SHARED && (
          <li>
            <form action={createPursuit} className="flex h-full min-h-40 flex-col justify-center gap-2 rounded-3xl border-2 border-dashed border-border-subtle p-5 focus-within:border-tile-sky">
              <input type="hidden" name="section" value={section?.name ?? ""} />
              <input
                type="text"
                name="title"
                required
                placeholder="+ Nueva asignatura"
                aria-label="Nombre de la asignatura"
                className="bg-transparent text-lg font-bold placeholder:text-ink-faint focus:outline-none"
              />
              <button type="submit" className="self-start rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white">
                Añadir
              </button>
            </form>
          </li>
        )}
      </ul>
    </div>
  );
}
