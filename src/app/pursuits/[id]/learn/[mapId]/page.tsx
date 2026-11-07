import { shortMapTitle } from "@/lib/text";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { nextUp, type Status } from "@/lib/internalize";
import { folderColor } from "@/lib/covers";
import { folderMap } from "@/lib/blockData";
import { LearnView } from "./LearnView";

// Aprender: one concept at a time, next to the map of its unit only.
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
      unitId: true,
      unit: { select: { name: true } },
      pursuit: { select: { title: true, cover: true, section: { select: { id: true, name: true } } } },
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
          parentId: true,
          linksOut: { select: { toId: true } },
        },
      },
    },
  });
  if (!map) notFound();

  const concepts = map.concepts.map((k) => ({ ...k, status: k.status as Status }));
  const links = map.concepts.flatMap((k) => k.linksOut.map((l) => ({ fromId: k.id, toId: l.toId })));
  const startId = (c && concepts.some((k) => k.id === c) ? c : null) ?? nextUp(concepts, links) ?? concepts[0]?.id ?? null;
  const concept = concepts.find((k) => k.id === startId);
  if (!concept) redirect(`/pursuits/${pursuitId}`);

  // The whole unit (every map in it), or just this map when it has no unit.
  const clusterId = map.unitId ?? `map-${map.id}`;
  const cluster = (await folderMap(pursuitId, folderColor(pursuitId, map.pursuit.cover))).filter((k) => k.id === clusterId);

  const section = map.pursuit.section;
  const crumbs = [
    ...(section ? [{ label: section.name, href: `/pursuits/s/${section.id}` }] : []),
    { label: map.pursuit.title, href: `/pursuits/${pursuitId}` },
    { label: shortMapTitle(map.unit?.name ?? map.title, 28) },
  ];

  return (
    <LearnView
      key={concept.id}
      pursuitId={pursuitId}
      mapId={map.id}
      crumbs={crumbs}
      concept={{
        id: concept.id,
        title: concept.title,
        summary: concept.summary,
        explanation: concept.explanation,
        excerpt: concept.excerpt,
        excerptFrom: concept.excerptFrom,
      }}
      map={cluster}
    />
  );
}
