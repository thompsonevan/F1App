import Link from "next/link";
import type { QualifyingResult, Result } from "@/lib/types";
import { driverName } from "@/lib/format";

function statusOrTime(result: Result): string {
  if (result.status === "Finished" || /^\+/.test(result.status)) {
    return result.Time?.time ?? result.status;
  }
  return result.status;
}

/** Renders a result's fastest lap time, with a purple "FL" badge (matching
 * F1's own on-screen convention) for whoever set the fastest lap of the
 * race — rank "1" in the API's own ranking of every driver's fastest lap. */
function fastestLapCell(result: Result) {
  const fastestLap = result.FastestLap;
  if (!fastestLap) return <span className="text-zinc-400 dark:text-zinc-600">—</span>;

  return (
    <span className="inline-flex items-center gap-1.5">
      {fastestLap.rank === "1" && (
        <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950 dark:text-purple-400">
          FL
        </span>
      )}
      {fastestLap.Time.time}
      <span className="text-xs text-zinc-400 dark:text-zinc-600">L{fastestLap.lap}</span>
    </span>
  );
}

/** Parses a qualifying lap time like "1:12.345" or "58.945" into milliseconds. */
function parseQualifyingTimeMs(time: string): number | null {
  const parts = time.split(":");
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return minutes * 60_000 + seconds * 1000;
  }
  if (parts.length === 1) {
    const seconds = Number(parts[0]);
    if (Number.isNaN(seconds)) return null;
    return seconds * 1000;
  }
  return null;
}

/** Gap to pole's Q3 time, formatted like "+0.123" — a dash for pole itself
 * and for anyone without a Q3 time (eliminated in Q1/Q2). */
function q3GapDisplay(result: QualifyingResult, poleQ3Ms: number | null): string {
  if (result.position === "1" || !result.Q3 || poleQ3Ms === null) return "—";
  const ms = parseQualifyingTimeMs(result.Q3);
  if (ms === null) return "—";
  return `+${((ms - poleQ3Ms) / 1000).toFixed(3)}`;
}

export function RaceResultsTable({ results }: { results: Result[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-black/[.03] dark:bg-white/[.05] text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2">Pos</th>
            <th className="px-4 py-2">Driver</th>
            <th className="px-4 py-2">Constructor</th>
            <th className="px-4 py-2">Grid</th>
            <th className="px-4 py-2">Time / Status</th>
            <th className="px-4 py-2">Fastest Lap</th>
            <th className="px-4 py-2 text-right">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/10">
          {results.map((result) => (
            <tr key={result.Driver.driverId} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
              <td className="px-4 py-2 font-medium">{result.positionText}</td>
              <td className="px-4 py-2">
                <Link href={`/drivers/${result.Driver.driverId}`} className="hover:underline">
                  {driverName(result.Driver)}
                </Link>
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{result.Constructor.name}</td>
              <td className="px-4 py-2">{result.grid}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{statusOrTime(result)}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{fastestLapCell(result)}</td>
              <td className="px-4 py-2 text-right">{result.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QualifyingResultsTable({ results }: { results: QualifyingResult[] }) {
  const poleQ3 = results.find((r) => r.position === "1")?.Q3;
  const poleQ3Ms = poleQ3 ? parseQualifyingTimeMs(poleQ3) : null;

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-black/[.03] dark:bg-white/[.05] text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2">Pos</th>
            <th className="px-4 py-2">Driver</th>
            <th className="px-4 py-2">Constructor</th>
            <th className="px-4 py-2">Q1</th>
            <th className="px-4 py-2">Q2</th>
            <th className="px-4 py-2">Q3</th>
            <th className="px-4 py-2">Gap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/10">
          {results.map((result) => (
            <tr key={result.Driver.driverId} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
              <td className="px-4 py-2 font-medium">{result.position}</td>
              <td className="px-4 py-2">
                <Link href={`/drivers/${result.Driver.driverId}`} className="hover:underline">
                  {driverName(result.Driver)}
                </Link>
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{result.Constructor.name}</td>
              <td className="px-4 py-2">{result.Q1 ?? "—"}</td>
              <td className="px-4 py-2">{result.Q2 ?? "—"}</td>
              <td className="px-4 py-2">{result.Q3 ?? "—"}</td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{q3GapDisplay(result, poleQ3Ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
