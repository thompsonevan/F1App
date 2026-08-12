import Link from "next/link";
import { getConstructorStandings, getCurrentSeasonSchedule, getDriverStandings, getRaceResults } from "@/lib/f1-api";
import StandingsTable from "@/components/StandingsTable";
import CountdownNextRace from "@/components/CountdownNextRace";
import { driverName, formatDate, raceDateTime } from "@/lib/format";

// Standings and the next/last race change throughout a race weekend, so this
// page renders per-request; the individual f1-api calls still cache via
// `fetch`'s `revalidate` window underneath.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [schedule, driverStandings, constructorStandings] = await Promise.all([
    getCurrentSeasonSchedule(),
    getDriverStandings("current"),
    getConstructorStandings("current"),
  ]);

  // This page is `force-dynamic`, so it already re-executes fresh on every
  // request — reading the current time here is intentional, not accidental.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const completedRaces = schedule.filter((race) => raceDateTime(race.date, race.time).getTime() < now);
  const upcomingRaces = schedule.filter((race) => raceDateTime(race.date, race.time).getTime() >= now);
  const lastRace = completedRaces[completedRaces.length - 1];
  const nextRace = upcomingRaces[0];
  const currentRound = Math.min(completedRaces.length + 1, schedule.length);

  const lastRaceDetail = lastRace ? await getRaceResults(lastRace.season, lastRace.round) : null;
  const podium = lastRaceDetail?.Results?.slice(0, 3) ?? [];

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="mb-1 text-2xl font-bold">Season {schedule[0]?.season ?? ""}</h1>
        {schedule.length > 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Round {currentRound} of {schedule.length}
          </p>
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-black/10 p-5 dark:border-white/10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Last Race
          </h2>
          {lastRace ? (
            <>
              <p className="text-lg font-semibold">{lastRace.raceName}</p>
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{formatDate(lastRace.date)}</p>
              <ol className="mb-3 space-y-1">
                {podium.map((result, i) => (
                  <li key={result.Driver.driverId} className="flex justify-between text-sm">
                    <span>
                      {i + 1}. {driverName(result.Driver)}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">{result.Constructor.name}</span>
                  </li>
                ))}
              </ol>
              <Link
                href={`/races/${lastRace.season}/${lastRace.round}`}
                className="text-sm text-red-600 hover:underline dark:text-red-400"
              >
                Full results →
              </Link>
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No races completed yet this season.</p>
          )}
        </div>

        <div className="rounded-lg border border-black/10 p-5 dark:border-white/10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Next Race
          </h2>
          {nextRace ? (
            <>
              <p className="text-lg font-semibold">{nextRace.raceName}</p>
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                {nextRace.Circuit.circuitName} · {nextRace.Circuit.Location.locality}, {nextRace.Circuit.Location.country}
              </p>
              <CountdownNextRace targetIso={`${nextRace.date}T${nextRace.time ?? "00:00:00Z"}`} />
            </>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Season complete — no races remaining.</p>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Driver Standings</h2>
        <StandingsTable type="driver" standings={driverStandings} limit={10} viewAllHref="/drivers" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Constructor Standings</h2>
        <StandingsTable type="constructor" standings={constructorStandings} limit={10} />
      </section>
    </div>
  );
}
