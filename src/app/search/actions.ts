"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HEADLINE_OPTIONS, buildPrefixTsQuery, markWords } from "@/lib/search";
import { autoTitle } from "@/lib/text";

export type FoundKind = "folder" | "page" | "concept" | "card";
export type Found = { kind: FoundKind; id: string; title: string; snippet: string; where: string; href: string };

const PER_KIND = 5;

// A snippet without the stored format's markup (table pipes, "---", "#", "**").
const plain = (t: string) =>
  t
    .replace(/-{3,}/g, " ")
    .replace(/[|#*>`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Ctrl+K: folders, pages, concepts and cards you can open, optionally in
// one notebook. Pages use the full-text index (prefix match while you
// type); the rest are short fields, matched with ILIKE.
export async function searchEverything(query: string, sectionId: string | null): Promise<Found[]> {
  const session = await auth();
  const userId = session?.user?.id;
  const q = query.trim().slice(0, 100);
  if (!userId || q.length < 2) return [];

  const pursuits = await prisma.pursuit.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      ...(sectionId ? { sectionId } : {}),
    },
    select: { id: true, title: true },
  });
  if (pursuits.length === 0) return [];
  const ids = pursuits.map((p) => p.id);
  const folderName = new Map(pursuits.map((p) => [p.id, p.title]));
  const ts = buildPrefixTsQuery(q);

  type Row = { id: string; pursuitId: string; sectionId: string | null; content: string | null; snippet: string };
  const [dumps, notes, concepts, cards] = await Promise.all([
    ts
      ? prisma.$queryRaw<Row[]>`
          SELECT id, "pursuitId", "sectionId", content,
            ts_headline('simple', coalesce(content, ''), to_tsquery('simple', ${ts}), ${HEADLINE_OPTIONS}) AS snippet
          FROM "BrainDump"
          WHERE "pursuitId" = ANY(${ids}) AND "searchVector" @@ to_tsquery('simple', ${ts})
          ORDER BY ts_rank("searchVector", to_tsquery('simple', ${ts})) DESC
          LIMIT ${PER_KIND}`
      : Promise.resolve([] as Row[]),
    ts
      ? prisma.$queryRaw<(Row & { dumpId: string | null })[]>`
          SELECT n.id, n."pursuitId", n."sectionId", n.content,
            ts_headline('simple', n.content, to_tsquery('simple', ${ts}), ${HEADLINE_OPTIONS}) AS snippet,
            (SELECT l."A" FROM "_BrainDumpToNote" l WHERE l."B" = n.id LIMIT 1) AS "dumpId"
          FROM "Note" n
          WHERE n."pursuitId" = ANY(${ids}) AND n."searchVector" @@ to_tsquery('simple', ${ts})
          ORDER BY ts_rank(n."searchVector", to_tsquery('simple', ${ts})) DESC
          LIMIT ${PER_KIND}`
      : Promise.resolve([] as (Row & { dumpId: string | null })[]),
    prisma.concept.findMany({
      where: {
        map: { pursuitId: { in: ids } },
        OR: [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }],
      },
      take: PER_KIND,
      select: { id: true, title: true, summary: true, mapId: true, map: { select: { pursuitId: true, title: true, unit: { select: { name: true } } } } },
    }),
    prisma.flashcard.findMany({
      where: {
        pursuitId: { in: ids },
        OR: [{ question: { contains: q, mode: "insensitive" } }, { answer: { contains: q, mode: "insensitive" } }],
      },
      take: PER_KIND,
      select: { id: true, question: true, answer: true, pursuitId: true },
    }),
  ]);

  // Unit names for "DI · UD1".
  const unitIds = [...new Set([...dumps, ...notes].map((r) => r.sectionId).filter((x): x is string => !!x))];
  const units = unitIds.length
    ? new Map((await prisma.pursuitContentSection.findMany({ where: { id: { in: unitIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]))
    : new Map<string, string>();
  const where = (pursuitId: string, unit?: string | null) => [folderName.get(pursuitId), unit].filter(Boolean).join(" · ");

  const out: Found[] = [];
  const lower = q.toLowerCase();
  for (const p of pursuits.filter((p) => p.title.toLowerCase().includes(lower)).slice(0, 3)) {
    out.push({ kind: "folder", id: p.id, title: p.title, snippet: "", where: "", href: `/pursuits/${p.id}` });
  }

  // A note and the page it was organized from are one result.
  const seen = new Set<string>();
  const pages = [
    ...dumps.map((d) => ({ ...d, href: `/pursuits/${d.pursuitId}/dump/${d.id}` })),
    ...notes.map((n) => ({ ...n, href: n.dumpId ? `/pursuits/${n.pursuitId}/dump/${n.dumpId}` : `/pursuits/${n.pursuitId}/note/${n.id}` })),
  ];
  for (const r of pages) {
    if (seen.has(r.href) || seen.size >= PER_KIND) continue;
    seen.add(r.href);
    out.push({
      kind: "page",
      id: r.id,
      title: autoTitle(r.content ?? "", 10),
      snippet: plain(r.snippet),
      where: where(r.pursuitId, r.sectionId ? units.get(r.sectionId) : null),
      href: r.href,
    });
  }

  for (const c of concepts) {
    out.push({
      kind: "concept",
      id: c.id,
      title: c.title,
      snippet: markWords(c.summary, q),
      where: `Mapa de ${where(c.map.pursuitId, c.map.unit?.name ?? c.map.title)}`,
      href: `/pursuits/${c.map.pursuitId}/learn/${c.mapId}?c=${c.id}`,
    });
  }
  for (const c of cards) {
    out.push({
      kind: "card",
      id: c.id,
      title: c.question,
      snippet: markWords(c.answer, q),
      where: folderName.get(c.pursuitId) ?? "",
      href: `/review?mode=learn&pursuit=${c.pursuitId}`,
    });
  }
  return out;
}
