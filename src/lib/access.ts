import { getT } from "@/lib/i18n/server";
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
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) throw new Error(t("No has iniciado sesión"));
  const pursuit = await prisma.pursuit.findFirst({
    where: {
      id: pursuitId,
      OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
    },
  });
  if (!pursuit) throw new Error(t("Asignatura no encontrada o sin acceso"));
  return { session, pursuit, userId: session.user.id };
}

// Daily AI budget for free accounts. `check` before calling the AI,
// `charge` after it actually answered.
export async function aiBudget(userId: string, email: string | null | undefined) {
  const unlimited = await hasUnlimitedAccess(userId, email);
  return {
    unlimited,
    async check(): Promise<string | null> {
  const t = await getT();
      if (unlimited) return null;
      const used = await getOrganizeUsageToday(userId);
      return used >= DAILY_ORGANIZE_LIMIT
        ? t("Has llegado al límite de hoy: {0} usos de la IA. Vuelve mañana.", { 0: DAILY_ORGANIZE_LIMIT })
        : null;
    },
    async charge() {
      if (!unlimited) await incrementOrganizeUsage(userId);
    },
  };
}
