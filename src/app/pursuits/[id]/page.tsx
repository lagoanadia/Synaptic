import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addAttachment, organizeDumps } from "./actions";
import { MergeControls } from "./MergeControls";
import { TagForm } from "./TagForm";
import { MemberForm } from "./MemberForm";
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
    `pb-2.5 font-mono text-xs tracking-wide uppercase border-b-2 ${
      tab === name
        ? "border-blue-500 text-zinc-900 dark:text-zinc-50"
        : "border-transparent text-zinc-500"
    }`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-9">
      <div className="flex items-center justify-between">
        <Link
          href="/pursuits"
          className="font-mono text-xs tracking-wide text-zinc-900 uppercase hover:underline dark:text-zinc-50"
        >
          ← Exit
        </Link>
        <span className="font-mono text-xs tracking-wide text-zinc-500 uppercase">
          Focus mode
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{pursuit.title}</h1>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              pursuit.status === "ACTIVE" ? "bg-blue-500" : "bg-zinc-400"
            }`}
          />
          <span className="font-mono text-xs tracking-wide text-zinc-500 uppercase">
            {typeLabel} · {pursuit.status.toLowerCase()}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {pursuit.pursuitTags.map((t) => (
            <span
              key={t.id}
              className="rounded-full border border-zinc-300 px-2 py-0.5 font-mono text-[10px] text-zinc-500 uppercase dark:border-zinc-700"
            >
              #{t.name}
            </span>
          ))}
          <TagForm pursuitId={pursuit.id} />
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="font-mono text-[10px] tracking-wide text-zinc-500 uppercase">
            Shared with
          </span>
          <span className="text-xs text-zinc-700 dark:text-zinc-300">
            {pursuit.owner.name ?? pursuit.owner.email} (owner)
          </span>
          {pursuit.members.map((m) => (
            <span key={m.id} className="text-xs text-zinc-700 dark:text-zinc-300">
              · {m.user.name ?? m.user.email} ({m.role.toLowerCase()})
            </span>
          ))}
          {pursuit.owner.id === session.user.id && (
            <MemberForm pursuitId={pursuit.id} />
          )}
        </div>
      </div>

      <div className="flex gap-7 border-b border-zinc-200 dark:border-zinc-800">
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
            className="self-start rounded-md border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-solid hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-50 dark:hover:text-zinc-50"
          >
            + New page
          </Link>

          {unprocessedCount > 0 && (
            <form action={organizeDumps.bind(null, pursuit.id)}>
              <button
                type="submit"
                className="self-start rounded-md border border-blue-500 px-3 py-1.5 font-mono text-xs font-medium tracking-wide text-blue-500 uppercase hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                ✦ Organize {unprocessedCount} new dumps →
              </button>
            </form>
          )}

          <div className="flex flex-col">
            {pursuit.brainDumps.map((d) => (
              <Link
                key={d.id}
                href={`/pursuits/${pursuit.id}/dump/${d.id}`}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <span
                  className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                    d.processed ? "bg-zinc-300 dark:bg-zinc-700" : "bg-blue-500"
                  }`}
                />
                {d.images.length > 0 && <span>🖼</span>}
                <span className="flex-1 truncate text-sm">
                  {autoTitle(d.content)}
                </span>
                <span className="font-mono text-[10px] whitespace-nowrap text-zinc-500">
                  {d.createdAt.toLocaleDateString()}
                </span>
                {d.processed && (
                  <span className="font-mono text-[10px] whitespace-nowrap text-zinc-500">
                    → in note
                  </span>
                )}
              </Link>
            ))}
            {pursuit.brainDumps.length === 0 && (
              <p className="text-sm text-zinc-500">
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
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              type="text"
              name="url"
              placeholder="URL"
              required
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              className="rounded-md border border-zinc-900 px-4 py-2 text-sm font-medium whitespace-nowrap dark:border-zinc-50"
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
                className="flex items-center gap-3 border-b border-dashed border-zinc-200 py-3 last:border-0 hover:underline dark:border-zinc-800"
              >
                <span className="text-sm">{a.name}</span>
              </a>
            ))}
            {pursuit.attachments.length === 0 && (
              <p className="text-sm text-zinc-500">
                No files yet — add a link above.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
