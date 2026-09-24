import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addAttachment, removePursuitTag } from "./actions";
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
import { DeleteButton } from "../DeleteButton";

export default async function PursuitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab =
    rawTab === "organized" || rawTab === "files" || rawTab === "ask" || rawTab === "cards"
      ? rawTab
      : "dump";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const [pursuit, sections, dueFlashcards, upcomingFlashcardCount] = await Promise.all([
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
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        brainDumps: { orderBy: { createdAt: "desc" } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { tags: true, sourceDumps: { select: { id: true } } },
        },
        attachments: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.section.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    }),
    prisma.flashcard.findMany({
      where: { pursuitId: id, dueDate: { lte: new Date() } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.flashcard.count({
      where: { pursuitId: id, dueDate: { gt: new Date() } },
    }),
  ]);

  if (!pursuit) {
    notFound();
  }

  const tabClass = (name: string) =>
    `pb-2 text-sm font-semibold border-b-2 ${
      tab === name
        ? "border-accent text-ink"
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
          customType={pursuit.customType}
          status={pursuit.status}
          sectionName={pursuit.section?.name ?? null}
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
      </div>

      {tab === "dump" && (
        <DumpControls
          pursuitId={pursuit.id}
          dumps={pursuit.brainDumps.map((d) => ({
            id: d.id,
            content: d.content,
            images: d.images,
            processed: d.processed,
            createdAt: d.createdAt.toISOString(),
          }))}
        />
      )}

      {tab === "organized" && (
        <MergeControls
          pursuitId={pursuit.id}
          notes={pursuit.notes.map((n) => ({
            id: n.id,
            content: n.content,
            createdAt: n.createdAt.toISOString(),
            tags: n.tags,
            sourceDumps: n.sourceDumps,
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

      {tab === "files" && (
        <div className="flex flex-col gap-4">
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
          <div className="flex flex-col">
            {pursuit.attachments.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 border-b border-dashed border-border-subtle py-3 last:border-0 hover:underline"
              >
                <span className="text-sm">{a.name}</span>
              </a>
            ))}
            {pursuit.attachments.length === 0 && (
              <p className="text-sm text-ink-muted">
                No files yet — add a link above.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
