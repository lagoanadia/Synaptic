import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autoTitle } from "@/lib/text";
import { PageView } from "../../PageView";

const longDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

export default async function DumpPage({ params }: { params: Promise<{ id: string; dumpId: string }> }) {
  const { id, dumpId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const dump = await prisma.brainDump.findFirst({
    where: {
      id: dumpId,
      pursuitId: id,
      pursuit: { OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }] },
    },
    include: {
      pursuit: { select: { id: true, title: true } },
      section: { select: { name: true } },
      attachments: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, url: true } },
      notes: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, content: true, updatedAt: true, _count: { select: { flashcards: true } } },
      },
    },
  });
  if (!dump) notFound();
  const note = dump.notes[0] ?? null;

  return (
    <PageView
      pursuit={dump.pursuit}
      title={autoTitle(note?.content ?? dump.content, 14)}
      unit={dump.section?.name ?? null}
      date={longDate(dump.createdAt)}
      dump={{ id: dump.id, content: dump.content ?? "" }}
      note={note && { id: note.id, content: note.content, updatedAt: note.updatedAt.toISOString(), flashcards: note._count.flashcards }}
      files={dump.attachments}
    />
  );
}
