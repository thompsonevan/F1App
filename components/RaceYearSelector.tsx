"use client";

import { useRouter } from "next/navigation";

export default function RaceYearSelector({ years, selected }: { years: string[]; selected: string }) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">Year</span>
      <select
        value={selected}
        onChange={(event) => router.push(`/races?year=${event.target.value}`)}
        className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm outline-none focus:border-red-400 dark:border-white/10 dark:bg-zinc-900"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}
