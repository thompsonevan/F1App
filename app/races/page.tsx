import { getCurrentSeasonSchedule } from "@/lib/f1-api";
import RaceCard from "@/components/RaceCard";

export const dynamic = "force-dynamic";

export default async function RacesPage() {
  const schedule = await getCurrentSeasonSchedule();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Races</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {schedule[0]?.season} season calendar — {schedule.length} rounds
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {schedule.map((race) => (
          <RaceCard key={`${race.season}-${race.round}`} race={race} />
        ))}
      </div>
    </div>
  );
}
