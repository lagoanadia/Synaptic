import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { folderColor } from "@/lib/covers";
import { classroomEmail, getValidAccessToken, listCourseDeadlines } from "@/lib/googleClassroom";

export type NotebookDeadline = { id: string; title: string; dueAt: number; url: string; turnedIn: boolean; folderId: string; folder: string; color: string };

// Every Classroom assignment of a notebook's linked subjects, for its
// "Entregas" panel. Fetched on the server while the page streams (not from
// the browser after it loads, where it queued behind other requests) and
// kept for five minutes, so coming back to a notebook is instant. Failures
// just drop out.
// What the panel shows: the list, or why there isn't one. Failures throw,
// so they're never cached and the next visit tries again.
export type DeadlinesResult = { status: "ok" | "none" | "disconnected"; list: NotebookDeadline[] };

async function load(userId: string, sectionId: string): Promise<DeadlinesResult> {
  const pursuits = await prisma.pursuit.findMany({
    where: { sectionId, ownerId: userId, classroomCourseId: { not: null } },
    select: { id: true, title: true, cover: true, classroomCourseId: true },
  });
  if (pursuits.length === 0) return { status: "none", list: [] };
  const [token, email] = await Promise.all([getValidAccessToken(userId), classroomEmail(userId)]);
  if (!token) return { status: "disconnected", list: [] };
  let failed = 0;
  const lists = await Promise.all(
    pursuits.map((p) =>
      listCourseDeadlines(token, p.classroomCourseId!, email)
        .then((ds) => ds.map((d) => ({ id: d.id, title: d.title, dueAt: d.dueAt.getTime(), url: d.url, turnedIn: d.turnedIn, folderId: p.id, folder: p.title, color: folderColor(p.id, p.cover) })))
        .catch(() => {
          failed++;
          return [] as NotebookDeadline[];
        }),
    ),
  );
  if (failed === pursuits.length) throw new Error("Classroom unavailable");
  return { status: "ok", list: lists.flat().sort((a, b) => a.dueAt - b.dueAt) };
}

export const notebookDeadlines = unstable_cache(load, ["notebook-deadlines-v2"], { revalidate: 300 });
