import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addAttachment, deleteBrainDump, organizeDumps } from "./actions";
import { MergeControls } from "./MergeControls";
import { TagForm } from "./TagForm";
import { MemberForm } from "./MemberForm";
import { DeleteButton } from "./DeleteButton";
import { autoTitle } from "@/lib/text";

const TYPE_LABEL: Record<string, string> = {
  PROJECT: "Project",
  BOOK: "Book",
  LANGUAGE: "Language",
  SKILL: "Skill",
  OTHER: "Other",
};

export default async function PursuitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "organized" || rawTab === "files" ? rawTab : "dump";

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const pursuit = await prisma.pursuit.findFirst({
    where: {
      id,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      pursuitTags: true,
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
  });

  if (!pursuit) {
    notFound();
  }

  const typeLabel =
    pursuit.type === "OTHER" && pursuit.customType
      ? pursuit.customType
      : TYPE_LABEL[pursuit.type];
  const unprocessedCount = pursuit.brainDumps.filter(
    (d) => !d.processed,
  ).length;

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
        <span className="text-xs text-ink-faint">Focus mode</span>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{pursuit.title}</h1>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              pursuit.status === "ACTIVE" ? "bg-accent" : "bg-ink-faint"
            }`}
          />
          <span className="text-sm text-ink-muted">
            {typeLabel} · {pursuit.status.toLowerCase()}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {pursuit.pursuitTags.map((t) => (
            <span
              key={t.id}
              className="rounded bg-chip px-2 py-0.5 text-xs text-ink-muted"
            >
              {t.name}
            </span>
          ))}
          <TagForm pursuitId={pursuit.id} />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-ink-faint">Shared with</span>
          <span className="text-xs text-ink-muted">
            {pursuit.owner.name ?? pursuit.owner.email} (owner)
          </span>
          {pursuit.members.map((m) => (
            <span key={m.id} className="text-xs text-ink-muted">
              · {m.user.name ?? m.user.email} ({m.role.toLowerCase()})
            </span>
          ))}
          {pursuit.owner.id === session.user.id && (
            <MemberForm pursuitId={pursuit.id} />
          )}
        </div>
      </div>

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
      </div>

      {tab === "dump" && (
        <div className="flex flex-col gap-4">
          <Link
            href={`/pursuits/${pursuit.id}/dump/new`}
            className="self-start rounded-md border border-dashed border-border-subtle px-4 py-2 text-sm text-ink-muted hover:border-solid hover:border-ink hover:text-ink"
          >
            + New page
          </Link>

          {unprocessedCount > 0 && (
            <form action={organizeDumps.bind(null, pursuit.id)}>
              <button
                type="submit"
                className="self-start rounded-md border border-accent px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft"
              >
                ✦ Organize {unprocessedCount} new dumps →
              </button>
            </form>
          )}

          <div className="flex flex-col">
            {pursuit.brainDumps.map((d) => (
              <div
                key={d.id}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-chip"
              >
                <Link
                  href={`/pursuits/${pursuit.id}/dump/${d.id}`}
                  className="flex flex-1 items-center gap-3 overflow-hidden"
                >
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      d.processed ? "bg-ink-faint" : "bg-accent"
                    }`}
                  />
                  {d.images.length > 0 && <span>🖼</span>}
                  <span className="flex-1 truncate text-sm">
                    {autoTitle(d.content)}
                  </span>
                  <span className="text-xs whitespace-nowrap text-ink-faint">
                    {d.createdAt.toLocaleDateString()}
                  </span>
                  {d.processed && (
                    <span className="text-xs whitespace-nowrap text-ink-faint">
                      → in note
                    </span>
                  )}
                </Link>
                <DeleteButton
                  action={deleteBrainDump.bind(null, pursuit.id, d.id)}
                  confirmMessage="Delete this page? This can't be undone."
                  className="px-1 text-ink-faint hover:text-red-500"
                >
                  ×
                </DeleteButton>
              </div>
            ))}
            {pursuit.brainDumps.length === 0 && (
              <p className="text-sm text-ink-muted">
                Nothing dumped yet — start above.
              </p>
            )}
          </div>
        </div>
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
