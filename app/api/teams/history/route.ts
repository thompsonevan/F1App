import { NextResponse } from "next/server";
import { buildConstructorDirectory } from "@/lib/aggregate";
import { getAllSeasons, getConstructorStandings } from "@/lib/f1-api";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { ConstructorDirectoryEntry } from "@/lib/aggregate";
import type { ConstructorStanding } from "@/lib/types";

// This route powers the "By Year" and "All-Time" views on /teams, mirroring
// app/api/drivers/history/route.ts — lazily fetched client-side the first
// time someone switches to one of those views, so the default /teams load
// (today's standings) stays fast.
//
// Deliberately cheaper than the driver history route: it's a single sweep
// of every season's final constructor standings (~76 requests since 1950)
// — wins/points/championships/debut-last season all come straight from
// that, with no second, much heavier sweep of every season's full race
// results (the driver route only needs that for a per-driver race-start
// count, which has no constructor equivalent here — see
// buildConstructorDirectory). ~200 constructors in F1 history vs 860+
// drivers keeps the RESPONSE small even on a cold cache — but the fetch
// side turned out not to be fast: verified live, an initial cold-cache run
// at concurrency 5 (this route's first draft) hit heavy 429s from Jolpica
// and took the full 90s before completing. Dropped to concurrency 2 with a
// longer stagger — matching the per-driver/constructor standings fetch
// used on individual detail pages — on the reasoning that fewer concurrent
// requests means fewer 429s and less time lost to backoff, not just a
// gentler ask of a free public API; that specific change hasn't been
// re-measured cold (the cache from the concurrency-5 run was still warm),
// so maxDuration stays generous rather than assuming the fix worked.
export const maxDuration = 120;

const SEASON_FETCH_CONCURRENCY = 2;
const SEASON_FETCH_STAGGER_MS = 150;

export interface ConstructorHistoryResponse {
  seasons: string[];
  standingsBySeason: Record<string, ConstructorStanding[]>;
  directory: ConstructorDirectoryEntry[];
}

export async function GET() {
  let seasons: string[];
  try {
    const allSeasons = await getAllSeasons();
    seasons = allSeasons.map((s) => s.season).sort((a, b) => Number(a) - Number(b));
  } catch (err) {
    console.error("Failed to load season list for constructor history:", err);
    return NextResponse.json({ error: "Couldn't reach the F1 data source." }, { status: 502 });
  }

  const standingsPerSeason = await mapWithConcurrency(
    seasons,
    SEASON_FETCH_CONCURRENCY,
    (season) =>
      getConstructorStandings(season).catch((err) => {
        console.error(`Failed to load ${season} constructor standings for team history:`, err);
        return [];
      }),
    SEASON_FETCH_STAGGER_MS,
  );

  const standingsBySeason = new Map<string, ConstructorStanding[]>();
  seasons.forEach((season, i) => {
    if (standingsPerSeason[i].length > 0) {
      standingsBySeason.set(season, standingsPerSeason[i]);
    }
  });

  if (standingsBySeason.size === 0) {
    return NextResponse.json({ error: "Couldn't reach the F1 data source." }, { status: 502 });
  }

  const currentSeason = new Date().getFullYear().toString();
  const directory = buildConstructorDirectory(standingsBySeason, currentSeason);

  return NextResponse.json<ConstructorHistoryResponse>({
    seasons: Array.from(standingsBySeason.keys()),
    standingsBySeason: Object.fromEntries(standingsBySeason),
    directory,
  });
}
