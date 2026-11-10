import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { baseHandle, freeHandle } from "@/lib/username";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // Both providers verify emails, so a matching email links accounts instead
    // of failing with OAuthAccountNotLinked.
    GitHub({ allowDangerousEmailAccountLinking: true }),
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
  session: { strategy: "database" },
  events: {
    // New accounts get a free @usuario straight away (editable later).
    async createUser({ user }) {
      if (!user.id) return;
      try {
        const username = await freeHandle(baseHandle(user.name, user.email));
        await prisma.user.update({ where: { id: user.id }, data: { username } });
      } catch {}
    },
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
