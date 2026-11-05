export type Locale = "en" | "de" | "fr" | "es";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];

export function isLocale(value: string): value is Locale {
  return LOCALES.some((l) => l.code === value);
}
