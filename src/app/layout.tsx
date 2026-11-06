import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { RegisterServiceWorker } from "./RegisterServiceWorker";
import { NavDrawer } from "./NavDrawer";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const appFont = Plus_Jakarta_Sans({
  variable: "--font-app",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Synaptic",
  description: "Capture things learned by doing, then organize them later.",
  manifest: "/manifest.webmanifest",
  // iOS ignores most of the web manifest and needs this to open standalone.
  appleWebApp: {
    title: "Synaptic",
    statusBarStyle: "default",
  },
  // Proves ownership of the site to Google Search Console — needed for
  // the OAuth consent screen verification (Classroom/Drive scopes).
  verification: {
    google: "wC_i-wp8y2j39HS53RmzInvrdEpUv1bMbvQ4i0mz4XI",
  },
};

// themeColor used to live on `metadata` — Next.js 14 split it out into
// this separate `viewport` export instead.
export const viewport: Viewport = {
  // Matches the icon's own blue, kept on purpose (see Logo.tsx).
  themeColor: "#2383e2",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const userId = session?.user?.id;
  const [user, sections] = userId
    ? await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { plan: true, locale: true } }),
        prisma.section.findMany({ where: { userId }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
      ])
    : [null, []];

  return (
    <html lang="en" className={`${appFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <RegisterServiceWorker />
        {session?.user && user && (
          <NavDrawer
            user={{ name: session.user.name ?? null, email: session.user.email ?? null, image: session.user.image ?? null }}
            plan={user.plan}
            locale={user.locale}
            sections={sections}
          />
        )}
        <div className={`flex flex-1 flex-col ${session?.user ? "pl-12 sm:pl-14" : ""}`}>{children}</div>
        <footer className="px-6 py-4 text-center text-xs text-ink-faint">
          Built by{" "}
          <a
            href="https://github.com/lagoanadia"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Nadia
          </a>{" "}
          · © {new Date().getFullYear()}{" "}
          <Link href="/" className="hover:underline">
            Synaptic
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
        </footer>
      </body>
    </html>
  );
}
