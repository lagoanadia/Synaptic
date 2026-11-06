import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autoTitle } from "@/lib/text";
import { PageView } from "../../PageView";

// A note whose original pages are gone.
export default async function NotePage({ params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      pursuitId: id,
      pursuit: { OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }] },
    },
    include: {
      pursuit: { select: { id: true, title: true } },
      section: { select: { name: true } },
      _count: { select: { flashcards: true } },
    },
  });
  if (!note) notFound();

  return (
    <PageView
      pursuit={note.pursuit}
      title={autoTitle(note.content, 14)}
      unit={note.section?.name ?? null}
      date={note.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      dump={null}
      note={{ id: note.id, content: note.content, updatedAt: note.updatedAt.toISOString(), flashcards: note._count.flashcards }}
      files={[]}
    />
  );
}
