import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autoTitle } from "@/lib/text";
import { isSlideFile } from "@/lib/slides";
import { PageView } from "../../PageView";
import { pageTerms } from "@/lib/blockData";

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
      notes: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true, content: true, updatedAt: true } },
    },
  });
  if (!dump) notFound();
  const note = dump.notes[0] ?? null;
  const p = dump.pursuit;

  const terms = await pageTerms(p.id, dump.sectionId);

  return (
    <PageView
      terms={terms}
      pursuit={{ id: p.id, title: p.title }}
      crumbs={[
        ...(p.section ? [{ label: p.section.name, href: `/pursuits/s/${p.section.id}` }] : []),
        { label: p.title, href: `/pursuits/${p.id}` },
        ...(dump.section ? [{ label: dump.section.name }] : []),
      ]}
      title={autoTitle(note?.content ?? dump.content, 14)}
      dump={{ id: dump.id, content: dump.content ?? "", updatedAt: dump.updatedAt.toISOString() }}
      note={note && { id: note.id, content: note.content, updatedAt: note.updatedAt.toISOString() }}
      slides={{
        decks: p.attachments.filter((a) => isSlideFile(a.url)),
        classroomCourseId: p.classroomEnabled ? p.classroomCourseId : null,
        classroomUnit: dump.section?.classroomUnit ?? null,
      }}
    />
  );
}
