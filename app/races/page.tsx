import { getAllSeasons, getCurrentSeasonSchedule, getSeasonResults, getSeasonSchedule, mergeRaceResults } from "@/lib/f1-api";
import RaceCard from "@/components/RaceCard";
import RaceYearSelector from "@/components/RaceYearSelector";

export const dynamic = "force-dynamic";

export default async function RacesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;

  const [seasons, schedule, results] = await Promise.all([
    getAllSeasons(),
    year ? getSeasonSchedule(year) : getCurrentSeasonSchedule(),
    getSeasonResults(year ?? "current").catch(() => []),
  ]);

  const races = mergeRaceResults(schedule, results);
  const seasonYears = seasons.map((s) => s.season).sort((a, b) => Number(b) - Number(a));
  const selectedYear = year ?? schedule[0]?.season ?? seasonYears[0] ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Races</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {schedule.length > 0
              ? `${selectedYear} season calendar — ${schedule.length} rounds`
              : `No calendar data available for ${selectedYear}`}
          </p>
        </div>
        {seasonYears.length > 0 && <RaceYearSelector years={seasonYears} selected={selectedYear} />}
      </div>
      <div className="flex flex-col gap-2">
        {races.map((race) => (
          <RaceCard key={`${race.season}-${race.round}`} race={race} />
        ))}
      </div>
    </div>
  );
}
