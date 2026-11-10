"use server";

import { getT } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildStarterSpace, planStarterSpace, removeSampleContent, type OnboardingAnswers } from "@/lib/onboarding";
import { getValidAccessToken, listCourses } from "@/lib/googleClassroom";

export async function finishOnboarding(
  answers: OnboardingAnswers,
): Promise<{ error: string | null; landingId?: string | null }> {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) return { error: t("No has iniciado sesión") };

  // Runs once: a double click or a second tab mustn't build it twice.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { onboardedAt: true },
  });
  if (user.onboardedAt) return { error: null, landingId: null };

  try {
    const landingId = await buildStarterSpace(session.user.id, planStarterSpace(answers));
    revalidatePath("/pursuits", "layout");
    return { error: null, landingId };
  } catch (err) {
    console.error("finishOnboarding failed", err);
    return { error: t("Algo ha fallado al prepararlo todo — inténtalo de nuevo") };
  }
}

export async function skipOnboarding() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.user.update({ where: { id: session.user.id }, data: { onboardedAt: new Date() } });
  revalidatePath("/pursuits", "layout");
}

// Step 2: your Classroom courses, if Classroom is connected.
export async function classroomCourses(): Promise<{ connected: boolean; courses: { id: string; name: string }[] }> {
  const session = await auth();
  if (!session?.user?.id) return { connected: false, courses: [] };
  const token = await getValidAccessToken(session.user.id);
  if (!token) return { connected: false, courses: [] };
  return { connected: true, courses: await listCourses(token).catch(() => []) };
}

export async function removeSample() {
  const session = await auth();
  if (!session?.user?.id) return;
  await removeSampleContent(session.user.id);
  revalidatePath("/pursuits", "layout");
}
