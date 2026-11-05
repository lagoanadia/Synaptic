import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { nextUp, type Status } from "@/lib/internalize";
import { ConceptExplorer } from "./ConceptExplorer";

export default async function ConceptMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; mapId: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { id: pursuitId, mapId } = await params;
  const { c } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const map = await prisma.conceptMap.findFirst({
    where: {
      id: mapId,
      pursuitId,
      pursuit: { OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }] },
    },
    select: {
      id: true,
      title: true,
      sourceKind: true,
      sourceRef: true,
      pursuit: { select: { title: true } },
      concepts: {
        orderBy: [{ depth: "asc" }, { order: "asc" }],
        select: {
          id: true,
          title: true,
          summary: true,
          explanation: true,
          excerpt: true,
          excerptFrom: true,
          order: true,
          depth: true,
          status: true,
          attempt: true,
          feedback: true,
          parentId: true,
          linksOut: { select: { toId: true, label: true } },
        },
      },
    },
  });
  if (!map) notFound();

  const concepts = map.concepts.map((k) => ({
    id: k.id,
    title: k.title,
    summary: k.summary,
    explanation: k.explanation,
    excerpt: k.excerpt,
    excerptFrom: k.excerptFrom,
    order: k.order,
    depth: k.depth,
    status: k.status as Status,
    attempt: k.attempt,
    feedback: k.feedback,
    parentId: k.parentId,
  }));
  const links = map.concepts.flatMap((k) =>
    k.linksOut.map((l) => ({ fromId: k.id, toId: l.toId, label: l.label })),
  );
  const startId =
    (c && concepts.some((k) => k.id === c) ? c : null) ?? nextUp(concepts, links) ?? concepts[0]?.id ?? null;

  return (
    <ConceptExplorer
      pursuitId={pursuitId}
      pursuitTitle={map.pursuit.title}
      map={{ id: map.id, title: map.title, sourceKind: map.sourceKind, sourceRef: map.sourceRef }}
      concepts={concepts}
      links={links}
      startId={startId}
    />
  );
}
