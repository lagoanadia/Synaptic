import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SHARED, UNSORTED, pursuitWhere } from "@/lib/reviewData";
import { folderColor, folderCover, notebookCover, sheetsFor } from "@/lib/covers";
import { notebookMap, recentPages, type FolderItem } from "@/lib/blockData";
import { dotState } from "@/lib/knowledgeMap";
import { KnowledgeMap } from "@/app/KnowledgeMap";
import { FolderRow, RecentList } from "../../BlockViews";
import { NotebookHeader } from "./NotebookHeader";
import { NewFolder } from "./NewFolder";
import { notebookProjects } from "@/lib/projectData";
import { dayOf } from "@/lib/projects";
import { ProjectGrid } from "@/app/projects/ProjectGrid";
import { TaskBoard } from "@/app/projects/TaskBoard";
import { ProjectTimeline } from "@/app/projects/ProjectTimeline";

// A notebook: its folders, then — with study tools — its map and this
// week's pages; without — open tasks and recent pages.
export default async function NotebookPage({ params }: { params: Promise<{ sectionId: string }> }) {
  const { sectionId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const isVirtual = sectionId === UNSORTED || sectionId === SHARED;
  const section = isVirtual ? null : await prisma.section.findFirst({ where: { id: sectionId, userId } });
  if (!isVirtual && !section) notFound();
  const name = section?.name ?? (sectionId === SHARED ? "Compartido" : "Sin clasificar");
  const study = section?.study ?? true;
  // A "General" notebook: free folders, each with its own blocks.
  const general = section?.kind === "general";
  const now = new Date();

  const pursuits = await prisma.pursuit.findMany({
    where: pursuitWhere(userId, { kind: "section", sectionId }),
    orderBy: { lastTouchedAt: "desc" },
    select: {
      id: true,
      title: true,
      cover: true,
      _count: { select: { flashcards: { where: { dueDate: { lte: now } } } } },
      conceptMaps: { select: { concepts: { select: { status: true, statusAt: true } } } },
      projects: { select: { id: true, cards: { where: { status: { not: "DONE" } }, select: { id: true, title: true, status: true } }, dueDate: true } },
    },
  });
  const folders: FolderItem[] = pursuits.map((p) => {
    const left = p.conceptMaps.flatMap((m) => m.concepts).filter((c) => dotState(c) !== "known").length;
    const tasks = p.projects.reduce((n, pr) => n + pr.cards.length, 0);
    return { id: p.id, title: p.title, cover: folderCover(p.id, p.cover), sheets: sheetsFor(study ? p._count.flashcards + left : tasks), href: `/pursuits/${p.id}` };
  });

  const [map, recent, projects] = await Promise.all([
    study && section ? notebookMap(userId, section.id) : Promise.resolve([]),
    section ? recentPages(userId, section.id, 8) : Promise.resolve([]),
    !study && section ? notebookProjects(userId, section.id) : Promise.resolve([]),
  ]);
  const today = dayOf(now);
  const openTasks = study
    ? []
    : pursuits.flatMap((p) =>
        p.projects.flatMap((pr) =>
          pr.cards.map((c) => ({ ...c, pursuitId: p.id, projectId: pr.id, folder: p.title, color: folderColor(p.id, p.cover), due: pr.dueDate })),
        ),
      );

  const sectionHeader = (title: string) => <h2 className="border-b border-border-subtle pb-2 text-sm font-semibold">{title}</h2>;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-10 px-6 py-8 sm:px-12 lg:py-12">
      <div className="flex flex-col gap-6">
        <nav className="text-sm text-ink-faint">
          <Link href="/pursuits" className="hover:text-ink hover:underline">
            Inicio
          </Link>{" "}
          / <span className="text-ink-muted">{name}</span>
        </nav>
        <NotebookHeader id={sectionId} name={name} cover={notebookCover(sectionId, section?.cover)} study={study} kind={(section?.kind as "study" | "projects" | "general" | null) ?? null} editable={!isVirtual} />
      </div>

      {study || !section || general ? (
        <section className="flex flex-col gap-3">
          {sectionHeader(study ? "Asignaturas" : "Carpetas")}
          <FolderRow items={folders} after={!isVirtual && <NewFolder sectionName={name} label={study ? "Nueva asignatura" : "Nueva carpeta"} template={study ? undefined : "blank"} />} />
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-[22px] font-bold">Proyectos</h2>
            <ProjectGrid projects={projects} today={today} after={<NewFolder sectionName={name} label="Nuevo proyecto" template="project" fill />} />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-[22px] font-bold">Tareas</h2>
            <TaskBoard
              tasks={projects.flatMap((p) => p.tasks)}
              projects={projects.filter((p) => !p.finished || p.tasks.some((t) => t.status !== "DONE")).map((p) => ({ id: p.id, title: p.title, cover: p.cover }))}
              today={today}
            />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-[22px] font-bold">Calendario</h2>
            <ProjectTimeline projects={projects} today={today} />
          </section>
        </>
      )}

      {study && map.length > 0 && (
        <section className="flex flex-col gap-3">
          {sectionHeader("Mapa")}
          <KnowledgeMap clusters={map} />
        </section>
      )}

      {openTasks.length > 0 && (
        <section className="flex flex-col gap-1">
          {sectionHeader("Tableros por entrega")}
          <ul>
            {openTasks.map((t) => (
              <li key={t.id}>
                <Link href={`/pursuits/${t.pursuitId}/projects/${t.projectId}`} className="flex items-center gap-3 border-b border-[#f1f1ef] px-1 py-2 text-sm hover:bg-[#fbfbfa]">
                  <span className={`size-3.5 rounded-[3px] border-[1.5px] ${t.status === "IN_PROGRESS" ? "border-amber bg-amber/20" : "border-[#c7c5c0]"}`} />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="size-2 rounded-full" style={{ background: t.color }} />
                  <span className="text-xs text-ink-faint">{t.folder}</span>
                  {t.due && <span className="w-14 text-right text-xs text-ink-faint">{t.due.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {section && (
        <section className="flex flex-col gap-1">
          {sectionHeader(study ? "Esta semana" : "Páginas recientes")}
          <RecentList pages={recent} />
        </section>
      )}
    </div>
  );
}
