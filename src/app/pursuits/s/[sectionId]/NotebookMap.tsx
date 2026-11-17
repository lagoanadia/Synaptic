"use client";

import { useSearchParams } from "next/navigation";
import { KnowledgeMap } from "@/app/KnowledgeMap";
import type { MapCluster } from "@/lib/knowledgeMap";

// The notebook's map, showing only the subjects of the open section tab.
export function NotebookMap({ clusters, groupOf, title }: { clusters: MapCluster[]; groupOf: Record<string, string | null>; title: string }) {
  const tab = useSearchParams().get("s");
  const shown = tab ? clusters.filter((c) => groupOf[c.id] === tab) : clusters;
  if (shown.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b border-border-subtle pb-2 text-sm font-semibold">{title}</h2>
      <KnowledgeMap key={tab ?? ""} clusters={shown} />
    </section>
  );
}
