import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import SearchBar from "@/components/SearchBar";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

/** Resolves the dark/light class on <html> before hydration, so the page
 * never flashes the wrong theme: an explicit choice from ThemeToggle
 * (localStorage "theme") wins, otherwise the OS preference decides. Must
 * run with beforeInteractive in the root layout — see
 * globals.css's `@custom-variant dark` comment for how this class then
 * drives every dark: utility class in the app. */
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var isDark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "F1 Dashboard",
    template: "%s | F1 Dashboard",
  },
  description: "Formula 1 race, driver, and standings data — current and historical.",
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/races", label: "Races" },
  { href: "/drivers", label: "Drivers" },
  { href: "/teams", label: "Teams" },
  { href: "/seasons", label: "Seasons" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <header className="border-b border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-4 sm:flex-nowrap sm:gap-6">
            <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
              🏎️ F1 Dashboard
            </Link>
            <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
              <SearchBar />
            </div>
            <div className="flex shrink-0 items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {NAV_LINKS.slice(1).map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-black dark:hover:text-white">
                  {link.label}
                </Link>
              ))}
              <ThemeToggle />
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
