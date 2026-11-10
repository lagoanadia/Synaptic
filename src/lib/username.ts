import { prisma } from "@/lib/prisma";
import { HANDLE } from "@/lib/avatar";

// "Nadia Lagoa", "nadia.l@gmail.com" → "nadialagoa": lowercase, no accents,
// only letters, digits, dot and _, 3-20 long.
export function baseHandle(name: string | null | undefined, email: string | null | undefined): string {
  const from = (name?.trim() || email?.split("@")[0] || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let h = from.replace(/\s+/g, "").replace(/[^a-z0-9._]/g, "").replace(/^[._]+|[._]+$/g, "").slice(0, 16);
  if (h.length < 3) h = (h + "user").slice(0, 16);
  return h;
}

// The base if it's free, else the base plus a number.
export async function freeHandle(base: string, exceptUserId?: string): Promise<string> {
  const taken = async (h: string) => !!(await prisma.user.findFirst({ where: { username: h, ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}) }, select: { id: true } }));
  if (HANDLE.test(base) && !(await taken(base))) return base;
  for (let i = 0; i < 20; i++) {
    const h = `${base.slice(0, 16)}${Math.floor(10 + Math.random() * (i < 10 ? 90 : 9990))}`;
    if (!(await taken(h))) return h;
  }
  return `${base.slice(0, 12)}${Date.now().toString(36).slice(-6)}`;
}
