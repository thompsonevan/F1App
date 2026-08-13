import { notFound } from "next/navigation";
import { getDriver, getDriverCareerResults, getDriverStandings } from "@/lib/f1-api";
import { summarizeBySeasons, summarizeCareer } from "@/lib/aggregate";
import { mapWithConcurrency } from "@/lib/concurrency";
import { driverName, formatDate } from "@/lib/format";

/** Cap on concurrent per-season standings requests, plus a stagger between
 * each slot's start — kept conservative on purpose. A long career means a
 * slower load, but that's preferable to tripping Jolpica's rate limit. */
const STANDINGS_FETCH_CONCURRENCY = 2;
const STANDINGS_FETCH_STAGGER_MS = 150;

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ driverId: string }>;
}) {
  const { driverId } = await params;
  const driver = await getDriver(driverId);
  if (!driver) notFound();

  const careerRaces = await getDriverCareerResults(driverId);
  const seasonSummaries = summarizeBySeasons(careerRaces);
  const careerTotals = summarizeCareer(careerRaces);

  // The results endpoint doesn't return final championship position, so pull
  // standings for each season the driver raced in and match it up. Fetched
  // with capped, staggered concurrency (rather than one giant Promise.all)
  // so a long career doesn't burst past the API's rate limit and silently
  // lose years — f1Fetch already retries transient failures (with a real
  // new request each time, not a memoized replay of the same failure), so
  // a season only ends up empty here if it genuinely has no standings data.
  const standingsPerSeason = await mapWithConcurrency(
    seasonSummaries,
    STANDINGS_FETCH_CONCURRENCY,
    (summary) =>
      getDriverStandings(summary.season).catch((err) => {
        console.error(`Failed to load ${summary.season} standings for driver ${driverId}:`, err);
        return [];
      }),
    STANDINGS_FETCH_STAGGER_MS,
  );

  let championships = 0;
  seasonSummaries.forEach((summary, i) => {
    const standing = standingsPerSeason[i].find((s) => s.Driver.driverId === driverId);
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
        <h1 className="text-2xl font-bold">{driverName(driver)}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {driver.nationality} · Born {formatDate(driver.dateOfBirth)}
          {driver.permanentNumber && <> · #{driver.permanentNumber}</>}
          {driver.code && <> · {driver.code}</>}
        </p>
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
                    <td className="px-4 py-2 font-medium">{summary.season}</td>
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
