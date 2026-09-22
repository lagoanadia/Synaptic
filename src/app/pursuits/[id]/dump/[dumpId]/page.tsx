import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autoTitle, parseContent } from "@/lib/text";
import { DeleteDumpButton } from "./DeleteDumpButton";

export default async function DumpPage({
  params,
}: {
  params: Promise<{ id: string; dumpId: string }>;
}) {
  const { id, dumpId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const dump = await prisma.brainDump.findFirst({
    where: {
      id: dumpId,
      pursuitId: id,
      pursuit: {
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } },
        ],
      },
    },
    include: { pursuit: { select: { title: true } } },
  });

  if (!dump) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-9">
      <div className="flex items-center justify-between">
        <Link
          href={`/pursuits/${id}?tab=dump`}
          className="text-sm text-ink-muted hover:underline"
        >
          ← {dump.pursuit.title}
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={`/pursuits/${id}/dump/${dumpId}/edit`}
            className="text-sm text-ink-muted hover:underline"
          >
            Edit
          </Link>
          <DeleteDumpButton pursuitId={id} dumpId={dumpId} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-balance">
          {autoTitle(dump.content, 12)}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              dump.processed ? "bg-ink-faint" : "bg-accent"
            }`}
          />
          <span className="text-xs text-ink-faint">
            {dump.createdAt.toLocaleString()}
            {dump.processed && " · folded into a note"}
          </span>
        </div>
      </div>

      {dump.content && (
        <div className="flex flex-1 flex-col gap-4">
          {parseContent(dump.content).map((segment, i) =>
            segment.type === "text" ? (
              segment.value.trim() !== "" && (
                <p
                  key={i}
                  className="text-base leading-relaxed whitespace-pre-wrap"
                >
                  {segment.value}
                </p>
              )
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={segment.url}
                alt="Brain dump attachment"
                className="max-w-full rounded-md border border-border-subtle"
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
