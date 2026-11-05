import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // Both GitHub and Google verify the email before handing it to us, so
    // it's safe to link a sign-in from either provider to the same account
    // when the email matches, instead of erroring with
    // "OAuthAccountNotLinked" the first time someone uses the other one.
    // Missing on GitHub specifically was the actual bug: anyone who
    // originally signed up with Google and then tried GitHub (or whose
    // account only had GitHub linked and the UI nudged them to "sign in
    // the same way" with no indication which provider that was) got
    // immediately bounced before the callback ever ran.
    GitHub({ allowDangerousEmailAccountLinking: true }),
    Google({ allowDangerousEmailAccountLinking: true }),
  ],
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
