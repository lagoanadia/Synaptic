import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  DAILY_ORGANIZE_LIMIT,
  getOrganizeUsageToday,
  hasUnlimitedAccess,
  incrementOrganizeUsage,
} from "@/lib/organizeLimit";

// The signed-in user, plus the pursuit if they own it or were invited.
export async function requirePursuitAccess(pursuitId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No has iniciado sesión");
  const pursuit = await prisma.pursuit.findFirst({
    where: {
      id: pursuitId,
      OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
    },
  });
  if (!pursuit) throw new Error("Asignatura no encontrada o sin acceso");
  return { session, pursuit, userId: session.user.id };
}

// Daily AI budget for free accounts. `check` before calling the AI,
// `charge` after it actually answered.
export async function aiBudget(userId: string, email: string | null | undefined) {
  const unlimited = await hasUnlimitedAccess(userId, email);
  return {
    unlimited,
    async check(): Promise<string | null> {
      if (unlimited) return null;
      const used = await getOrganizeUsageToday(userId);
      return used >= DAILY_ORGANIZE_LIMIT
        ? `Has llegado al límite de hoy: ${DAILY_ORGANIZE_LIMIT} usos de la IA. Vuelve mañana.`
        : null;
    },
    async charge() {
      if (!unlimited) await incrementOrganizeUsage(userId);
    },
  };
}
