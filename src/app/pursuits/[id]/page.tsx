import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addAttachment, removePursuitTag, setClassroomEnabled } from "./actions";
import { MergeControls } from "./MergeControls";
import { DumpControls } from "./DumpControls";
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
import { AttachmentList } from "./AttachmentList";
import { Logo } from "../../Logo";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { StatusNote } from "./StatusNote";
import { collaboratorOrder, colorIndexById } from "@/lib/authorColor";
import { completeOnboarding } from "../actions";
import { Tour } from "../../Tour";
import { ProjectsBoard } from "./ProjectsBoard";
import { TOUR_COPY, TOUR_UI, isLocale } from "@/lib/i18n";
import { GameTiles } from "../../review/GameTiles";
import { SectionGrid } from "./SectionGrid";
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
  const { tab: rawTab, section: sectionFilter, classroomConnected, classroomError } =
    await searchParams;
  const tab =
    rawTab === "dump" ||
    rawTab === "organized" ||
    rawTab === "files" ||
    rawTab === "ask" ||
    rawTab === "cards" ||
    rawTab === "timeline" ||
    rawTab === "projects"
      ? rawTab
      : "overview";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const [pursuit, sections, distinctTypes, dueFlashcards, upcomingFlashcardCount, classroomConnection, viewer] =
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
            include: { tags: true, sourceDumps: { select: { id: true } } },
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
      prisma.user.findUniqueOrThrow({
        where: { id: session.user.id },
        select: { onboardedAt: true, locale: true },
      }),
    ]);

  if (!pursuit) {
    notFound();
  }

  const locale = isLocale(viewer.locale) ? viewer.locale : "en";
  const tourCopy = TOUR_COPY[locale];

  // Only shown once a Pursuit actually has someone besides the owner —
  // no point coloring who-wrote-what when there's only ever been one
  // possible author.
  const showAuthors = pursuit.members.length > 0;
  const collaborators = collaboratorOrder(
    pursuit.owner,
    pursuit.members.map((m) => m.user),
  );
  const authorColorIndex = colorIndexById(collaborators);

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

  // ?section= narrows Brain Dump and Organized to one content section
  // (U1, U2…), so clicking a tile on the overview shows just that.
  const activeSection =
    sectionFilter === UNSORTED
      ? { id: UNSORTED, name: "Unsorted" }
      : (pursuit.contentSections.find((s) => s.id === sectionFilter) ?? null);
  const inActiveSection = (sectionId: string | null) =>
    !activeSection ||
    (activeSection.id === UNSORTED ? sectionId === null : sectionId === activeSection.id);
  const visibleSections = activeSection
    ? pursuit.contentSections.filter((s) => s.id === activeSection.id)
    : pursuit.contentSections;
  const sectionQuery = activeSection ? `&section=${activeSection.id}` : "";

  // Where "back" goes: the Section this subject lives in on the new home.
  const backHref =
    pursuit.owner.id !== session.user.id
      ? `/pursuits/s/${SHARED}`
      : `/pursuits/s/${pursuit.section?.id ?? UNSORTED}`;
  const backLabel =
    pursuit.owner.id !== session.user.id ? "Shared" : (pursuit.section?.name ?? "Unsorted");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-9 lg:px-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo href="/pursuits" withWordmark={false} size={20} />
          <Link href={backHref} className="text-sm text-ink-muted hover:underline">
            ← {backLabel}
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`/api/pursuits/${pursuit.id}/export`}
            className="text-sm text-ink-muted hover:underline"
          >
            ↓ Export
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
            {[pursuit.type, pursuit.status.toLowerCase(), pursuit.members.length > 0 ? `shared with ${pursuit.members.length}` : null]
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
          </div>
        </details>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div data-tour="status-note">
          <StatusNote pursuitId={pursuit.id} initialNote={pursuit.statusNote} />
        </div>
        <div data-tour="search-bar">
          <SearchBar pursuitId={pursuit.id} />
        </div>
      </div>

      <UpcomingDeadlines
        pursuitId={pursuit.id}
        hasCourse={pursuit.classroomEnabled && !!pursuit.classroomCourseId}
      />

      <div
        data-tour="tab-bar"
        className="flex gap-7 overflow-x-auto border-b border-border-subtle"
      >
        <Link href={`/pursuits/${pursuit.id}`} className={tabClass("overview")}>
          Sections
        </Link>
        <Link href={`/pursuits/${pursuit.id}?tab=dump${sectionQuery}`} className={tabClass("dump")}>
          Brain Dump
        </Link>
        <Link
          href={`/pursuits/${pursuit.id}?tab=organized${sectionQuery}`}
          className={tabClass("organized")}
        >
          Organized
        </Link>
        <Link href={`/pursuits/${pursuit.id}?tab=files`} className={tabClass("files")}>
          Files
        </Link>
        <Link href={`/pursuits/${pursuit.id}?tab=ask`} className={tabClass("ask")}>
          Ask
        </Link>
        <Link href={`/pursuits/${pursuit.id}?tab=cards`} className={tabClass("cards")}>
          Cards
        </Link>
        <Link href={`/pursuits/${pursuit.id}?tab=timeline`} className={tabClass("timeline")}>
          Timeline
        </Link>
        <Link href={`/pursuits/${pursuit.id}?tab=projects`} className={tabClass("projects")}>
          Projects
        </Link>
      </div>

      {activeSection && (tab === "dump" || tab === "organized") && (
        <div className="-mt-2 flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Showing</span>
          <span className="flex items-center gap-1.5 rounded-full bg-tile-sky px-3 py-1 text-xs font-semibold text-white">
            {activeSection.name}
            <Link
              href={`/pursuits/${pursuit.id}?tab=${tab}`}
              aria-label="Show all sections"
              className="hover:opacity-80"
            >
              ×
            </Link>
          </span>
        </div>
      )}

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
          <SectionGrid
            pursuitId={pursuit.id}
            tiles={[
              ...pursuit.contentSections.map((s) => ({
                id: s.id,
                name: s.name,
                pages: pursuit.brainDumps.filter((d) => d.sectionId === s.id).length,
                notes: pursuit.notes.filter((n) => n.sectionId === s.id).length,
              })),
              ...(pursuit.brainDumps.some((d) => d.sectionId === null) ||
              pursuit.notes.some((n) => n.sectionId === null)
                ? [
                    {
                      id: UNSORTED,
                      name: "Unsorted",
                      pages: pursuit.brainDumps.filter((d) => d.sectionId === null).length,
                      notes: pursuit.notes.filter((n) => n.sectionId === null).length,
                    },
                  ]
                : []),
            ]}
          />
          <div className="flex flex-col gap-6">
            <GameTiles
              scopeQuery={`pursuit=${pursuit.id}`}
              cardCount={dueFlashcards.length + upcomingFlashcardCount}
              dueCount={dueFlashcards.length}
              conceptCount={pursuit.notes.length}
            />
          </div>
        </div>
      )}

      {tab === "dump" && (
        <DumpControls
          pursuitId={pursuit.id}
          showAuthors={showAuthors}
          sections={visibleSections.map((s) => ({ id: s.id, name: s.name }))}
          dumps={pursuit.brainDumps.filter((d) => inActiveSection(d.sectionId)).map((d) => ({
            id: d.id,
            content: d.content,
            images: d.images,
            processed: d.processed,
            createdAt: d.createdAt.toISOString(),
            sectionId: d.sectionId,
            sectionOrder: d.sectionOrder,
            author: {
              name: d.author.name ?? d.author.email,
              image: d.author.image,
              colorIndex: authorColorIndex.get(d.author.id) ?? 0,
            },
          }))}
        />
      )}

      {tab === "organized" && (
        <MergeControls
          pursuitId={pursuit.id}
          sections={visibleSections.map((s) => ({ id: s.id, name: s.name }))}
          notes={pursuit.notes.filter((n) => inActiveSection(n.sectionId)).map((n) => ({
            id: n.id,
            content: n.content,
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString(),
            tags: n.tags,
            sourceDumps: n.sourceDumps,
            sectionId: n.sectionId,
            sectionOrder: n.sectionOrder,
          }))}
        />
      )}

      {tab === "ask" && <AskPursuit pursuitId={pursuit.id} />}

      {tab === "cards" && (
        <FlashcardReview
          pursuitId={pursuit.id}
          dueCards={dueFlashcards.map((c) => ({
            id: c.id,
            question: c.question,
            answer: c.answer,
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

      {tab === "files" && (
        <div className="flex flex-col gap-4">
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
          <form
            action={addAttachment.bind(null, pursuit.id)}
            className="flex gap-2"
          >
            <input
              type="text"
              name="name"
              placeholder="File name"
              required
              className="flex-1 rounded-md border border-border-subtle bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              name="url"
              placeholder="URL"
              required
              className="flex-1 rounded-md border border-border-subtle bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md border border-ink px-4 py-2 text-sm font-medium whitespace-nowrap hover:bg-chip"
            >
              + Add
            </button>
          </form>
          <AttachmentList
            pursuitId={pursuit.id}
            attachments={pursuit.attachments.map((a) => ({
              id: a.id,
              name: a.name,
              url: a.url,
            }))}
          />
        </div>
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

      {viewer.onboardedAt === null && tab === "overview" && (
        <Tour
          labels={TOUR_UI[locale]}
          steps={[
            {
              target: '[data-tour="tab-bar"]',
              title: tourCopy.detail.tabs.title,
              body: tourCopy.detail.tabs.body,
            },
            {
              target: '[data-tour="status-note"]',
              title: tourCopy.detail.statusNote.title,
              body: tourCopy.detail.statusNote.body,
            },
            {
              target: '[data-tour="search-bar"]',
              title: tourCopy.detail.searchBar.title,
              body: tourCopy.detail.searchBar.body,
            },
          ]}
          onFinish={completeOnboarding}
        />
      )}
    </div>
  );
}
