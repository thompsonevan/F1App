import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCircuitResults, getQualifyingResults, getRaceResults } from "@/lib/f1-api";
import { QualifyingResultsTable, RaceResultsTable } from "@/components/ResultsTable";
import { driverName, f1tvSearchUrl, formatDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; round: string }>;
}): Promise<Metadata> {
  const { year, round } = await params;
  // Same call as the page component below — deduped by Next's fetch cache.
  const race = await getRaceResults(year, round);
  if (!race) return {};

  return {
    title: `${race.raceName} ${race.season}`,
    description: `${race.raceName} (${race.season}) at ${race.Circuit.circuitName} — results, qualifying, and circuit history.`,
  };
}

export default async function RaceDetailPage({
  params,
}: {
  params: Promise<{ year: string; round: string }>;
}) {
  const { year, round } = await params;
  const race = await getRaceResults(year, round);

  if (!race) notFound();

  const [qualifying, circuitHistory] = await Promise.all([
    getQualifyingResults(year, round),
    getCircuitResults(race.Circuit.circuitId),
  ]);

  const pastSeasonsAtCircuit = circuitHistory
    .filter((r) => r.season !== year)
    .sort((a, b) => Number(b.season) - Number(a.season));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Round {race.round} · {race.season}
          </p>
          <h1 className="text-2xl font-bold">{race.raceName}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {race.Circuit.circuitName} · {race.Circuit.Location.locality}, {race.Circuit.Location.country} ·{" "}
            {formatDate(race.date)}
          </p>
        </div>
        <a
          href={f1tvSearchUrl(race.season, race.raceName)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Watch on F1TV ↗
        </a>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Race Results</h2>
        {race.Results && race.Results.length > 0 ? (
          <RaceResultsTable results={race.Results} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Results aren&apos;t available yet.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Qualifying</h2>
        {qualifying?.QualifyingResults && qualifying.QualifyingResults.length > 0 ? (
          <QualifyingResultsTable results={qualifying.QualifyingResults} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Qualifying results aren&apos;t available yet.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Past Seasons at {race.Circuit.circuitName}</h2>
        {pastSeasonsAtCircuit.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-black/[.03] dark:bg-white/[.05] text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2">Year</th>
                  <th className="px-4 py-2">Race</th>
                  <th className="px-4 py-2">Winner</th>
                  <th className="px-4 py-2">Constructor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {pastSeasonsAtCircuit.map((r) => {
                  const winner = r.Results?.[0];
                  return (
                    <tr key={`${r.season}-${r.round}`} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                      <td className="px-4 py-2 font-medium">
                        <Link href={`/races/${r.season}/${r.round}`} className="hover:underline">
                          {r.season}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{r.raceName}</td>
                      <td className="px-4 py-2">{winner ? driverName(winner.Driver) : "—"}</td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {winner?.Constructor.name ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            This is the first time this circuit has hosted a race.
          </p>
        )}
      </section>
    </div>
  );
}
