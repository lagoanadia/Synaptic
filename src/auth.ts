import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { seedWelcomePursuit } from "@/lib/onboarding";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub,
    // Both GitHub and Google verify the email before handing it to us, so
    // it's safe to link a sign-in from either provider to the same account
    // when the email matches, instead of erroring with
    // "OAuthAccountNotLinked" the first time someone uses the other one.
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    // Fires exactly once, right after the adapter inserts the User row —
    // i.e. the very first sign-in ever for this account, never on a
    // returning user's sign-in. That's what makes it safe as a one-shot
    // seed instead of needing its own "already seeded" flag.
    async createUser({ user }) {
      if (user.id) await seedWelcomePursuit(user.id);
    },
  },
});
