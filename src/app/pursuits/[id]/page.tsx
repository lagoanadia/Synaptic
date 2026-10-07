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
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { collaboratorOrder, colorIndexById } from "@/lib/authorColor";

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
  searchParams: Promise<{ tab?: string; classroomConnected?: string; classroomError?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, classroomConnected, classroomError } = await searchParams;
  const tab =
    rawTab === "organized" ||
    rawTab === "files" ||
    rawTab === "ask" ||
    rawTab === "cards" ||
    rawTab === "timeline"
      ? rawTab
      : "dump";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const [pursuit, sections, distinctTypes, dueFlashcards, upcomingFlashcardCount, classroomConnection] =
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
    ]);

  if (!pursuit) {
    notFound();
  }

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
    `pb-2 text-sm font-semibold border-b-2 ${
      tab === name
        ? `${TAB_ACCENT[name] ?? "border-accent"} text-ink`
        : "border-transparent text-ink-faint"
    }`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-9">
      <div className="flex items-center justify-between">
        <Link
          href="/pursuits"
          className="text-sm text-ink-muted hover:underline"
        >
          ← Exit
        </Link>
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
          <span className="text-xs text-ink-faint">Focus mode</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <PursuitTitle pursuitId={pursuit.id} title={pursuit.title} />
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

      <SearchBar pursuitId={pursuit.id} />

      <UpcomingDeadlines
        pursuitId={pursuit.id}
        hasCourse={pursuit.classroomEnabled && !!pursuit.classroomCourseId}
      />

      <div className="flex gap-7 border-b border-border-subtle">
        <Link href={`/pursuits/${pursuit.id}?tab=dump`} className={tabClass("dump")}>
          Brain Dump
        </Link>
        <Link
          href={`/pursuits/${pursuit.id}?tab=organized`}
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
      </div>

      {tab === "dump" && (
        <DumpControls
          pursuitId={pursuit.id}
          showAuthors={showAuthors}
          sections={pursuit.contentSections.map((s) => ({ id: s.id, name: s.name }))}
          dumps={pursuit.brainDumps.map((d) => ({
            id: d.id,
            content: d.content,
            images: d.images,
            processed: d.processed,
            createdAt: d.createdAt.toISOString(),
            sectionId: d.sectionId,
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
          sections={pursuit.contentSections.map((s) => ({ id: s.id, name: s.name }))}
          notes={pursuit.notes.map((n) => ({
            id: n.id,
            content: n.content,
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString(),
            tags: n.tags,
            sourceDumps: n.sourceDumps,
            sectionId: n.sectionId,
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
    </div>
  );
}
