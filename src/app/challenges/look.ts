import type { Language } from "@/lib/challenge";

// How languages and difficulties look, shared by the picker and the list.
export const LANGUAGE_STYLE: Record<Language, { badge: string; what: string }> = {
  javascript: { badge: "bg-[#e9a23b] text-white", what: "Funciones" },
  typescript: { badge: "bg-[#2383e2] text-white", what: "Funciones tipadas" },
  python: { badge: "bg-[#3d7a5a] text-white", what: "Funciones" },
  react: { badge: "bg-[#2f2e2b] text-white", what: "Componentes" },
};

export const DIFFICULTIES = [
  { key: "easy", label: "fácil", bar: "bg-mint" },
  { key: "medium", label: "media", bar: "bg-amber" },
  { key: "hard", label: "difícil", bar: "bg-crimson" },
] as const;
export type Difficulty = (typeof DIFFICULTIES)[number]["key"];
export const difficultyOf = (d: string) => DIFFICULTIES.find((x) => x.key === d) ?? DIFFICULTIES[0];
