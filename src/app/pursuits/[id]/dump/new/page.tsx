import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSlideFile } from "@/lib/slides";
import { SlidePanel } from "../../SlidePanel";
import { NewDumpForm } from "./NewDumpForm";

export default async function NewDumpPage({
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
    select: {
      id: true,
      title: true,
      classroomCourseId: true,
      classroomEnabled: true,
      attachments: { orderBy: { createdAt: "desc" }, select: { name: true, url: true } },
    },
  });

  if (!pursuit) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-9">
      <Link
        href={`/pursuits/${id}?tab=pages`}
        className="text-sm text-ink-muted hover:underline"
      >
        ← {pursuit.title}
      </Link>
      <SlidePanel
        pursuitId={pursuit.id}
        decks={pursuit.attachments.filter((a) => isSlideFile(a.url))}
        classroomCourseId={pursuit.classroomEnabled ? pursuit.classroomCourseId : null}
      />
      <NewDumpForm pursuitId={pursuit.id} />
    </div>
  );
}
