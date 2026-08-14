import { getDriver, getDriverCareerResults, getDriverStandings } from "./f1-api";
import { summarizeBySeasons, summarizeCareer, type CareerTotals, type SeasonSummary } from "./aggregate";
import { mapWithConcurrency } from "./concurrency";
import type { Driver, Race } from "./types";

/** Cap on concurrent per-season standings requests, plus a stagger between
 * each slot's start — kept conservative on purpose. A long career means a
 * slower load, but that's preferable to tripping Jolpica's rate limit. */
const STANDINGS_FETCH_CONCURRENCY = 2;
const STANDINGS_FETCH_STAGGER_MS = 150;

export interface DriverProfile {
  driver: Driver;
  careerRaces: Race[];
  seasonSummaries: SeasonSummary[];
  careerTotals: CareerTotals;
  championships: number;
}

/**
 * Everything a driver's own detail page and the head-to-head comparison
 * page both need: career totals, season-by-season summaries (with
 * `finalPosition` filled in from standings), and a championship count.
 * Centralized here so both pages compute "championships" the same way
 * instead of two copies of the same standings-fetch-and-match logic
 * drifting apart. Returns null if the driverId doesn't exist.
 */
export async function getDriverProfile(driverId: string): Promise<DriverProfile | null> {
  const driver = await getDriver(driverId);
  if (!driver) return null;

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

  return { driver, careerRaces, seasonSummaries, careerTotals, championships };
}
