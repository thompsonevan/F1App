"use client";

import Link from "next/link";
import { useState } from "react";
import type { DriverSeasonRaceResult, SeasonSummary } from "@/lib/aggregate";
import { formatDate } from "@/lib/format";

function statusOrTime(race: DriverSeasonRaceResult): string {
  if (race.status === "Finished" || /^\+/.test(race.status)) {
    return race.time ?? race.status;
  }
  return race.status;
}

interface DriverSeasonExplorerProps {
  seasons: SeasonSummary[];
  racesBySeason: Record<string, DriverSeasonRaceResult[]>;
  defaultSeason: string;
}

export default function DriverSeasonExplorer({ seasons, racesBySeason, defaultSeason }: DriverSeasonExplorerProps) {
  const [selectedSeason, setSelectedSeason] = useState(defaultSeason);

  const summary = seasons.find((s) => s.season === selectedSeason);
  const races = racesBySeason[selectedSeason] ?? [];

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Season Results</h2>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Year</span>
          <select
            value={selectedSeason}
            onChange={(event) => setSelectedSeason(event.target.value)}
            className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm outline-none focus:border-red-400 dark:border-white/10 dark:bg-zinc-900"
          >
            {seasons
              .slice()
              .reverse()
              .map((s) => (
                <option key={s.season} value={s.season}>
                  {s.season}
                </option>
              ))}
          </select>
        </label>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Position" value={summary.finalPosition ?? "—"} />
          <Stat label="Points" value={summary.points} />
          <Stat label="Wins" value={summary.wins} />
          <Stat label="Podiums" value={summary.podiums} />
        </div>
      )}

      {races.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-black/[.03] dark:bg-white/[.05] text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Round</th>
                <th className="px-4 py-2">Race</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Grid</th>
                <th className="px-4 py-2">Finish</th>
                <th className="px-4 py-2">Time / Status</th>
                <th className="px-4 py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {races.map((race) => (
                <tr key={race.round} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                  <td className="px-4 py-2 font-medium">{race.round}</td>
                  <td className="px-4 py-2">
                    <Link href={`/races/${selectedSeason}/${race.round}`} className="hover:underline">
                      {race.raceName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{formatDate(race.date)}</td>
                  <td className="px-4 py-2">{race.grid}</td>
                  <td className="px-4 py-2">{race.positionText}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{statusOrTime(race)}</td>
                  <td className="px-4 py-2 text-right">{race.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No race results for {selectedSeason}.</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
