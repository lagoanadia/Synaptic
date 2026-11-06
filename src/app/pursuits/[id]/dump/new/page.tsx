import { ArrowLeft } from "@/app/icons";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSlideFile } from "@/lib/slides";
import { SlidePanel } from "../../SlidePanel";
import { NewDumpForm } from "./NewDumpForm";

export default async function NewDumpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { section: sectionParam } = await searchParams;

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
      contentSections: { select: { id: true, classroomUnit: true } },
    },
  });

  if (!pursuit) {
    notFound();
  }
  const unit = pursuit.contentSections.find((u) => u.id === sectionParam) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4 px-6 lg:px-10 py-9">
      <Link
        href={`/pursuits/${id}?tab=pages`}
        className="text-sm text-ink-muted hover:underline"
      >
        <ArrowLeft /> {pursuit.title}
      </Link>
      <SlidePanel
        pursuitId={pursuit.id}
        decks={pursuit.attachments.filter((a) => isSlideFile(a.url))}
        classroomCourseId={pursuit.classroomEnabled ? pursuit.classroomCourseId : null}
        classroomUnit={unit?.classroomUnit ?? null}
      >
        <NewDumpForm pursuitId={pursuit.id} sectionId={unit?.id ?? null} />
      </SlidePanel>
    </div>
  );
}
