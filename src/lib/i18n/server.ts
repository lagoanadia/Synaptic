import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, asLang, makeT, type Lang, type T } from ".";

// The language picked in the app (a cookie), Spanish by default.
export async function getLang(): Promise<Lang> {
  return asLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getT(): Promise<T> {
  return makeT(await getLang());
}
