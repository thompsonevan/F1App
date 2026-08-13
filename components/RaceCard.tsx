import Link from "next/link";
import type { Race } from "@/lib/types";
import { formatDate, raceDateTime } from "@/lib/format";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function RaceCard({ race }: { race: Race }) {
  // Every page that renders this card is dynamic, so it re-executes fresh
  // per request — comparing against the current time here is intentional.
  // eslint-disable-next-line react-hooks/purity
  const isCompleted = raceDateTime(race.date, race.time).getTime() < Date.now();
  const podium = race.Results?.slice(0, 3) ?? [];

  return (
    <Link
      href={`/races/${race.season}/${race.round}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-black/10 px-4 py-3 transition-colors hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
    >
      <div className="flex items-center gap-4">
        <span className="w-8 shrink-0 text-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          {race.round}
        </span>
        <div>
          <p className="font-medium">{race.raceName}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {race.Circuit.circuitName} · {race.Circuit.Location.locality}, {race.Circuit.Location.country}
          </p>
          {podium.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-zinc-700 dark:text-zinc-300">
              {podium.map((result, i) => (
                <span key={result.Driver.driverId}>
                  {MEDALS[i]} {result.Driver.familyName}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{formatDate(race.date)}</span>
        <span
          className={
            isCompleted
              ? "rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400"
          }
        >
          {isCompleted ? "Completed" : "Upcoming"}
        </span>
      </div>
    </Link>
  );
}
