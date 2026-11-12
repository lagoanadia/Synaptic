"use server";

import { auth, signOut } from "@/auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function signOutAction() {
  await signOut();
}

// The app's language, for a year (lib/i18n).
export async function setLang(lang: string) {
  const { cookies } = await import("next/headers");
  const { asLang, LANG_COOKIE } = await import("@/lib/i18n");
  (await cookies()).set(LANG_COOKIE, asLang(lang), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

// Light, dark or follow the device ("system"), kept in a cookie.
export async function setTheme(theme: string) {
  const { cookies } = await import("next/headers");
  const value = theme === "dark" || theme === "system" ? theme : "light";
  (await cookies()).set("theme", value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

// Sidebar "edit menu": show or hide Calendar, Review or Challenges.
export async function setNavItem(key: "calendar" | "review" | "codes", on: boolean) {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return;
  if (key === "codes") {
    await prisma.user.update({ where: { id }, data: { codes: on } });
  } else {
    const user = await prisma.user.findUnique({ where: { id }, select: { nav: true } });
    const nav = user?.nav && typeof user.nav === "object" && !Array.isArray(user.nav) ? user.nav : {};
    await prisma.user.update({ where: { id }, data: { nav: { ...nav, [key]: on } } });
  }
  revalidatePath("/", "layout");
}
