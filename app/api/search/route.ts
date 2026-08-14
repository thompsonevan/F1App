import { NextRequest, NextResponse } from "next/server";
import { getAllConstructors, getAllDrivers, getAllSeasons, getCurrentSeasonSchedule } from "@/lib/f1-api";
import { driverName } from "@/lib/format";

export interface SearchResult {
  type: "driver" | "race" | "season" | "team";
  id: string;
  label: string;
  sub?: string;
  href: string;
}

export interface SearchResponse {
  drivers: SearchResult[];
  races: SearchResult[];
  teams: SearchResult[];
  seasons: SearchResult[];
}

const RESULTS_PER_GROUP = 6;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (query.length === 0) {
    return NextResponse.json<SearchResponse>({ drivers: [], races: [], teams: [], seasons: [] });
  }

  // Each of these hits lib/f1-api's own fetch cache, so beyond the very
  // first search after a deploy this is served from cache, not a live
  // round trip to Jolpica on every keystroke.
  const [drivers, constructors, seasons, currentSeasonRaces] = await Promise.all([
    getAllDrivers().catch(() => []),
    getAllConstructors().catch(() => []),
    getAllSeasons().catch(() => []),
    getCurrentSeasonSchedule().catch(() => []),
  ]);

  const matchedDrivers: SearchResult[] = drivers
    .filter(
      (driver) =>
        driverName(driver).toLowerCase().includes(query) ||
        driver.code?.toLowerCase() === query ||
        driver.driverId.toLowerCase().includes(query),
    )
    .slice(0, RESULTS_PER_GROUP)
    .map((driver) => ({
      type: "driver",
      id: driver.driverId,
      label: driverName(driver),
      sub: driver.nationality,
      href: `/drivers/${driver.driverId}`,
    }));

  // `constructors` includes every historical id — e.g. "jordan" and
  // "aston_martin" both appear as separate rows — and each gets its own
  // page for now, with no team-lineage rollup pointing former ids at a
  // current team's page.
  const matchedTeams: SearchResult[] = constructors
    .filter(
      (constructor) =>
        constructor.name.toLowerCase().includes(query) ||
        constructor.nationality.toLowerCase().includes(query) ||
        constructor.constructorId.toLowerCase().includes(query),
    )
    .slice(0, RESULTS_PER_GROUP)
    .map((constructor) => ({
      type: "team",
      id: constructor.constructorId,
      label: constructor.name,
      sub: constructor.nationality,
      href: `/teams/${constructor.constructorId}`,
    }));

  const matchedSeasons: SearchResult[] = seasons
    .filter((season) => season.season.startsWith(query))
    .sort((a, b) => Number(b.season) - Number(a.season))
    .slice(0, RESULTS_PER_GROUP)
    .map((season) => ({
      type: "season",
      id: season.season,
      label: `${season.season} Season`,
      href: `/seasons/${season.season}`,
    }));

  // Race search is scoped to the current season's calendar, matching what
  // `/races` itself shows — searching every race since 1950 would mean
  // fetching every season's schedule on each query.
  const matchedRaces: SearchResult[] = currentSeasonRaces
    .filter(
      (race) =>
        race.raceName.toLowerCase().includes(query) ||
        race.Circuit.circuitName.toLowerCase().includes(query) ||
        race.Circuit.Location.locality.toLowerCase().includes(query) ||
        race.Circuit.Location.country.toLowerCase().includes(query),
    )
    .slice(0, RESULTS_PER_GROUP)
    .map((race) => ({
      type: "race",
      id: `${race.season}-${race.round}`,
      label: race.raceName,
      sub: `${race.Circuit.circuitName} · ${race.Circuit.Location.country}`,
      href: `/races/${race.season}/${race.round}`,
    }));

  return NextResponse.json<SearchResponse>({
    drivers: matchedDrivers,
    races: matchedRaces,
    teams: matchedTeams,
    seasons: matchedSeasons,
  });
}
