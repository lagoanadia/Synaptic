"use client";

import { useSearchParams } from "next/navigation";

// A notebook's section tabs in the order you dragged them. "*" is "Todas";
// stored notebooks without it put it first. The first tab is the one that
// opens by default; the open one is kept in the URL (?s=Teoría, or ?s=* for
// Todas when it isn't first).
export const ALL = "*";
export const tabOrder = (groups: string[]) => (groups.includes(ALL) ? groups : [ALL, ...groups]);
export const realGroups = (groups: string[]) => groups.filter((g) => g !== ALL);

// The open section (null = Todas).
export function useOpenTab(groups: string[]): string | null {
  const s = useSearchParams().get("s");
  if (s === ALL) return null;
  if (s && groups.includes(s)) return s;
  const first = tabOrder(groups)[0];
  return first === ALL ? null : first;
}
