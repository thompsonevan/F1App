import Link from "next/link";
import type { QualifyingResult, Result } from "@/lib/types";
import { driverName } from "@/lib/format";

function statusOrTime(result: Result): string {
  if (result.status === "Finished" || /^\+/.test(result.status)) {
    return result.Time?.time ?? result.status;
  }
  return result.status;
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
              <td className="px-4 py-2 text-right">{result.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QualifyingResultsTable({ results }: { results: QualifyingResult[] }) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
