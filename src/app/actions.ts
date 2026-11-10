"use server";

import { signOut } from "@/auth";

export async function signOutAction() {
  await signOut();
}

// The app's language, for a year (lib/i18n).
export async function setLang(lang: string) {
  const { cookies } = await import("next/headers");
  const { asLang, LANG_COOKIE } = await import("@/lib/i18n");
  (await cookies()).set(LANG_COOKIE, asLang(lang), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
