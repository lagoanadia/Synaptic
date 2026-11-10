"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePursuitAccess } from "@/lib/access";

const STATUSES = ["IDEA", "VOTING", "CHOSEN"] as const;
export type ChoiceStatus = (typeof STATUSES)[number];

const done = (pursuitId: string) => revalidatePath(`/pursuits/${pursuitId}`);

// A pasted link's page title (og:title, else <title>), or null. Public
// http(s) hosts only, 4 s at most, the first 200 KB.
async function pageTitle(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || /^(localhost|\d+\.\d+\.\d+\.\d+|\[.*\])$/i.test(url.hostname) || !url.hostname.includes(".")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { "user-agent": "Mozilla/5.0 (compatible; SynapticBot/1.0)" }, redirect: "follow" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    const html = (await res.text()).slice(0, 200_000);
    const og = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1];
    const title = og ?? /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1];
    return title ? title.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim().slice(0, 120) : null;
  } catch {
    return null;
  }
}

// A name from the link itself when the site won't tell us its title
// (Booking and others block bots): "hotel/es/valencia-sky-haven.es.html" →
// "Valencia Sky Haven".
function titleFromUrl(url: URL): string {
  const slug = url.pathname
    .split("/")
    .filter(Boolean)
    .map((p) => decodeURIComponent(p).replace(/\.[a-z-]{2,5}(\.html?)?$|\.html?$/i, ""))
    .filter((p) => /[a-z]/i.test(p) && !/^(es|en|de|fr|it|pt|hotel|rooms?|p|s|item|dp|product)$/i.test(p) && !/^[\w-]{20,}$/.test(p.replace(/-/g, "")) )
    .pop();
  const host = url.hostname.replace(/^www\./, "");
  if (!slug) return host;
  const words = slug.replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : host;
}

// "+ Pega un enlace": a link (with or without https://; its page title
// becomes the name) or just a name.
export async function addChoice(pursuitId: string, blockId: string, input: string) {
  await requirePursuitAccess(pursuitId);
  const text = input.trim().slice(0, 1000);
  if (!text) return;
  const asUrl = /^https?:\/\/\S+$/i.test(text) ? text : /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(text) ? `https://${text}` : null;
  let url: URL | null = null;
  try {
    url = asUrl ? new URL(asUrl) : null;
  } catch {
    url = null;
  }
  const title = url ? ((await pageTitle(url.href)) ?? titleFromUrl(url)) : text.slice(0, 120);
  const last = await prisma.choice.findFirst({ where: { pursuitId, blockId }, orderBy: { order: "desc" }, select: { order: true } });
  await prisma.choice.create({ data: { pursuitId, blockId, title: title.slice(0, 120), url: url?.href ?? null, order: (last?.order ?? -1) + 1 } });
  done(pursuitId);
}

export async function updateChoice(id: string, data: { title?: string; price?: number | null; status?: ChoiceStatus; rating?: number | null; date?: string | null; note?: string | null }) {
  const choice = await prisma.choice.findUnique({ where: { id }, select: { pursuitId: true } });
  if (!choice) return;
  await requirePursuitAccess(choice.pursuitId);
  await prisma.choice.update({
    where: { id },
    data: {
      ...(typeof data.title === "string" && data.title.trim() ? { title: data.title.trim().slice(0, 120) } : {}),
      ...(data.price === null || (typeof data.price === "number" && data.price >= 0 && data.price < 1e9) ? { price: data.price === null ? null : Math.round(data.price) } : {}),
      ...(data.status && STATUSES.includes(data.status) ? { status: data.status } : {}),
      ...(data.rating === null || (Number.isInteger(data.rating) && data.rating! >= 1 && data.rating! <= 5) ? { rating: data.rating } : {}),
      ...(data.date === null || (typeof data.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) ? { date: data.date } : {}),
      ...(data.note === null || typeof data.note === "string" ? { note: data.note?.trim().slice(0, 200) || null } : {}),
    },
  });
  done(choice.pursuitId);
}

export async function deleteChoice(id: string) {
  const choice = await prisma.choice.findUnique({ where: { id }, select: { pursuitId: true } });
  if (!choice) return;
  await requirePursuitAccess(choice.pursuitId);
  await prisma.choice.delete({ where: { id } });
  done(choice.pursuitId);
}

// 👍 on or off. Voting on an idea puts it to the vote; once more than half
// the people have voted for it, it's chosen.
export async function toggleVote(choiceId: string) {
  const choice = await prisma.choice.findUnique({ where: { id: choiceId }, select: { pursuitId: true, status: true } });
  if (!choice) return;
  const { userId, pursuit } = await requirePursuitAccess(choice.pursuitId);
  const key = { choiceId_userId: { choiceId, userId } };
  const mine = await prisma.choiceVote.findUnique({ where: key });
  if (mine) await prisma.choiceVote.delete({ where: key });
  else await prisma.choiceVote.create({ data: { choiceId, userId } });
  const votes = await prisma.choiceVote.count({ where: { choiceId } });
  const members = await prisma.pursuitMember.count({ where: { pursuitId: pursuit.id } });
  const people = members + 1;
  const status = choice.status === "CHOSEN" ? "CHOSEN" : votes * 2 > people ? "CHOSEN" : votes > 0 ? "VOTING" : choice.status;
  if (status !== choice.status) await prisma.choice.update({ where: { id: choiceId }, data: { status } });
  done(pursuit.id);
}

export async function addBudgetLine(pursuitId: string, blockId: string, label: string) {
  await requirePursuitAccess(pursuitId);
  const clean = label.trim().slice(0, 60);
  if (!clean) return;
  const last = await prisma.budgetLine.findFirst({ where: { pursuitId, blockId }, orderBy: { order: "desc" }, select: { order: true } });
  await prisma.budgetLine.create({ data: { pursuitId, blockId, label: clean, order: (last?.order ?? -1) + 1 } });
  done(pursuitId);
}

export async function updateBudgetLine(id: string, data: { label?: string; unit?: number; days?: number; perPerson?: boolean }) {
  const line = await prisma.budgetLine.findUnique({ where: { id }, select: { pursuitId: true } });
  if (!line) return;
  await requirePursuitAccess(line.pursuitId);
  await prisma.budgetLine.update({
    where: { id },
    data: {
      ...(typeof data.label === "string" && data.label.trim() ? { label: data.label.trim().slice(0, 60) } : {}),
      ...(typeof data.unit === "number" && data.unit >= 0 && data.unit < 1e9 ? { unit: Math.round(data.unit) } : {}),
      ...(typeof data.days === "number" && data.days >= 1 && data.days <= 365 ? { days: Math.round(data.days) } : {}),
      ...(typeof data.perPerson === "boolean" ? { perPerson: data.perPerson } : {}),
    },
  });
  done(line.pursuitId);
}

export async function deleteBudgetLine(id: string) {
  const line = await prisma.budgetLine.findUnique({ where: { id }, select: { pursuitId: true } });
  if (!line) return;
  await requirePursuitAccess(line.pursuitId);
  await prisma.budgetLine.delete({ where: { id } });
  done(line.pursuitId);
}

// How many people a budget splits between: the block's number, else
// everyone in the folder.
export async function setBudgetPeople(pursuitId: string, blockId: string, people: number | null) {
  const { pursuit } = await requirePursuitAccess(pursuitId);
  const saved = Array.isArray(pursuit.blocks) ? (pursuit.blocks as { id: string }[]) : [];
  const blocks = saved.map((b) => (b.id === blockId ? { ...b, people: people && people >= 1 && people <= 99 ? Math.round(people) : null } : b));
  await prisma.pursuit.update({ where: { id: pursuitId }, data: { blocks } });
  done(pursuitId);
}
