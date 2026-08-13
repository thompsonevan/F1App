import { NextResponse } from "next/server";
import { buildDriverDirectory } from "@/lib/aggregate";
import { getAllSeasons, getDriverStandings } from "@/lib/f1-api";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { DriverDirectoryEntry } from "@/lib/aggregate";
import type { DriverStanding } from "@/lib/types";

// This route fetches every season's final driver standings (~76 requests
// since 1950) to power two views on /drivers: browsing any single season,
// and an all-time roster with career wins/points. It's deliberately NOT
// the default data for /drivers — it's only called lazily, client-side,
// the first time a user switches to one of those views — so the common
// case (today's standings) stays fast. Each individual season fetch is
// still cached long-term via lib/f1-api, so this is slow once per day at
// most, not once per visit.
//
// Raising maxDuration since this can legitimately take longer than a
// serverless function's default timeout — verify this against your actual
// hosting plan's limits (e.g. Vercel Hobby vs Pro allow different caps).
export const maxDuration = 60;

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

  const standingsPerSeason = await mapWithConcurrency(
    seasons,
    SEASON_FETCH_CONCURRENCY,
    (season) =>
      getDriverStandings(season).catch((err) => {
        console.error(`Failed to load ${season} driver standings for driver history:`, err);
        return [];
      }),
    SEASON_FETCH_STAGGER_MS,
  );

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

  return NextResponse.json<DriverHistoryResponse>({
    seasons: Array.from(standingsBySeason.keys()),
    standingsBySeason: Object.fromEntries(standingsBySeason),
    directory,
  });
}
