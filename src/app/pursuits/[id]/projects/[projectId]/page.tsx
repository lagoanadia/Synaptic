import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProjectBoard } from "./ProjectBoard";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id: pursuitId, projectId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      pursuitId,
      pursuit: {
        OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
      },
    },
    include: { cards: true },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-6 py-9">
      <Link
        href={`/pursuits/${pursuitId}?tab=projects`}
        className="text-sm text-ink-muted hover:underline"
      >
        ← Projects
      </Link>
      <ProjectBoard
        pursuitId={pursuitId}
        project={{
          id: project.id,
          title: project.title,
          dueDate: project.dueDate ? project.dueDate.toISOString().slice(0, 10) : null,
        }}
        cards={project.cards.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          status: c.status,
          order: c.order,
        }))}
      />
    </div>
  );
}
