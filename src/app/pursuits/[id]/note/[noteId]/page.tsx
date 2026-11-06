import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autoTitle } from "@/lib/text";
import { isSlideFile } from "@/lib/slides";
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
      pursuit: {
        select: {
          id: true,
          title: true,
          classroomCourseId: true,
          classroomEnabled: true,
          section: { select: { id: true, name: true } },
          attachments: { orderBy: { createdAt: "desc" }, select: { name: true, url: true } },
        },
      },
      section: { select: { name: true, classroomUnit: true } },
    },
  });
  if (!note) notFound();
  const p = note.pursuit;

  return (
    <PageView
      pursuit={{ id: p.id, title: p.title }}
      crumbs={[
        ...(p.section ? [{ label: p.section.name, href: `/pursuits/s/${p.section.id}` }] : []),
        { label: p.title, href: `/pursuits/${p.id}` },
        ...(note.section ? [{ label: note.section.name }] : []),
      ]}
      title={autoTitle(note.content, 14)}
      dump={null}
      note={{ id: note.id, content: note.content, updatedAt: note.updatedAt.toISOString() }}
      slides={{
        decks: p.attachments.filter((a) => isSlideFile(a.url)),
        classroomCourseId: p.classroomEnabled ? p.classroomCourseId : null,
        classroomUnit: note.section?.classroomUnit ?? null,
      }}
    />
  );
}
