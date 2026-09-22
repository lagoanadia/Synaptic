import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autoTitle, parseContent } from "@/lib/text";

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
      <Link
        href={`/pursuits/${id}?tab=dump`}
        className="font-mono text-xs tracking-wide text-zinc-500 uppercase hover:underline"
      >
        ← {dump.pursuit.title}
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-balance">
          {autoTitle(dump.content, 12)}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              dump.processed
                ? "bg-zinc-300 dark:bg-zinc-700"
                : "bg-blue-500"
            }`}
          />
          <span className="font-mono text-xs text-zinc-500">
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
                className="max-w-full rounded-md border border-zinc-200 dark:border-zinc-800"
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
