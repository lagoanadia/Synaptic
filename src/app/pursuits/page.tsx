import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Onboarding } from "../onboarding/Onboarding";
import { WeekStrip } from "@/app/calendar/WeekStrip";
import { calendarItems } from "@/lib/calendarData";
import { dayKey, weekOf } from "@/lib/calendar";
import { KnowledgeMap } from "../KnowledgeMap";
import { SHARED, UNSORTED, accessiblePursuits } from "@/lib/reviewData";
import { homeBlocks } from "@/lib/blocks";
import { notebookCover } from "@/lib/covers";
import { folderItems, notebookMap, recentPages } from "@/lib/blockData";
import { Greeting } from "./Greeting";
import { SampleNote } from "./SampleNote";
import { NotebookShelf, type ShelfItem } from "./NotebookShelf";
import { HomeBlocks } from "./HomeBlocks";
import { FolderRow, RecentList } from "./BlockViews";

// Home: your notebooks, then the blocks you chose (folders of a notebook,
// its map, recent pages). Editable like a Notion page.
export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const [sections, viewer, pursuitBuckets] = await Promise.all([
    prisma.section.findMany({ where: { userId }, orderBy: { order: "asc" }, select: { id: true, name: true, cover: true, study: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { onboardedAt: true, homeBlocks: true, sampleContent: true } }),
    prisma.pursuit.findMany({ where: accessiblePursuits(userId), select: { ownerId: true, sectionId: true } }),
  ]);

  // First visit: quick questions instead of an empty screen.
  if (viewer.onboardedAt === null && pursuitBuckets.length === 0) {
    return <Onboarding name={session.user.name ?? null} />;
  }

  const shelf: ShelfItem[] = sections.map((s) => ({ id: s.id, name: s.name, cover: notebookCover(s.id, s.cover), href: `/pursuits/s/${s.id}`, movable: true }));
  if (pursuitBuckets.some((p) => p.ownerId === userId && !p.sectionId))
    shelf.push({ id: UNSORTED, name: "Sin clasificar", cover: "marble", href: `/pursuits/s/${UNSORTED}`, movable: false });
  if (pursuitBuckets.some((p) => p.ownerId !== userId))
    shelf.push({ id: SHARED, name: "Compartido", cover: "ocean", href: `/pursuits/s/${SHARED}`, movable: false });

  const sample = viewer.sampleContent as { topic: string; flashcards?: string[] } | null;
  const blocks = homeBlocks(viewer.homeBlocks, sections);
  const studyOf = new Map(sections.map((s) => [s.id, s.study]));
  const entries = await Promise.all(
    blocks.map(async (b) => {
      if (b.type === "week") {
        const today = dayKey(new Date());
        const days = weekOf(today);
        const { items } = await calendarItems(userId, days[0], days[6]);
        return [b.id, <WeekStrip key={b.id} days={days} today={today} items={items} />] as const;
      }
      if (!b.sectionId) return [b.id, <p key={b.id} className="text-sm text-ink-faint">Elige una libreta.</p>] as const;
      if (b.type === "folders") return [b.id, <FolderRow key={b.id} items={await folderItems(userId, b.sectionId, studyOf.get(b.sectionId) ?? true)} />] as const;
      if (b.type === "map")
        return [b.id, <KnowledgeMap key={b.id} clusters={await notebookMap(userId, b.sectionId)} empty="Crea un mapa desde una asignatura y aparecerá aquí." />] as const;
      return [b.id, <RecentList key={b.id} pages={await recentPages(userId, b.sectionId)} />] as const;
    }),
  );

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-10 px-6 py-10 sm:px-12 lg:py-14">
      <Greeting name={session.user.name ?? null} />
      {sample && <SampleNote topic={sample.topic} cards={sample.flashcards?.length ?? 0} />}
      <NotebookShelf items={shelf} />
      <HomeBlocks
        blocks={blocks}
        notebooks={sections.map((s) => ({ id: s.id, name: s.name, cover: notebookCover(s.id, s.cover) }))}
        content={Object.fromEntries(entries)}
      />
    </div>
  );
}
