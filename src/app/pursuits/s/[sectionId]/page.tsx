import { LOCALE } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SHARED, UNSORTED, pursuitWhere } from "@/lib/reviewData";
import { folderColor, folderCover, notebookCover, sheetsFor } from "@/lib/covers";
import { loosePages, notebookPaths, recentPages, type FolderItem } from "@/lib/blockData";
import { LoosePages } from "./NewLoosePage";
import { dotState } from "@/lib/knowledgeMap";
import { FolderRow, RecentList } from "../../BlockViews";
import { NotebookHeader } from "./NotebookHeader";
import { NewFolder } from "./NewFolder";
import { NotebookFolders } from "./NotebookFolders";
import { NotebookDeadlines } from "./NotebookDeadlines";
import { notebookDeadlines } from "@/lib/notebookDeadlines";
import { Suspense } from "react";
import { NotebookMap } from "./NotebookMap";
import { tidyUnitlessMaps } from "@/lib/autoMap";
import { notebookProjects } from "@/lib/projectData";
import { dayOf } from "@/lib/projects";
import { ProjectGrid } from "@/app/projects/ProjectGrid";
import { TaskBoard } from "@/app/projects/TaskBoard";
import { ProjectTimeline } from "@/app/projects/ProjectTimeline";
import { NotebookBlocks } from "./NotebookBlocks";
import { BUILTIN_BLOCKS, BUILTIN_LABEL, cleanNotebookBlocks, type BuiltinBlockType, type NotebookBlock } from "@/lib/blocks";
import { WeekStrip } from "@/app/calendar/WeekStrip";
import { calendarItems } from "@/lib/calendarData";
import { dayKey, weekOf } from "@/lib/calendar";

// A notebook: its folders, then — with study tools — its map and this
// week's pages; without — open tasks and recent pages.
export default async function NotebookPage({ params }: { params: Promise<{ sectionId: string }> }) {
  const locale = LOCALE[await getLang()];
  const t = await getT();
  const { sectionId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const isVirtual = sectionId === UNSORTED || sectionId === SHARED;
  const section = isVirtual ? null : await prisma.section.findFirst({ where: { id: sectionId, userId } });
  if (!isVirtual && !section) notFound();
  const name = section?.name ?? (sectionId === SHARED ? t("Compartido") : t("Sin clasificar"));
  const study = section?.study ?? true;
  // A "General" notebook: free folders, each with its own blocks.
  const general = section?.kind === "general";
  const now = new Date();

  const pursuits = await prisma.pursuit.findMany({
    where: { AND: [pursuitWhere(userId, { kind: "section", sectionId }), { loose: false }] },
    orderBy: { lastTouchedAt: "desc" },
    select: {
      id: true,
      title: true,
      cover: true,
      group: true,
      _count: { select: { flashcards: { where: { dueDate: { lte: now } } } } },
      conceptMaps: { select: { concepts: { select: { status: true, statusAt: true } } } },
      projects: { select: { id: true, cards: { where: { status: { not: "DONE" } }, select: { id: true, title: true, status: true } }, dueDate: true } },
    },
  });
  const folders: FolderItem[] = pursuits.map((p) => {
    const left = p.conceptMaps.flatMap((m) => m.concepts).filter((c) => dotState(c) !== "known").length;
    const tasks = p.projects.reduce((n, pr) => n + pr.cards.length, 0);
    return { id: p.id, title: p.title, cover: folderCover(p.id, p.cover), sheets: sheetsFor(study ? p._count.flashcards + left : tasks), href: `/pursuits/${p.id}`, group: p.group };
  });

  const mine = await prisma.userTemplate.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  const [map, recent, projects, loose] = await Promise.all([
    // Every concept in a unit before the map is drawn (see tidyUnitlessMaps).
    study && section ? Promise.all(pursuits.map((p) => tidyUnitlessMaps(p.id))).then(() => notebookPaths(userId, section.id)) : Promise.resolve([]),
    section && !study ? recentPages(userId, section.id, 8) : Promise.resolve([]),
    !study && section ? notebookProjects(userId, section.id) : Promise.resolve([]),
    section ? loosePages(userId, section.id) : Promise.resolve([]),
  ]);
  const today = dayOf(now);
  const openTasks = study
    ? []
    : pursuits.flatMap((p) =>
        p.projects.flatMap((pr) =>
          pr.cards.map((c) => ({ ...c, pursuitId: p.id, projectId: pr.id, folder: p.title, color: folderColor(p.id, p.cover), due: pr.dueDate })),
        ),
      );

  // The notebook's own blocks; week and recent are drawn here, the rest in the browser.
  // Every section of the page is a block. The built-in ones this kind of
  // notebook has, in their usual order; your saved order once you've moved
  // or removed one.
  const projectsKind = !study && !general;
  const builtins: BuiltinBlockType[] = study ? ["folders", "map"] : projectsKind ? ["folders", "tasks", "timeline", "boards"] : ["folders", "boards"];
  const defaults: NotebookBlock[] = [
    { id: "folders", type: "folders" },
    // Projects and Tasks side by side; the calendar below, full width.
    ...(projectsKind ? [{ id: "tasks", type: "tasks" as const, join: true }, { id: "timeline", type: "timeline" as const }] : []),
    ...(loose.length ? [{ id: "pages", type: "pages" as const }] : []),
    ...(study ? [{ id: "map", type: "map" as const }] : []),
    ...(openTasks.length ? [{ id: "boards", type: "boards" as const }] : []),
    ...(!study ? [{ id: "recent", type: "recent" as const }] : []),
  ];
  const saved = section ? cleanNotebookBlocks(section.blocks) : [];
  const customized = saved.some((b) => (BUILTIN_BLOCKS as readonly string[]).includes(b.type));
  const ownBlocks = (customized ? saved : [...defaults.filter((d) => !saved.some((x) => x.type === d.type)), ...saved]).filter(
    (b) => !(BUILTIN_BLOCKS as readonly string[]).includes(b.type) || builtins.includes(b.type as BuiltinBlockType),
  );
  const blockContent = Object.fromEntries(
    await Promise.all(
      ownBlocks
        .filter((b) => b.type === "week" || b.type === "recent" || b.type === "pages")
        .map(async (b) => {
          if (b.type === "pages") return [b.id, <LoosePages key={b.id} sectionId={section!.id} groups={section!.groups} pages={loose} bare />] as const;
          if (b.type === "week") {
            const days = weekOf(dayKey(now));
            const { items } = await calendarItems(userId, days[0], days[6]);
            return [b.id, <WeekStrip key={b.id} days={days} today={dayKey(now)} items={items} />] as const;
          }
          return [b.id, <RecentList key={b.id} pages={recent.length ? recent : await recentPages(userId, section!.id, 8)} />] as const;
        }),
    ),
  );

  const groupOf = Object.fromEntries(folders.map((f) => [f.id, f.group ?? null]));
  const sectionHeader = (title: string) => <h2 className="border-b border-border-subtle pb-2 text-sm font-semibold">{t(title)}</h2>;

  return (
    <div className={`mx-auto flex w-full max-w-[1560px] flex-1 flex-col gap-10 px-6 py-8 sm:px-12 lg:py-12`}>
      <div className="flex flex-col gap-6">
        <nav className="text-sm text-ink-faint">
          <Link href="/pursuits" className="hover:text-ink hover:underline">
            {t("Inicio")}
          </Link>{" "}
          / <span className="text-ink-muted">{name}</span>
        </nav>
        <NotebookHeader id={sectionId} name={name} cover={notebookCover(sectionId, section?.cover)} study={study} kind={(section?.kind as "study" | "projects" | "general" | null) ?? null} editable={!isVirtual} />
      </div>

      {!section ? (
        <section className="flex flex-col gap-3">
          {sectionHeader(t("Carpetas"))}
          <FolderRow items={folders} />
        </section>
      ) : (
        <NotebookBlocks
          sectionId={section.id}
          blocks={ownBlocks}
          addable={builtins.map((b) => ({ type: b, label: b === "folders" && study ? "Asignaturas" : b === "folders" && projectsKind ? "Proyectos" : BUILTIN_LABEL[b].label, hint: BUILTIN_LABEL[b].hint }))}
          content={{
            ...blockContent,
            folders: study ? (
              <NotebookFolders sectionId={section.id} sectionName={name} title={t("Asignaturas")} groups={section.groups} items={folders} newLabel={t("Nueva asignatura")} />
            ) : projectsKind ? (
              <section className="flex flex-col gap-3">
                <h2 className="text-[22px] font-bold">{t("Proyectos")}</h2>
                <ProjectGrid projects={projects} today={today} after={<NewFolder sectionName={name} label={t("Nuevo proyecto")} template="project" mine={mine} fill />} />
              </section>
            ) : (
              <section className="flex flex-col gap-3">
                {sectionHeader(t("Carpetas"))}
                <FolderRow items={folders} after={<NewFolder sectionName={name} label={t("Nueva carpeta")} template="blank" mine={mine} />} />
              </section>
            ),
            tasks: projectsKind && (
              <section className="flex flex-col gap-3">
                <h2 className="text-[22px] font-bold">{t("Tareas")}</h2>
                <TaskBoard
                  tasks={projects.flatMap((p) => p.tasks)}
                  projects={projects.filter((p) => !p.finished || p.tasks.some((t) => t.status !== "DONE")).map((p) => ({ id: p.id, title: p.title, cover: p.cover }))}
                  today={today}
                  sectionId={sectionId}
                />
              </section>
            ),
            timeline: projectsKind && (
              <section className="flex flex-col gap-3">
                <h2 className="text-[22px] font-bold">{t("Calendario")}</h2>
                <ProjectTimeline projects={projects} today={today} />
              </section>
            ),
            map: study && (
              <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-8">
                <div className="min-w-0 flex-1">{map.length > 0 && <NotebookMap paths={map} groupOf={groupOf} groups={section.groups} title={t("Mapa")} />}</div>
                <aside className="lg:sticky lg:top-6 lg:w-[380px] lg:shrink-0 empty:hidden">
                  <Suspense fallback={null}>
                    <DeadlinesPanel userId={userId} sectionId={section.id} groupOf={groupOf} groups={section.groups} />
                  </Suspense>
                </aside>
              </div>
            ),
            boards: (
              <section className="flex flex-col gap-1">
                {sectionHeader(t("Tableros por entrega"))}
                {openTasks.length === 0 ? (
                  <p className="py-2 text-[13px] text-ink-faint">{t("No hay tarjetas pendientes en ninguna entrega.")}</p>
                ) : (
                  <ul>
                    {openTasks.map((t) => (
                      <li key={t.id}>
                        <Link href={`/pursuits/${t.pursuitId}/projects/${t.projectId}`} className="flex items-center gap-3 border-b border-[#f1f1ef] px-1 py-2 text-sm hover:bg-[#fbfbfa]">
                          <span className={`size-3.5 rounded-[3px] border-[1.5px] ${t.status === "IN_PROGRESS" ? "border-amber bg-amber/20" : "border-[#c7c5c0]"}`} />
                          <span className="min-w-0 flex-1 truncate">{t.title}</span>
                          <span className="size-2 rounded-full" style={{ background: t.color }} />
                          <span className="text-xs text-ink-faint">{t.folder}</span>
                          {t.due && <span className="w-14 text-right text-xs text-ink-faint">{t.due.toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ),
          }}
        />
      )}
    </div>
  );
}

// Streams in after the rest of the page: Classroom can take a few seconds.
async function DeadlinesPanel({ userId, sectionId, groupOf, groups }: { userId: string; sectionId: string; groupOf: Record<string, string | null>; groups: string[] }) {
  const r = await notebookDeadlines(userId, sectionId).catch(() => ({ status: "error" as const, list: [] }));
  return <NotebookDeadlines list={r.list} status={r.status} groupOf={groupOf} groups={groups} side />;
}
