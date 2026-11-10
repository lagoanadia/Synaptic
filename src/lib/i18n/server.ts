import "server-only";
import { cookies, headers } from "next/headers";
import { LANGS, LANG_COOKIE, asLang, makeT, type Lang, type T } from ".";

// The language picked in the app (a cookie). Without one, the browser's
// language if we have it (English, German), else Spanish.
export async function getLang(): Promise<Lang> {
  const picked = (await cookies()).get(LANG_COOKIE)?.value;
  if (picked) return asLang(picked);
  return fromAcceptLanguage((await headers()).get("accept-language"));
}

// "de-DE,de;q=0.9,en;q=0.8" → "de". First supported language wins.
export function fromAcceptLanguage(header: string | null): Lang {
  for (const part of (header ?? "").split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if ((LANGS as readonly string[]).includes(code)) return code as Lang;
  }
  return "es";
}

export async function getT(): Promise<T> {
  return makeT(await getLang());
}
