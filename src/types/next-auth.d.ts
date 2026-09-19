import type { DefaultSession } from "next-auth";

// NextAuth's default Session["user"] type doesn't include `id`, since not
// every adapter/strategy exposes one. We add it here to match what the
// `session` callback in `src/auth.ts` actually puts on the session object.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
