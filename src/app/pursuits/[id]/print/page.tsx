import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { RichContent } from "../RichContent";
import { PrintButton } from "./PrintButton";

// A real page (not the /export route, which streams a .md file) because a
// PDF here means "use the browser's own Print → Save as PDF" — that needs
// an actual rendered page to print, reusing RichContent so a code block,
// table, etc. looks exactly like it does everywhere else in the app.
export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
      notes: {
        include: { tags: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      brainDumps: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!pursuit) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-9">
      <div className="no-print flex items-center justify-between">
        <Link
          href={`/pursuits/${pursuit.id}`}
          className="text-sm text-ink-muted hover:underline"
        >
          ← Back to Pursuit
        </Link>
        <PrintButton />
      </div>

      <h1 className="text-2xl font-bold">{pursuit.title}</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Organized notes</h2>
        {pursuit.notes.length === 0 ? (
          <p className="text-sm text-ink-muted">No organized notes yet.</p>
        ) : (
          pursuit.notes.map((note) => (
            <div
              key={note.id}
              className="print-block flex flex-col gap-2 border-b border-border-subtle pb-4"
            >
              <span className="text-xs text-ink-faint">
                {note.createdAt.toLocaleDateString("en-US", { timeZone: "UTC" })}
                {note.tags.length > 0 &&
                  ` — ${note.tags.map((t) => t.name).join(", ")}`}
              </span>
              <RichContent content={note.content} />
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Brain dumps</h2>
        {pursuit.brainDumps.length === 0 ? (
          <p className="text-sm text-ink-muted">No brain dumps yet.</p>
        ) : (
          pursuit.brainDumps.map((dump) => (
            <div
              key={dump.id}
              className="print-block flex flex-col gap-2 border-b border-border-subtle pb-4"
            >
              <span className="text-xs text-ink-faint">
                {dump.createdAt.toLocaleDateString("en-US", { timeZone: "UTC" })}
              </span>
              <RichContent content={dump.content ?? ""} />
            </div>
          ))
        )}
      </section>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-block {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
