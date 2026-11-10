import { LOCALE } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import { ArrowDown } from "@/app/icons";
import Link from "next/link";
import { Fragment } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { removePursuitTag, setClassroomEnabled } from "./actions";
import { TagForm } from "./TagForm";
import { MemberForm } from "./MemberForm";
import { MemberRow } from "./MemberRow";
import { LeaveButton } from "./LeaveButton";
import { AskPursuit } from "./AskPursuit";
import { PursuitTitle } from "./PursuitTitle";
import { DeleteButton } from "../DeleteButton";
import { ClassroomImport } from "./ClassroomImport";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { StatusNote } from "./StatusNote";
import { ProjectsBoard } from "./ProjectsBoard";
import { PagesBoard, type PageCard } from "./PagesBoard";
import { autoTitle } from "@/lib/text";
import { conceptExcerpt } from "@/lib/review";
import { UNSORTED, SHARED } from "@/lib/reviewData";
import { folderBlocks } from "@/lib/blocks";
import { folderColor, folderCover } from "@/lib/covers";
import { folderMap } from "@/lib/blockData";
import { backfillMaps } from "@/lib/autoMap";
import { after } from "next/server";
import { KnowledgeMap } from "@/app/KnowledgeMap";
import { Folder } from "@/app/Covers";
import { FolderBlocks } from "./FolderBlocks";
import { FolderSettings } from "./FolderSettings";
import { oneProject } from "@/lib/projectData";
import { parseAvatar } from "@/lib/avatar";
import { optionColumns } from "@/lib/blocks";
import { bestDay, settle } from "@/lib/shared";
import { DatesBlock, ExpensesBlock, SavingsBlock } from "./SharedBlocks";
import { dayOf } from "@/lib/projects";
import { ProjectInfo } from "@/app/projects/ProjectInfo";
import { TaskBoard } from "@/app/projects/TaskBoard";
import { ChallengeCards, ReviewToday } from "./FolderBlockViews";
import { BudgetBlock, Faces, OptionsBlock, PeopleCount, VotesBanner, type Person } from "./TripBlocks";

const CLASSROOM_ERROR_COPY: Record<string, string> = {
  denied: "Conexión con Google Classroom cancelada.",
  "connect-failed": "No se ha podido conectar con Google Classroom. Inténtalo de nuevo.",
  "no-refresh-token": "Google no ha dado acceso permanente — quita el acceso anterior en myaccount.google.com/permissions e inténtalo de nuevo.",
};

export default async function PursuitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    section?: string;
    edit?: string;
    classroomConnected?: string;
    classroomError?: string;
  }>;
}) {
  const locale = LOCALE[await getLang()];
  const t = await getT();
  const { id } = await params;
  const { tab, classroomConnected, classroomError, edit } = await searchParams;
  // Old tab links: flashcards now live in the review session.
  if (tab === "cards") redirect(`/review?pursuit=${id}`);
  const editing = edit === "1";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const [pursuit, classroomConnection, otherLinked, cardUnits, challenges] =
    await Promise.all([
      prisma.pursuit.findFirst({
        where: {
          id,
          OR: [
            { ownerId: session.user.id },
            { members: { some: { userId: session.user.id } } },
          ],
        },
        include: {
          pursuitTags: true,
          section: true,
          owner: { select: { id: true, name: true, email: true, image: true, avatar: true } },
          members: {
            orderBy: { invitedAt: "asc" },
            include: { user: { select: { id: true, name: true, email: true, image: true, avatar: true } } },
          },
          brainDumps: {
            orderBy: { createdAt: "desc" },
            include: { author: { select: { id: true, name: true, email: true, image: true } } },
          },
          notes: {
            orderBy: { createdAt: "desc" },
            include: { tags: true, sourceDumps: { select: { id: true, content: true } }, _count: { select: { flashcards: true } } },
          },
          contentSections: { orderBy: { order: "asc" } },
          attachments: { orderBy: { createdAt: "desc" } },
          projects: {
            orderBy: { createdAt: "desc" },
            include: { cards: { select: { status: true } } },
          },
        },
      }),
      prisma.googleClassroomConnection.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      }),
      prisma.pursuit.findMany({
        where: { ownerId: session.user.id, id: { not: id }, classroomCourseId: { not: null } },
        select: { title: true, classroomCourseId: true },
      }),
      // Which unit each card belongs to (through its note), for the
      // per-column study buttons.
      prisma.flashcard.findMany({
        where: { pursuitId: id },
        select: { dueDate: true, note: { select: { sectionId: true } } },
      }),
      prisma.challenge.findMany({
        where: { pursuitId: id, userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, title: true, language: true, difficulty: true, passed: true },
      }),
    ]);

  if (!pursuit) {
    notFound();
  }



  // Where "back" goes: the Section this subject lives in on the new home.
  const backHref =
    pursuit.owner.id !== session.user.id
      ? `/pursuits/s/${SHARED}`
      : `/pursuits/s/${pursuit.section?.id ?? UNSORTED}`;
  const backLabel =
    pursuit.owner.id !== session.user.id ? "Compartido" : (pursuit.section?.name ?? t("Sin clasificar"));

  // One card per page: the raw dump plus the note organized from it (a
  // note made from several dumps stays with the first). Notes whose
  // dumps are gone get a card of their own.
  const noteForDump = new Map<string, (typeof pursuit.notes)[number]>();
  for (const n of pursuit.notes) {
    const first = n.sourceDumps[0];
    if (first && !noteForDump.has(first.id)) noteForDump.set(first.id, n);
  }
  const filesFor = (dumpId: string) => pursuit.attachments.filter((a) => a.dumpId === dumpId).length;
  const shortDate = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  const pageCards: PageCard[] = [
    ...pursuit.brainDumps.map((d) => {
      const note = noteForDump.get(d.id);
      const text = note?.content ?? d.content ?? "";
      return {
        key: d.id,
        dumpId: d.id,
        noteId: note?.id ?? null,
        href: `/pursuits/${pursuit.id}/dump/${d.id}`,
        title: autoTitle(text, 10),
        preview: conceptExcerpt(text, 120),
        organized: !!note,
        files: filesFor(d.id) + d.images.length,
        flashcards: note?._count.flashcards ?? 0,
        sectionId: note?.sectionId ?? d.sectionId,
        date: shortDate(d.createdAt),
      };
    }),
    ...pursuit.notes
      .filter((n) => n.sourceDumps.length === 0)
      .map((n) => ({
        key: n.id,
        dumpId: null,
        noteId: n.id,
        href: `/pursuits/${pursuit.id}/note/${n.id}`,
        title: autoTitle(n.content, 10),
        preview: conceptExcerpt(n.content, 120),
        organized: true,
        files: 0,
        flashcards: n._count.flashcards,
        sectionId: n.sectionId,
        date: shortDate(n.createdAt),
      })),
  ];

  const study = pursuit.section?.study ?? true;
  const cover = folderCover(pursuit.id, pursuit.cover);
  const color = folderColor(pursuit.id, pursuit.cover);
  const groupLabel = pursuit.groupLabel ?? "Unidad";
  const grouped = pursuit.contentSections.length > 0;
  const blocks = folderBlocks(pursuit.blocks, study, pursuit.projects.length > 0);
  const isOwner = pursuit.owner.id === session.user.id;
  const here = `/pursuits/${pursuit.id}`;

  // A project folder shows its state and dates under the title.
  const project = blocks.some((b) => b.type === "project") ? await oneProject(session.user.id, pursuit.id) : null;
  // Everyone in the folder, as coloured initials (owner first).
  const FACE_COLORS = ["#2f7fdc", "#ee6a35", "#1fae7c", "#e2a21b", "#8b7bf5", "#e5605a"];
  const people: Person[] = [pursuit.owner, ...pursuit.members.map((m) => m.user)].map((u, i) => {
    const name = u.name ?? u.email;
    return { id: u.id, name, initial: name.trim().charAt(0).toUpperCase(), color: FACE_COLORS[i % FACE_COLORS.length], avatar: u.avatar ? parseAvatar(u.avatar) : null };
  });
  // Options and budget blocks (a trip, a move…): their rows.
  const hasChoices = blocks.some((b) => b.type === "options" || b.type === "budget");
  const [choices, budgetLines] = hasChoices
    ? await Promise.all([
        prisma.choice.findMany({ where: { pursuitId: pursuit.id }, orderBy: { order: "asc" }, include: { votes: { select: { userId: true } } } }),
        prisma.budgetLine.findMany({ where: { pursuitId: pursuit.id }, orderBy: { order: "asc" } }),
      ])
    : [[], []];
  // Gastos, Fechas, Meta de ahorro: their rows.
  const hasShared = blocks.some((b) => b.type === "expenses" || b.type === "dates" || b.type === "savings");
  const [expenses, dateOptions, savings] = hasShared
    ? await Promise.all([
        prisma.expense.findMany({ where: { pursuitId: pursuit.id }, orderBy: { createdAt: "asc" } }),
        prisma.dateOption.findMany({ where: { pursuitId: pursuit.id }, orderBy: { day: "asc" }, include: { votes: { select: { userId: true } } } }),
        prisma.saving.findMany({ where: { pursuitId: pursuit.id }, orderBy: { createdAt: "asc" } }),
      ])
    : [[], [], []];
  const pendingVotes = choices.filter((c) => c.status === "VOTING" && !c.votes.some((v) => v.userId === session.user!.id)).map((c) => c.id);
  const euros = (cents: number) => `${(cents / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 })} €`;

  const content: Record<string, React.ReactNode> = {};
  const summaries: Record<string, string> = {};
  const extras: Record<string, React.ReactNode> = {};
  for (const b of blocks) {
    if (b.type === "options") {
      const items = choices.filter((c) => c.blockId === b.id);
      content[b.id] = (
        <OptionsBlock
          pursuitId={pursuit.id}
          blockId={b.id}
          me={session.user.id}
          people={people}
          columns={optionColumns(b.columns)}
          items={items.map((c) => ({ id: c.id, title: c.title, url: c.url, status: c.status as "IDEA" | "VOTING" | "CHOSEN", price: c.price, rating: c.rating, date: c.date, note: c.note, voters: c.votes.map((v) => v.userId) }))}
        />
      );
      const chosen = items.filter((c) => c.status === "CHOSEN");
      const voting = items.filter((c) => c.status === "VOTING").length;
      summaries[b.id] = chosen.length
        ? `${t("Elegido")}${chosen[0].price !== null ? ` · ${euros(chosen.reduce((sum, c) => sum + (c.price ?? 0), 0))}` : ""}`
        : items.length
          ? `${items.length === 1 ? t("1 opción") : t("{0} opciones", { 0: items.length })}${voting ? ` · ${t("{0} en votación", { 0: voting })}` : ""}`
          : "";
      continue;
    }
    if (b.type === "expenses") {
      const mine = expenses.filter((e) => e.blockId === b.id);
      const debts = settle(mine, people.map((p) => p.id));
      content[b.id] = <ExpensesBlock pursuitId={pursuit.id} blockId={b.id} me={session.user.id} people={people} debts={debts} items={mine.map((e) => ({ id: e.id, label: e.label, amount: e.amount, paidById: e.paidById }))} />;
      const total = mine.reduce((t, e) => t + e.amount, 0);
      summaries[b.id] = total ? t("{0} en total", { 0: euros(total) }) : "";
      continue;
    }
    if (b.type === "dates") {
      const mine = dateOptions.filter((d) => d.blockId === b.id);
      const best = bestDay(mine.map((d) => ({ day: d.day, votes: d.votes.length })));
      content[b.id] = <DatesBlock pursuitId={pursuit.id} blockId={b.id} me={session.user.id} people={people} best={best} items={mine.map((d) => ({ id: d.id, day: d.day, voters: d.votes.map((v) => v.userId) }))} />;
      summaries[b.id] = best ? `Mejor: ${new Date(`${best}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" })}` : "";
      continue;
    }
    if (b.type === "savings") {
      const mine = savings.filter((x) => x.blockId === b.id);
      content[b.id] = <SavingsBlock pursuitId={pursuit.id} blockId={b.id} goal={b.goal ?? null} people={people} items={mine.map((x) => ({ id: x.id, amount: x.amount, userId: x.userId, createdAt: x.createdAt.toISOString() }))} />;
      const total = mine.reduce((t, x) => t + x.amount, 0);
      summaries[b.id] = b.goal ? `${Math.min(100, Math.round((total / b.goal) * 100))} %` : "";
      continue;
    }
    if (b.type === "budget") {
      const n = b.people ?? people.length;
      const chosen = blocks
        .filter((o) => o.type === "options")
        .map((o) => {
          const picked = choices.filter((c) => c.blockId === o.id && c.status === "CHOSEN");
          return {
            label: o.title ?? "Opciones",
            what: picked.map((c) => c.title).join(", "),
            cents: picked.length ? picked.reduce((t, c) => t + (c.price ?? 0), 0) : null,
          };
        });
      content[b.id] = (
        <BudgetBlock
          pursuitId={pursuit.id}
          blockId={b.id}
          people={n}
          chosen={chosen}
          lines={budgetLines.filter((l) => l.blockId === b.id).map((l) => ({ id: l.id, label: l.label, unit: l.unit, days: l.days, perPerson: l.perPerson }))}
        />
      );
      extras[b.id] = <PeopleCount pursuitId={pursuit.id} blockId={b.id} people={n} />;
      continue;
    }
    if (b.type === "pages")
      content[b.id] = (
        <PagesBoard
          pursuitId={pursuit.id}
          units={pursuit.contentSections.map((u) => ({ id: u.id, name: u.name, classroomUnit: u.classroomUnit }))}
          cardStats={unitCardStats(cardUnits)}
          cards={pageCards}
          classroomCourseId={pursuit.classroomEnabled ? pursuit.classroomCourseId : null}
          groupLabel={groupLabel}
          view={b.view ?? (grouped ? "board" : "list")}
          study={study}
        />
      );
    else if (b.type === "map") {
      // Units with notes from before maps made themselves get theirs now.
      if (study) after(() => backfillMaps(session.user.id, pursuit.id).catch(() => {}));
      content[b.id] = (
        <div className="flex flex-col gap-3">
          <KnowledgeMap clusters={await folderMap(pursuit.id, color)} perRow={3} empty={t("El mapa de cada unidad se crea solo cuando guardas apuntes.")} />
        </div>
      );
    } else if (b.type === "project") {
      content[b.id] = project && (
        <TaskBoard tasks={project.tasks} projects={[{ id: project.id, title: project.title, cover: project.cover }]} today={dayOf(new Date())} view={b.view === "list" ? "list" : "board"} />
      );
      if (project?.tasks.length) summaries[b.id] = t("{0} de {1} hechas", { 0: project.tasks.filter((t) => t.status === "DONE").length, 1: project.tasks.length });
    } else if (b.type === "review") content[b.id] = <ReviewToday pursuitId={pursuit.id} />;
    else if (b.type === "ask") content[b.id] = <AskPursuit pursuitId={pursuit.id} />;
    else if (b.type === "challenges") content[b.id] = <ChallengeCards pursuitId={pursuit.id} items={challenges} />;
    else if (b.type === "deadlines")
      content[b.id] = <UpcomingDeadlines pursuitId={pursuit.id} hasCourse={pursuit.classroomEnabled && !!pursuit.classroomCourseId} />;
    else if (b.type === "tasks")
      content[b.id] = (
        <ProjectsBoard
          pursuitId={pursuit.id}
          projects={pursuit.projects.map((p) => ({
            id: p.id,
            title: p.title,
            dueDate: p.dueDate ? p.dueDate.toISOString() : null,
            totalCards: p.cards.length,
            doneCards: p.cards.filter((c) => c.status === "DONE").length,
          }))}
        />
      );
  }

  for (const [k, v] of Object.entries(content)) content[k] = <Fragment key={k}>{v}</Fragment>;

  const props = [
    pursuit.classroomEnabled && pursuit.classroomCourseName ? ["Classroom", pursuit.classroomCourseName] : null,
    grouped ? [t("Agrupado por"), t(groupLabel)] : null,
  ].filter((x): x is string[] => !!x);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-5 px-6 py-8 sm:px-12 lg:py-10">
      <nav className="flex items-center justify-between gap-4 text-sm text-ink-faint" aria-label={t("Ruta")}>
        <span className="flex items-center gap-1.5">
          <Link href={backHref} className="hover:text-ink hover:underline">
            {backLabel}
          </Link>
          <span>/</span>
          <span className="text-ink-muted">{pursuit.title}</span>
        </span>
        <span className="flex items-center gap-1">
          <a href={`/api/pursuits/${pursuit.id}/export`} title={t("Exportar")} aria-label={t("Exportar")} className="rounded p-1.5 hover:bg-chip hover:text-ink">
            <ArrowDown size={16} className="block" />
          </a>
          {!isOwner && <LeaveButton pursuitId={pursuit.id} />}
        </span>
      </nav>

      <header className="flex flex-wrap items-center gap-4">
        <Folder cover={cover} width={64} />
        <PursuitTitle pursuitId={pursuit.id} title={pursuit.title} className="min-w-0 flex-1 text-[2.1rem] leading-tight font-bold tracking-tight" />
        <span className="flex items-center gap-2">
          {study && (
            <Link href={`/review?mode=flash&pursuit=${pursuit.id}`} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">
              {t("▶ Repasar")}
            </Link>
          )}
          {hasChoices && (
            <>
              <Faces people={people} size={26} />
              <Link href={`${here}?edit=1#compartir`} className="flex items-center gap-1.5 rounded-md bg-chip px-3 py-1.5 text-sm text-ink-muted hover:text-ink">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 13v6.5h14V13" />
                </svg>
                {t("Compartir")}
              </Link>
            </>
          )}
          <Link href={editing ? here : `${here}?edit=1`} className={`rounded-md px-3 py-1.5 text-sm ${editing ? "bg-ink font-medium text-white" : "text-ink-faint hover:bg-chip hover:text-ink"}`}>
            {editing ? t("Listo") : t("Editar")}
          </Link>
        </span>
      </header>

      {project && <ProjectInfo project={project} today={dayOf(new Date())} />}

      <VotesBanner pending={pendingVotes} />

      {props.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {props.map(([k, v]) => (
            <span key={k}>
              <span className="mr-2 text-ink-faint">{k}</span>
              {v}
            </span>
          ))}
        </div>
      )}

      {(classroomConnected || classroomError) && (
        <p className={`rounded-md px-4 py-3 text-sm ${classroomError ? "bg-crimson-soft" : "bg-forest-soft"}`}>
          {classroomError ? (t(CLASSROOM_ERROR_COPY[classroomError] ?? "") || t("Algo ha fallado. Inténtalo de nuevo.")) : t("Conectado a Google Classroom.")}
        </p>
      )}

      {editing && (
        <FolderSettings pursuitId={pursuit.id} cover={cover} groupLabel={grouped ? groupLabel : null} title={pursuit.title} canDelete={isOwner}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            {/* Quick note: a sticky note, so it doesn't get lost among the settings. */}
            <div className="flex flex-col gap-2 self-start rounded-lg bg-[#fdf3c4] p-4 shadow-[0_1px_2px_rgba(0,0,0,.06),0_6px_14px_-8px_rgba(120,90,10,.35)]">
              <span className="text-xs font-semibold tracking-wide text-[#8a6d1f] uppercase">{t("Nota rápida")}</span>
              <StatusNote pursuitId={pursuit.id} initialNote={pursuit.statusNote} />
            </div>
            <div className="flex flex-col gap-4">
              <div id="compartir" className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-white p-4">
                <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("Compartido con")}</span>
                <div className="flex items-center gap-2.5 text-sm">
                  <Faces people={people.slice(0, 1)} size={28} />
                  <span className="text-ink">{pursuit.owner.name ?? pursuit.owner.email}</span>
                  <span className="flex-1" />
                  <span className="text-xs text-ink-faint">{t("Propietaria")}</span>
                </div>
                {pursuit.members.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2.5 text-sm">
                    <Faces people={people.slice(i + 1, i + 2)} size={28} />
                    {isOwner ? (
                      <span className="flex-1">
                        <MemberRow pursuitId={pursuit.id} memberId={m.id} name={m.user.name ?? m.user.email} role={m.role} />
                      </span>
                    ) : (
                      <>
                        <span className="flex-1 text-ink">{m.user.name ?? m.user.email}</span>
                        <span className="text-xs text-ink-faint">{m.role === "VIEWER" ? t("Lee") : t("Edita")}</span>
                      </>
                    )}
                  </div>
                ))}
                {isOwner && <MemberForm pursuitId={pursuit.id} />}
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-white p-4">
                <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("Etiquetas")}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {pursuit.pursuitTags.map((t) => (
                    <span key={t.id} className="flex items-center gap-1 rounded-full bg-chip px-3 py-1 text-sm text-ink">
                      <span className="text-ink-faint">#</span>
                      {t.name}
                      <DeleteButton action={removePursuitTag.bind(null, pursuit.id, t.id)} className="ml-0.5 text-ink-faint hover:text-red-500">
                        ×
                      </DeleteButton>
                    </span>
                  ))}
                  <TagForm pursuitId={pursuit.id} />
                </div>
              </div>
            </div>
          </div>
          {pursuit.classroomEnabled ? (
            <div className="flex flex-col gap-1.5">
              <ClassroomImport
                pursuitId={pursuit.id}
                connected={!!classroomConnection}
                linkedCourseId={pursuit.classroomCourseId}
                linkedElsewhere={Object.fromEntries(otherLinked.filter((o) => o.classroomCourseId).map((o) => [o.classroomCourseId!, o.title]))}
              />
              <form action={setClassroomEnabled.bind(null, pursuit.id, false)}>
                <button type="submit" className="self-start text-xs text-ink-faint hover:text-red-500">
                  {t("Desactivar Google Classroom en esta asignatura")}
                </button>
              </form>
            </div>
          ) : (
            <form action={setClassroomEnabled.bind(null, pursuit.id, true)}>
              <button type="submit" className="rounded-md border border-border-subtle px-3 py-1.5 text-sm text-ink-muted hover:border-ink hover:text-ink">
                {t("+ Vincular Google Classroom")}
              </button>
            </form>
          )}
        </FolderSettings>
      )}

      <FolderBlocks key={blocks.map((b) => `${b.id}${b.view ?? ""}`).join()} pursuitId={pursuit.id} blocks={blocks} study={study} grouped={grouped} content={content} summaries={summaries} extras={extras} editing={editing} />
    </div>
  );
}

// Cards and due cards per unit ("none" = No unit), keyed like the board.
function unitCardStats(cards: { dueDate: Date; note: { sectionId: string | null } | null }[]) {
  const now = Date.now();
  const out: Record<string, { cards: number; due: number }> = {};
  for (const c of cards) {
    const key = c.note?.sectionId ?? "none";
    const s = (out[key] ??= { cards: 0, due: 0 });
    s.cards++;
    if (c.dueDate.getTime() <= now) s.due++;
  }
  return out;
}
