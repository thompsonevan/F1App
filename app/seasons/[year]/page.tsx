import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getConstructorStandings,
  getDriverStandings,
  getSeasonResults,
  getSeasonSchedule,
  getSeasonSprintResults,
  mergeRaceResults,
} from "@/lib/f1-api";
import { summarizeConstructorPointsProgression } from "@/lib/aggregate";
import RaceCard from "@/components/RaceCard";
import StandingsProgressionChart from "@/components/StandingsProgressionChart";
import StandingsTable from "@/components/StandingsTable";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  return {
    title: `${year} Season`,
    description: `${year} F1 season — final driver and constructor standings, and the full race calendar.`,
  };
}

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const schedule = await getSeasonSchedule(year).catch(() => null);

  if (!schedule || schedule.length === 0) notFound();

  const [driverStandings, constructorStandings, results, sprintResults] = await Promise.all([
    getDriverStandings(year).catch(() => []),
    getConstructorStandings(year).catch(() => []),
    getSeasonResults(year).catch(() => []),
    getSeasonSprintResults(year).catch(() => []),
  ]);

  const races = mergeRaceResults(schedule, results);
  const progression = summarizeConstructorPointsProgression(results, sprintResults);
  const officialFinalPointsById = new Map(
    constructorStandings.map((standing) => [standing.Constructor.constructorId, Number(standing.points)]),
  );

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

      {progression.series.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Championship Progression</h2>
          <StandingsProgressionChart progression={progression} officialFinalPointsById={officialFinalPointsById} />
        </section>
      )}

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
