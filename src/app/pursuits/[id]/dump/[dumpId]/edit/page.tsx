import { ArrowLeft } from "@/app/icons";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSlideFile } from "@/lib/slides";
import { SlidePanel } from "../../../SlidePanel";
import { NewDumpForm } from "../../new/NewDumpForm";

export default async function EditDumpPage({
  params,
}: {
  params: Promise<{ id: string; dumpId: string }>;
}) {
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
      section: { select: { classroomUnit: true } },
      pursuit: {
        select: {
          title: true,
          classroomCourseId: true,
          classroomEnabled: true,
          attachments: { orderBy: { createdAt: "desc" }, select: { name: true, url: true } },
        },
      },
    },
  });
  if (!dump) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4 px-6 lg:px-10 py-9">
      <Link href={`/pursuits/${id}/dump/${dumpId}`} className="text-sm text-ink-muted hover:underline">
        <ArrowLeft /> {dump.pursuit.title}
      </Link>
      <SlidePanel
        pursuitId={id}
        decks={dump.pursuit.attachments.filter((a) => isSlideFile(a.url))}
        classroomCourseId={dump.pursuit.classroomEnabled ? dump.pursuit.classroomCourseId : null}
        classroomUnit={dump.section?.classroomUnit ?? null}
        dumpId={dump.id}
      >
        <NewDumpForm
        pursuitId={id}
        dumpId={dump.id}
        initialContent={dump.content ?? ""}
        initialUpdatedAt={dump.updatedAt.toISOString()}
      />
      </SlidePanel>
    </div>
  );
}
