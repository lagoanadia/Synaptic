import { ArrowLeft, ArrowDown } from "@/app/icons";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { removePursuitTag, setClassroomEnabled } from "./actions";
import { PursuitMeta } from "./PursuitMeta";
import { TagForm } from "./TagForm";
import { MemberForm } from "./MemberForm";
import { MemberRow } from "./MemberRow";
import { LeaveButton } from "./LeaveButton";
import { SearchBar } from "./SearchBar";
import { AskPursuit } from "./AskPursuit";
import { PursuitTitle } from "./PursuitTitle";
import { FlashcardReview } from "./FlashcardReview";
import { Timeline } from "./Timeline";
import { DeleteButton } from "../DeleteButton";
import { ClassroomImport } from "./ClassroomImport";
import { Logo } from "../../Logo";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { StatusNote } from "./StatusNote";
import { ProjectsBoard } from "./ProjectsBoard";
import { PagesBoard, type PageCard } from "./PagesBoard";
import { autoTitle } from "@/lib/text";
import { conceptExcerpt } from "@/lib/review";
import { LearnTab } from "./learn/LearnTab";
import { UNSORTED, SHARED } from "@/lib/reviewData";

const CLASSROOM_ERROR_COPY: Record<string, string> = {
  denied: "Google Classroom connection canceled.",
  "connect-failed": "Couldn't connect to Google Classroom. Try again.",
  "no-refresh-token": "Google didn't grant lasting access — disconnect any prior access at myaccount.google.com/permissions and try again.",
};

export default async function PursuitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    section?: string;
    classroomConnected?: string;
    classroomError?: string;
  }>;
}) {
  const { id } = await params;
  const { tab: rawTab, classroomConnected, classroomError } =
    await searchParams;
  const tab =
    rawTab === "learn" ||
    rawTab === "ask" ||
    rawTab === "cards" ||
    rawTab === "timeline" ||
    rawTab === "projects"
      ? rawTab
      : // Pages is the landing tab (it replaced Sections, Brain Dump,
        // Organized and Files).
        "pages";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const [pursuit, sections, distinctTypes, dueFlashcards, upcomingFlashcardCount, classroomConnection, otherLinked, cardUnits] =
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
      prisma.flashcard.findMany({
        where: { pursuitId: id, dueDate: { lte: new Date() } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.flashcard.count({
        where: { pursuitId: id, dueDate: { gt: new Date() } },
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
    ]);

  if (!pursuit) {
    notFound();
  }



  // Each tab's active underline picks up a color from nadia-lagoa.vercel.app's
  // own project-card palette (Cards → cobalt, Ask → flame, everything else →
  // blue) instead of one flat accent for all six tabs.
  const TAB_ACCENT: Record<string, string> = {
    cards: "border-cobalt",
    ask: "border-flame",
  };
  const tabClass = (name: string) =>
    `pb-2 text-sm font-semibold border-b-2 whitespace-nowrap ${
      tab === name
        ? `${TAB_ACCENT[name] ?? "border-accent"} text-ink`
        : "border-transparent text-ink-faint hover:text-ink"
    }`;

  // Where "back" goes: the Section this subject lives in on the new home.
  const backHref =
    pursuit.owner.id !== session.user.id
      ? `/pursuits/s/${SHARED}`
      : `/pursuits/s/${pursuit.section?.id ?? UNSORTED}`;
  const backLabel =
    pursuit.owner.id !== session.user.id ? "Shared" : (pursuit.section?.name ?? "Unsorted");

  // One card per page: the raw dump plus the note organized from it (a
  // note made from several dumps stays with the first). Notes whose
  // dumps are gone get a card of their own.
  const noteForDump = new Map<string, (typeof pursuit.notes)[number]>();
  for (const n of pursuit.notes) {
    const first = n.sourceDumps[0];
    if (first && !noteForDump.has(first.id)) noteForDump.set(first.id, n);
  }
  const filesFor = (dumpId: string) => pursuit.attachments.filter((a) => a.dumpId === dumpId).length;
  const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-6 px-6 py-9 lg:px-14">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo href="/pursuits" withWordmark={false} size={20} />
          <Link href={backHref} className="text-sm text-ink-muted hover:underline">
            <ArrowLeft /> {backLabel}
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`/api/pursuits/${pursuit.id}/export`}
            className="text-sm text-ink-muted hover:underline"
          >
            <ArrowDown /> Export
          </a>
          {pursuit.owner.id !== session.user.id && (
            <LeaveButton pursuitId={pursuit.id} />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <PursuitTitle
          pursuitId={pursuit.id}
          title={pursuit.title}
          className="text-3xl font-extrabold text-tile-sky italic"
        />
        {/* Type, status, tags and sharing: useful, but not every visit —
            folded away so the page opens on the content itself. */}
        <details className="group text-sm">
          <summary className="cursor-pointer text-xs text-ink-faint select-none hover:text-ink">
            {[pursuit.type, pursuit.status.toLowerCase(), pursuit.members.length > 0 ? `shared with ${pursuit.members.length}` : null, pursuit.classroomEnabled && pursuit.classroomCourseName ? `Classroom: ${pursuit.classroomCourseName}` : null]
              .filter(Boolean)
              .join(" · ")}{" "}
            · details
          </summary>
          <div className="mt-3 flex flex-col gap-2">
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
                <span
                  key={t.id}
                  className="flex items-center gap-1 rounded bg-chip px-2 py-0.5 text-xs text-ink-muted"
                >
                  {t.name}
                  <DeleteButton
                    action={removePursuitTag.bind(null, pursuit.id, t.id)}
                    className="text-ink-faint hover:text-red-500"
                  >
                    ×
                  </DeleteButton>
                </span>
              ))}
              <TagForm pursuitId={pursuit.id} />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-ink-faint">Shared with</span>
              <span className="text-xs text-ink-muted">
                {pursuit.owner.name ?? pursuit.owner.email} (owner)
              </span>
              {pursuit.members.map((m) =>
                pursuit.owner.id === session.user.id ? (
                  <MemberRow
                    key={m.id}
                    pursuitId={pursuit.id}
                    memberId={m.id}
                    name={m.user.name ?? m.user.email}
                    role={m.role}
                  />
                ) : (
                  <span key={m.id} className="text-xs text-ink-muted">
                    · {m.user.name ?? m.user.email} ({m.role.toLowerCase()})
                  </span>
                ),
              )}
              {pursuit.owner.id === session.user.id && (
                <MemberForm pursuitId={pursuit.id} />
              )}
            </div>
            <div className="flex flex-col gap-2 pt-2">
            {classroomConnected && (
              <p className="rounded-xl bg-forest-soft px-4 py-3 text-sm text-ink">
                Connected to Google Classroom.
              </p>
            )}
            {classroomError && (
              <p className="rounded-xl bg-crimson-soft px-4 py-3 text-sm text-ink">
                {CLASSROOM_ERROR_COPY[classroomError] ?? "Something went wrong. Try again."}
              </p>
            )}
            {pursuit.classroomEnabled ? (
              <div className="flex flex-col gap-1.5">
                <ClassroomImport
                  pursuitId={pursuit.id}
                  connected={!!classroomConnection}
                  linkedCourseId={pursuit.classroomCourseId}
                  linkedElsewhere={Object.fromEntries(
                    otherLinked.filter((o) => o.classroomCourseId).map((o) => [o.classroomCourseId!, o.title]),
                  )}
                />
                <form action={setClassroomEnabled.bind(null, pursuit.id, false)}>
                  <button
                    type="submit"
                    className="self-start text-xs text-ink-faint hover:text-red-500"
                  >
                    Turn off Google Classroom for this Pursuit
                  </button>
                </form>
              </div>
            ) : (
              <form action={setClassroomEnabled.bind(null, pursuit.id, true)}>
                <button
                  type="submit"
                  className="self-start rounded-full border border-border-subtle bg-white px-4 py-2 text-sm text-ink-muted transition-colors hover:border-ink hover:text-ink"
                >
                  + This is a school subject — enable Google Classroom
                </button>
              </form>
            )}
            </div>
          </div>
        </details>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <StatusNote pursuitId={pursuit.id} initialNote={pursuit.statusNote} />
        </div>
        <div>
          <SearchBar pursuitId={pursuit.id} />
        </div>
      </div>

      <UpcomingDeadlines
        pursuitId={pursuit.id}
        hasCourse={pursuit.classroomEnabled && !!pursuit.classroomCourseId}
      />

      <nav className="flex gap-7 overflow-x-auto border-b border-border-subtle" aria-label="Subject">
        {(
          [
            ["pages", "Pages"],
            ["learn", "Learn"],
            ["cards", "Cards"],
            ["projects", "Projects"],
            ["ask", "Ask"],
            ["timeline", "Timeline"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/pursuits/${pursuit.id}${key === "pages" ? "" : `?tab=${key}`}`}
            className={tabClass(key)}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "pages" && (
        <PagesBoard
          pursuitId={pursuit.id}
          units={pursuit.contentSections.map((u) => ({ id: u.id, name: u.name, classroomUnit: u.classroomUnit }))}
          cardStats={unitCardStats(cardUnits)}
          cards={pageCards}
          classroomCourseId={pursuit.classroomEnabled ? pursuit.classroomCourseId : null}
        />
      )}




      {tab === "learn" && <LearnTab pursuitId={pursuit.id} hasNotes={pursuit.notes.length > 0} />}

      {tab === "ask" && <AskPursuit pursuitId={pursuit.id} />}

      {tab === "cards" && (
        <FlashcardReview
          learnHref={`/review?mode=learn&pursuit=${pursuit.id}`}
          dueCards={dueFlashcards.map((c) => ({
            id: c.id,
            question: c.question,
            answer: c.answer,
            pursuitId: pursuit.id,
          }))}
          upcomingCount={upcomingFlashcardCount}
        />
      )}

      {tab === "timeline" && (
        <Timeline
          pursuitId={pursuit.id}
          dumps={pursuit.brainDumps.map((d) => ({
            id: d.id,
            createdAt: d.createdAt,
            content: d.content,
          }))}
          notes={pursuit.notes.map((n) => ({
            id: n.id,
            createdAt: n.createdAt,
            content: n.content,
          }))}
        />
      )}


      {tab === "projects" && (
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
      )}

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
