import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { RegisterServiceWorker } from "./RegisterServiceWorker";

const appFont = Plus_Jakarta_Sans({
  variable: "--font-app",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Synaptic",
  description: "Capture things learned by doing, then organize them later.",
  manifest: "/manifest.webmanifest",
  // Without this, an iPhone/iPad that adds Synaptic to the home screen
  // opens it in a plain Safari tab instead of the standalone, app-like
  // window the manifest already gives Android/desktop Chrome — iOS
  // ignores most of the Web Manifest spec and wants its own meta tags.
  appleWebApp: {
    title: "Synaptic",
    statusBarStyle: "default",
  },
};

// themeColor used to live on `metadata` — Next.js 14 split it out into
// this separate `viewport` export instead.
export const viewport: Viewport = {
  themeColor: "#2383e2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${appFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <RegisterServiceWorker />
        {children}
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
