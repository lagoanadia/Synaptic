import { ArrowDown } from "@/app/icons";
import Link from "next/link";
import { Fragment } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { removePursuitTag, setClassroomEnabled } from "./actions";
import { PursuitMeta } from "./PursuitMeta";
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
import { ChallengeCards, ReviewToday } from "./FolderBlockViews";

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
  const { id } = await params;
  const { tab, classroomConnected, classroomError, edit } = await searchParams;
  // Old tab links: flashcards now live in the review session.
  if (tab === "cards") redirect(`/review?pursuit=${id}`);
  const editing = edit === "1";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const [pursuit, sections, distinctTypes, classroomConnection, otherLinked, cardUnits, challenges] =
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
          owner: { select: { id: true, name: true, email: true, image: true } },
          members: {
            orderBy: { invitedAt: "asc" },
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
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
      prisma.section.findMany({
        where: { userId: session.user.id },
        orderBy: { name: "asc" },
      }),
      prisma.pursuit.findMany({
        where: { ownerId: session.user.id, type: { not: null } },
        select: { type: true },
        distinct: ["type"],
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
    pursuit.owner.id !== session.user.id ? "Compartido" : (pursuit.section?.name ?? "Sin clasificar");

  // One card per page: the raw dump plus the note organized from it (a
  // note made from several dumps stays with the first). Notes whose
  // dumps are gone get a card of their own.
  const noteForDump = new Map<string, (typeof pursuit.notes)[number]>();
  for (const n of pursuit.notes) {
    const first = n.sourceDumps[0];
    if (first && !noteForDump.has(first.id)) noteForDump.set(first.id, n);
  }
  const filesFor = (dumpId: string) => pursuit.attachments.filter((a) => a.dumpId === dumpId).length;
  const shortDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
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

  const content: Record<string, React.ReactNode> = {};
  for (const b of blocks) {
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
          <KnowledgeMap clusters={await folderMap(pursuit.id, color)} perRow={3} empty="El mapa de cada unidad se crea solo cuando guardas apuntes." />
        </div>
      );
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
    grouped ? ["Agrupado por", groupLabel] : null,
    pursuit.members.length > 0 ? ["Compartida con", String(pursuit.members.length)] : null,
  ].filter((x): x is string[] => !!x);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-5 px-6 py-8 sm:px-12 lg:py-10">
      <nav className="flex items-center justify-between gap-4 text-sm text-ink-faint" aria-label="Ruta">
        <span className="flex items-center gap-1.5">
          <Link href={backHref} className="hover:text-ink hover:underline">
            {backLabel}
          </Link>
          <span>/</span>
          <span className="text-ink-muted">{pursuit.title}</span>
        </span>
        <span className="flex items-center gap-1">
          <a href={`/api/pursuits/${pursuit.id}/export`} title="Exportar" aria-label="Exportar" className="rounded p-1.5 hover:bg-chip hover:text-ink">
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
              ▶ Repasar
            </Link>
          )}
          <Link href={editing ? here : `${here}?edit=1`} className={`rounded-md px-3 py-1.5 text-sm ${editing ? "bg-ink font-medium text-white" : "text-ink-faint hover:bg-chip hover:text-ink"}`}>
            {editing ? "Listo" : "Editar"}
          </Link>
        </span>
      </header>

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
          {classroomError ? (CLASSROOM_ERROR_COPY[classroomError] ?? "Algo ha fallado. Inténtalo de nuevo.") : "Conectado a Google Classroom."}
        </p>
      )}

      {editing && (
        <FolderSettings pursuitId={pursuit.id} cover={cover} groupLabel={grouped ? groupLabel : null}>
          <StatusNote pursuitId={pursuit.id} initialNote={pursuit.statusNote} />
          <PursuitMeta
            pursuitId={pursuit.id}
            type={pursuit.type}
            status={pursuit.status}
            sectionName={pursuit.section?.name ?? null}
            availableTypes={distinctTypes.map((p) => p.type).filter((t) => t !== null)}
            availableSections={sections.map((s) => s.name)}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {pursuit.pursuitTags.map((t) => (
              <span key={t.id} className="flex items-center gap-1 rounded bg-chip px-2 py-0.5 text-xs text-ink-muted">
                {t.name}
                <DeleteButton action={removePursuitTag.bind(null, pursuit.id, t.id)} className="text-ink-faint hover:text-red-500">
                  ×
                </DeleteButton>
              </span>
            ))}
            <TagForm pursuitId={pursuit.id} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-faint">Compartido con</span>
            <span className="text-xs text-ink-muted">{pursuit.owner.name ?? pursuit.owner.email} (propietaria)</span>
            {pursuit.members.map((m) =>
              isOwner ? (
                <MemberRow key={m.id} pursuitId={pursuit.id} memberId={m.id} name={m.user.name ?? m.user.email} role={m.role} />
              ) : (
                <span key={m.id} className="text-xs text-ink-muted">
                  · {m.user.name ?? m.user.email} ({m.role.toLowerCase()})
                </span>
              ),
            )}
            {isOwner && <MemberForm pursuitId={pursuit.id} />}
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
                  Desactivar Google Classroom en esta asignatura
                </button>
              </form>
            </div>
          ) : (
            <form action={setClassroomEnabled.bind(null, pursuit.id, true)}>
              <button type="submit" className="rounded-md border border-border-subtle px-3 py-1.5 text-sm text-ink-muted hover:border-ink hover:text-ink">
                + Vincular Google Classroom
              </button>
            </form>
          )}
        </FolderSettings>
      )}

      <FolderBlocks key={blocks.map((b) => `${b.id}${b.view ?? ""}`).join()} pursuitId={pursuit.id} blocks={blocks} study={study} grouped={grouped} content={content} editing={editing} />
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
