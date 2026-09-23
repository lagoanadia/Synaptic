import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Synaptic",
  description: "Capture things learned by doing, then organize them later.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${workSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
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
          · © {new Date().getFullYear()} Synaptic
        </footer>
      </body>
    </html>
  );
}
