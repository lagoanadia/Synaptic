import { en } from "./en";
import { de } from "./de";

// The app is written in Spanish; English and German translate each
// Spanish text (the key). Anything not translated yet shows in Spanish.
export const LANGS = ["es", "en", "de"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABEL: Record<Lang, string> = { es: "Español", en: "English", de: "Deutsch" };
export const LANG_COOKIE = "lang";

const DICT: Record<Lang, Record<string, string>> = { es: {}, en, de };

export const asLang = (v: unknown): Lang => (LANGS.includes(v as Lang) ? (v as Lang) : "es");

// t("Hola, {name}", { name }) → "Hello, Nadia".
export function translate(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  const out = DICT[lang][text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

export type T = (text: string, vars?: Record<string, string | number>) => string;
export const makeT = (lang: Lang): T => (text, vars) => translate(lang, text, vars);

// For dates and numbers: "es-ES", "en-GB", "de-DE".
export const LOCALE: Record<Lang, string> = { es: "es-ES", en: "en-GB", de: "de-DE" };
