import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "F1 Dashboard",
  description: "Formula 1 race, driver, and standings data — current and historical.",
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/races", label: "Races" },
  { href: "/drivers", label: "Drivers" },
  { href: "/seasons", label: "Seasons" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
        <header className="border-b border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <Link href="/" className="text-lg font-bold tracking-tight">
              🏎️ F1 Dashboard
            </Link>
            <div className="flex gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {NAV_LINKS.slice(1).map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-black dark:hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
        <footer className="border-t border-black/10 px-6 py-4 text-center text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-500">
          Data from the{" "}
          <a href="https://github.com/jolpica/jolpica-f1" className="hover:underline">
            Jolpica-F1 API
          </a>
          , an open-source Ergast-compatible successor.
        </footer>
      </body>
    </html>
  );
}
