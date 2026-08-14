import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDriver } from "@/lib/f1-api";
import { groupDriverRacesBySeason } from "@/lib/aggregate";
import { getDriverProfile } from "@/lib/driver-profile";
import { driverName, formatDate } from "@/lib/format";
import DriverSeasonExplorer from "@/components/DriverSeasonExplorer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ driverId: string }>;
}): Promise<Metadata> {
  const { driverId } = await params;
  // Same call as the page component below — Next dedupes identical fetches
  // within a render pass, so this doesn't cost a second round trip.
  const driver = await getDriver(driverId);
  if (!driver) return {};

  return {
    title: driverName(driver),
    description: `${driverName(driver)} — F1 career stats, season-by-season results, and career totals.`,
  };
}

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ driverId: string }>;
}) {
  const { driverId } = await params;
  const profile = await getDriverProfile(driverId);
  if (!profile) notFound();
  const { driver, careerRaces, seasonSummaries, careerTotals, championships } = profile;

  const racesBySeason = Object.fromEntries(groupDriverRacesBySeason(careerRaces));
  const mostRecentSeason = seasonSummaries[seasonSummaries.length - 1]?.season;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{driverName(driver)}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {driver.nationality} · Born {formatDate(driver.dateOfBirth)}
            {driver.permanentNumber && <> · #{driver.permanentNumber}</>}
            {driver.code && <> · {driver.code}</>}
          </p>
        </div>
        <Link
          href={`/drivers/compare?driver1=${driver.driverId}`}
          className="shrink-0 rounded-full border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
        >
          Compare with another driver →
        </Link>
      </div>

      {mostRecentSeason && (
        <DriverSeasonExplorer
          seasons={seasonSummaries}
          racesBySeason={racesBySeason}
          defaultSeason={mostRecentSeason}
        />
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Season by Season</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-black/[.03] dark:bg-white/[.05] text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Year</th>
                <th className="px-4 py-2">Team</th>
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
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {summary.constructorNames.join(" / ")}
                    </td>
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
        <h2 className="mb-3 text-lg font-semibold">Career Totals</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <Stat label="Seasons" value={careerTotals.seasons.length} />
          <Stat label="Races" value={careerTotals.races} />
          <Stat label="Wins" value={careerTotals.wins} />
          <Stat label="Podiums" value={careerTotals.podiums} />
          <Stat label="Poles" value={careerTotals.poles} />
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
