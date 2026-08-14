"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "theme";
const CYCLE: ThemePreference[] = ["system", "light", "dark"];
const ICONS: Record<ThemePreference, string> = {
  system: "🖥️",
  light: "☀️",
  dark: "🌙",
};

function applyTheme(preference: ThemePreference) {
  const isDark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

/** Manual light/dark/system switcher, cycling system -> light -> dark on
 * click. Starts at "system" to match the server-rendered markup (there's no
 * localStorage during SSR) and is synced to the real stored preference in
 * an effect right after mount — by then the blocking init script in
 * app/layout.tsx has already applied the right `.dark` class to <html>, so
 * this only needs to catch its own display up, not re-decide the theme. */
export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") setPreference(stored);
  }, []);

  // While on "system", stay in sync if the OS preference changes mid-session.
  useEffect(() => {
    if (preference !== "system") return;
    applyTheme("system");
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(preference) + 1) % CYCLE.length];
    setPreference(next);
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-sm hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.05]"
      aria-label={`Theme: ${preference}. Click to change.`}
      title={`Theme: ${preference}`}
    >
      <span aria-hidden>{ICONS[preference]}</span>
    </button>
  );
}
