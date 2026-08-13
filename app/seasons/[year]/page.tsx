import { notFound } from "next/navigation";
import {
  getConstructorStandings,
  getDriverStandings,
  getSeasonResults,
  getSeasonSchedule,
  mergeRaceResults,
} from "@/lib/f1-api";
import RaceCard from "@/components/RaceCard";
import StandingsTable from "@/components/StandingsTable";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const schedule = await getSeasonSchedule(year).catch(() => null);

  if (!schedule || schedule.length === 0) notFound();

  const [driverStandings, constructorStandings, results] = await Promise.all([
    getDriverStandings(year).catch(() => []),
    getConstructorStandings(year).catch(() => []),
    getSeasonResults(year).catch(() => []),
  ]);

  const races = mergeRaceResults(schedule, results);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{year} Season</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{schedule.length} rounds</p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Final Driver Standings</h2>
          {driverStandings.length > 0 ? (
            <StandingsTable type="driver" standings={driverStandings} />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Standings not available for this season.</p>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Final Constructor Standings</h2>
          {constructorStandings.length > 0 ? (
            <StandingsTable type="constructor" standings={constructorStandings} />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Standings not available for this season.</p>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Calendar</h2>
        <div className="flex flex-col gap-2">
          {races.map((race) => (
            <RaceCard key={`${race.season}-${race.round}`} race={race} />
          ))}
        </div>
      </section>
    </div>
  );
}
