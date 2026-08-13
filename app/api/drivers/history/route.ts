import { NextResponse } from "next/server";
import { buildDriverDirectory, countRaceStartsByDriver, mergeRaceStarts } from "@/lib/aggregate";
import { getAllSeasons, getDriverStandings, getSeasonResults } from "@/lib/f1-api";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { DriverDirectoryEntry } from "@/lib/aggregate";
import type { DriverStanding } from "@/lib/types";

// This route powers the "By Year" and "All-Time" views on /drivers. It's
// deliberately NOT part of the default /drivers fetch — it's only called
// lazily, client-side, the first time someone switches to one of those
// views — so the common case (today's standings) stays fast. Every
// individual fetch below is still cached long-term via lib/f1-api, so this
// whole thing is slow once per day at most, not once per visit.
//
// It does two full sweeps of F1 history in parallel:
//  - Every season's final driver standings (~76 requests since 1950) for
//    wins/points/championships/debut-last season (see buildDriverDirectory).
//  - Every season's full race results, paginated (~150-250+ requests,
//    since a season's results span every round × every driver) — the only
//    way to get a per-driver race-start count, since standings don't carry
//    one. This is the heavier of the two and dominates the total time.
//
// Raising maxDuration accordingly — this can legitimately run for the
// better part of a minute on a cold cache. Verify against your actual
// hosting plan's limits (e.g. Vercel Hobby vs Pro allow different caps);
// if race starts turn out to make this unreliable on your plan, the
// results-fetch half can be dropped without losing the standings-derived
// columns (wins/points/championships/years) — it fails independently and
// degrades to raceStarts: 0 rather than breaking the whole response.
export const maxDuration = 90;

const SEASON_FETCH_CONCURRENCY = 5;
const SEASON_FETCH_STAGGER_MS = 100;

export interface DriverHistoryResponse {
  seasons: string[];
  standingsBySeason: Record<string, DriverStanding[]>;
  directory: DriverDirectoryEntry[];
}

export async function GET() {
  let seasons: string[];
  try {
    const allSeasons = await getAllSeasons();
    seasons = allSeasons.map((s) => s.season).sort((a, b) => Number(a) - Number(b));
  } catch (err) {
    console.error("Failed to load season list for driver history:", err);
    return NextResponse.json({ error: "Couldn't reach the F1 data source." }, { status: 502 });
  }

  const [standingsPerSeason, resultsPerSeason] = await Promise.all([
    mapWithConcurrency(
      seasons,
      SEASON_FETCH_CONCURRENCY,
      (season) =>
        getDriverStandings(season).catch((err) => {
          console.error(`Failed to load ${season} driver standings for driver history:`, err);
          return [];
        }),
      SEASON_FETCH_STAGGER_MS,
    ),
    mapWithConcurrency(
      seasons,
      SEASON_FETCH_CONCURRENCY,
      (season) =>
        getSeasonResults(season).catch((err) => {
          console.error(`Failed to load ${season} race results for race-start counts:`, err);
          return [];
        }),
      SEASON_FETCH_STAGGER_MS,
    ),
  ]);

  const standingsBySeason = new Map<string, DriverStanding[]>();
  seasons.forEach((season, i) => {
    if (standingsPerSeason[i].length > 0) {
      standingsBySeason.set(season, standingsPerSeason[i]);
    }
  });

  if (standingsBySeason.size === 0) {
    return NextResponse.json({ error: "Couldn't reach the F1 data source." }, { status: 502 });
  }

  const currentSeason = new Date().getFullYear().toString();
  const directory = buildDriverDirectory(standingsBySeason, currentSeason);

  // Degrades gracefully: if the (much heavier) results fetch came back
  // empty, every driver just keeps raceStarts: 0 rather than the whole
  // response failing — the standings-derived columns are unaffected.
  const raceStartsByDriver = countRaceStartsByDriver(resultsPerSeason.flat());
  mergeRaceStarts(directory, raceStartsByDriver);

  return NextResponse.json<DriverHistoryResponse>({
    seasons: Array.from(standingsBySeason.keys()),
    standingsBySeason: Object.fromEntries(standingsBySeason),
    directory,
  });
}
