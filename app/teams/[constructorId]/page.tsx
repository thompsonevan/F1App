import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConstructor, getConstructorCareerResults, getConstructorStandings } from "@/lib/f1-api";
import {
  summarizeConstructorBySeasons,
  summarizeConstructorCareer,
  summarizeConstructorNameHistory,
} from "@/lib/aggregate";
import { mapWithConcurrency } from "@/lib/concurrency";

/** Cap on concurrent per-season standings requests, plus a stagger between
 * each slot's start — kept conservative on purpose. A long history means a
 * slower load, but that's preferable to tripping Jolpica's rate limit. */
const STANDINGS_FETCH_CONCURRENCY = 2;
const STANDINGS_FETCH_STAGGER_MS = 150;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ constructorId: string }>;
}): Promise<Metadata> {
  const { constructorId } = await params;
  // Same call as the page component below — deduped by Next's fetch cache.
  const constructor = await getConstructor(constructorId);
  if (!constructor) return {};

  return {
    title: constructor.name,
    description: `${constructor.name} — F1 constructor stats, season-by-season results, and all-time totals.`,
  };
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ constructorId: string }>;
}) {
  const { constructorId } = await params;

  const constructor = await getConstructor(constructorId);
  if (!constructor) notFound();

  // No team-lineage rollup for now — this page covers only races filed
  // under this exact constructorId, not any former/renamed identity.
  const careerRaces = await getConstructorCareerResults(constructorId).catch((err) => {
    console.error(`Failed to load career results for constructor ${constructorId}:`, err);
    return [];
  });

  const seasonSummaries = summarizeConstructorBySeasons(careerRaces);
  const careerTotals = summarizeConstructorCareer(careerRaces);
  // Fully data-driven — no lineage config involved. Catches both a rename
  // under this exact constructorId (e.g. Sauber -> Alfa Romeo) and any
  // curated former identities merged in above.
  const nameHistory = summarizeConstructorNameHistory(careerRaces);

  // The results endpoint doesn't return final championship position, so
  // pull standings per season the team (under any of its lineage's ids)
  // competed in, with capped/staggered concurrency so a long history
  // doesn't burst past the API's rate limit.
  const standingsPerSeason = await mapWithConcurrency(
    seasonSummaries,
    STANDINGS_FETCH_CONCURRENCY,
    (summary) =>
      getConstructorStandings(summary.season).catch((err) => {
        console.error(`Failed to load ${summary.season} standings for constructor ${constructorId}:`, err);
        return [];
      }),
    STANDINGS_FETCH_STAGGER_MS,
  );

  let championships = 0;
  seasonSummaries.forEach((summary, i) => {
    const standing = standingsPerSeason[i].find((s) => s.Constructor.constructorId === constructorId);
    if (standing) {
      summary.finalPosition = standing.position;
      if (standing.position === "1") championships += 1;
    }
  });

  const currentYear = new Date().getFullYear().toString();
  const currentSeason = seasonSummaries.find((s) => s.season === currentYear);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{constructor.name}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{constructor.nationality}</p>
        {nameHistory.length > 1 && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            Also raced as{" "}
            {nameHistory
              .slice(0, -1)
              .map((period) => `${period.name} (${period.fromSeason}–${period.toSeason})`)
              .join(", ")}
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Current Season</h2>
        {currentSeason ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Position" value={currentSeason.finalPosition ?? "—"} />
            <Stat label="Points" value={currentSeason.points} />
            <Stat label="Wins" value={currentSeason.wins} />
            <Stat label="Podiums" value={currentSeason.podiums} />
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Not competing this season.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Season by Season</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-black/[.03] dark:bg-white/[.05] text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Year</th>
                <th className="px-4 py-2">Drivers</th>
                <th className="px-4 py-2 text-right">Points</th>
                <th className="px-4 py-2 text-right">Position</th>
                <th className="px-4 py-2 text-right">Wins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {seasonSummaries
                .slice()
                .reverse()
                .map((summary) => (
                  <tr key={summary.season} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/seasons/${summary.season}`} className="hover:underline">
                        {summary.season}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{summary.driverNames.join(" / ")}</td>
                    <td className="px-4 py-2 text-right">{summary.points}</td>
                    <td className="px-4 py-2 text-right">{summary.finalPosition ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{summary.wins}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">All-Time Totals</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Races" value={careerTotals.races} />
          <Stat label="Wins" value={careerTotals.wins} />
          <Stat label="Podiums" value={careerTotals.podiums} />
          <Stat label="Points" value={careerTotals.points} />
          <Stat label="Championships" value={championships} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
