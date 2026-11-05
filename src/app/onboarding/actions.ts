"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildStarterSpace, planStarterSpace, type OnboardingAnswers } from "@/lib/onboarding";

export async function finishOnboarding(
  answers: OnboardingAnswers,
): Promise<{ error: string | null; landingId?: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in" };

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
    return { error: "Something went wrong setting things up — try again" };
  }
}

export async function skipOnboarding() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.user.update({ where: { id: session.user.id }, data: { onboardedAt: new Date() } });
  revalidatePath("/pursuits", "layout");
}
