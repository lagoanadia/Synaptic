import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { RegisterServiceWorker } from "./RegisterServiceWorker";
import { Sidebar } from "./Sidebar";
import { CoverDefs } from "./CoverDefs";
import { notebookCover } from "@/lib/covers";
import { parseAvatar } from "@/lib/avatar";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { getLang } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n";
import { LangProvider } from "./LangProvider";

const appFont = Inter({
  variable: "--font-app",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // The browser tab just says "Synaptic"; search results use openGraph below.
  title: { default: "Synaptic", template: "%s — Synaptic" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["apuntes", "app de estudio", "mapas de conceptos", "tarjetas de repaso", "IA para estudiar", "Google Classroom", "FP", "estudiantes"],
  openGraph: { type: "website", url: SITE_URL, siteName: SITE_NAME, title: SITE_NAME, description: SITE_DESCRIPTION, locale: "es_ES" },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
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
        prisma.user.findUnique({ where: { id: userId }, select: { plan: true, avatar: true, codes: true, nav: true } }),
        prisma.section.findMany({ where: { userId }, orderBy: { order: "asc" }, select: { id: true, name: true, cover: true, study: true } }),
      ])
    : [null, []];
  // Sidebar collapsed to icons? Remembered in a cookie so it renders that way.
  const collapsed = (await cookies()).get("sidebar")?.value === "collapsed";
  const lang = await getLang();
  const t = makeT(lang);

  return (
    <html lang={lang} data-sidebar={collapsed ? "collapsed" : undefined} className={`${appFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <LangProvider lang={lang}>
        <RegisterServiceWorker />
        <CoverDefs />
        {session?.user && user && (
          <Sidebar
            user={{ name: session.user.name ?? null, email: session.user.email ?? null, image: session.user.image ?? null, avatar: user.avatar ? parseAvatar(user.avatar) : null }}
            plan={user.plan}
            notebooks={sections.map((s) => ({ id: s.id, name: s.name, cover: notebookCover(s.id, s.cover) }))}
            collapsed={collapsed}
            codes={user.codes}
            calendar={(user.nav as { calendar?: boolean } | null)?.calendar ?? true}
            study={(user.nav as { review?: boolean } | null)?.review ?? sections.some((s) => s.study)}
          />
        )}
        <div className={`flex flex-1 flex-col ${session?.user ? "app-pad pb-16 lg:pb-0" : ""}`}>{children}</div>
        <footer className={`px-6 py-4 text-center text-xs text-ink-faint ${session?.user ? "app-pad hidden lg:block" : ""}`}>
          {t("Hecho por")}{" "}
          <a
            href="https://github.com/lagoanadia"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {t("Nadia")}
          </a>{" "}
          · © {new Date().getFullYear()}{" "}
          <Link href="/web" className="hover:underline">
            {t("Synaptic")}
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="hover:underline">
            {t("Privacidad")}
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="hover:underline">
            {t("Términos")}
          </Link>
        </footer>
        </LangProvider>
      </body>
    </html>
  );
}
