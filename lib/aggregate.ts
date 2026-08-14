/**
 * Helpers to compute career/season stats from raw race results.
 * The API never returns these pre-aggregated — every number here is
 * derived by walking a driver's `Race[]` (each with a single-entry
 * `Results` array for that driver).
 */

import type { ConstructorStanding, DriverStanding, Race } from "./types";
import { driverName } from "./format";

export interface SeasonSummary {
  season: string;
  constructorNames: string[];
  races: number;
  wins: number;
  podiums: number;
  points: number;
  /** Final championship position for the season, filled in separately from standings. */
  finalPosition?: string;
}

export interface CareerTotals {
  races: number;
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  seasons: string[];
}

/** Groups a driver's career results by season, in season order. */
export function summarizeBySeasons(careerRaces: Race[]): SeasonSummary[] {
  const bySeason = new Map<string, SeasonSummary>();

  for (const race of careerRaces) {
    const result = race.Results?.[0];
    if (!result) continue;

    const summary = bySeason.get(race.season) ?? {
      season: race.season,
      constructorNames: [],
      races: 0,
      wins: 0,
      podiums: 0,
      points: 0,
    };

    summary.races += 1;
    summary.points += Number(result.points) || 0;
    if (result.position === "1") summary.wins += 1;
    if (Number(result.position) <= 3) summary.podiums += 1;
    if (!summary.constructorNames.includes(result.Constructor.name)) {
      summary.constructorNames.push(result.Constructor.name);
    }

    bySeason.set(race.season, summary);
  }

  return Array.from(bySeason.values()).sort((a, b) => Number(a.season) - Number(b.season));
}

/** Career totals aggregated across every race a driver has ever entered. */
export function summarizeCareer(careerRaces: Race[]): CareerTotals {
  const totals: CareerTotals = { races: 0, wins: 0, podiums: 0, poles: 0, points: 0, seasons: [] };
  const seasons = new Set<string>();

  for (const race of careerRaces) {
    const result = race.Results?.[0];
    if (!result) continue;

    totals.races += 1;
    totals.points += Number(result.points) || 0;
    if (result.position === "1") totals.wins += 1;
    if (Number(result.position) <= 3) totals.podiums += 1;
    // Starting grid position 1 is a pole; race-day grid penalties are rare
    // enough that this is a reasonable stand-in for a dedicated poles endpoint.
    if (result.grid === "1") totals.poles += 1;
    seasons.add(race.season);
  }

  totals.seasons = Array.from(seasons).sort((a, b) => Number(a) - Number(b));
  return totals;
}

export interface DriverSeasonRaceResult {
  round: string;
  raceName: string;
  date: string;
  grid: string;
  positionText: string;
  time?: string;
  status: string;
  points: string;
}

/**
 * Every race result for a driver, grouped by season and sorted by round —
 * the round-by-round detail behind the season-by-season summary above.
 * Built from the same `careerRaces` already fetched for that summary, so
 * showing a season's race-by-race breakdown needs no extra API calls.
 */
export function groupDriverRacesBySeason(careerRaces: Race[]): Map<string, DriverSeasonRaceResult[]> {
  const bySeason = new Map<string, DriverSeasonRaceResult[]>();

  for (const race of careerRaces) {
    const result = race.Results?.[0];
    if (!result) continue;

    const entry: DriverSeasonRaceResult = {
      round: race.round,
      raceName: race.raceName,
      date: race.date,
      grid: result.grid,
      positionText: result.positionText,
      time: result.Time?.time,
      status: result.status,
      points: result.points,
    };

    const seasonRaces = bySeason.get(race.season) ?? [];
    seasonRaces.push(entry);
    bySeason.set(race.season, seasonRaces);
  }

  for (const races of bySeason.values()) {
    races.sort((a, b) => Number(a.round) - Number(b.round));
  }

  return bySeason;
}

export interface ConstructorNamePeriod {
  name: string;
  fromSeason: string;
  toSeason: string;
}

/**
 * Some constructors keep the same `constructorId` across a sponsor/title
 * rename (e.g. Sauber → Alfa Romeo → Kick Sauber) — the single canonical
 * `/constructors/{id}` record only exposes today's name, but each season's
 * race results snapshot the name actually used *that season*. Walking
 * career results recovers that history with no guessing involved: it's
 * read straight from the data, not a curated list (contrast with
 * lib/team-lineage.ts, which handles the case where the team changed
 * `constructorId` entirely and there's no way to derive that from the API).
 */
export function summarizeConstructorNameHistory(careerRaces: Race[]): ConstructorNamePeriod[] {
  const nameBySeason = new Map<string, string>();
  for (const race of careerRaces) {
    const name = race.Results?.[0]?.Constructor.name;
    if (name && !nameBySeason.has(race.season)) {
      nameBySeason.set(race.season, name);
    }
  }

  const seasons = Array.from(nameBySeason.keys()).sort((a, b) => Number(a) - Number(b));
  const periods: ConstructorNamePeriod[] = [];

  for (const season of seasons) {
    const name = nameBySeason.get(season) as string;
    const current = periods[periods.length - 1];
    // Extends the current period only if the name matches AND the season is
    // contiguous — a gap year (even under the same name) starts a fresh
    // period rather than silently bridging over an absence.
    if (current && current.name === name && Number(season) === Number(current.toSeason) + 1) {
      current.toSeason = season;
    } else {
      periods.push({ name, fromSeason: season, toSeason: season });
    }
  }

  return periods;
}

export interface ConstructorSeasonSummary {
  season: string;
  driverNames: string[];
  races: number;
  wins: number;
  podiums: number;
  points: number;
  /** Final championship position for the season, filled in separately from standings. */
  finalPosition?: string;
}

export interface ConstructorCareerTotals {
  races: number;
  wins: number;
  podiums: number;
  points: number;
  seasons: string[];
}

/**
 * Groups a constructor's career results by season, in season order.
 *
 * Unlike a driver's results (one entry per race), a constructor's `Race`
 * carries one `Results` entry per car it fielded that race — so `races` is
 * counted once per race regardless of how many cars started, while wins,
 * podiums, and points are summed across every entry (a 1-2 finish is one
 * win but two podiums, matching how these totals are conventionally
 * reported).
 */
export function summarizeConstructorBySeasons(careerRaces: Race[]): ConstructorSeasonSummary[] {
  const bySeason = new Map<string, ConstructorSeasonSummary>();

  for (const race of careerRaces) {
    const entries = race.Results ?? [];
    if (entries.length === 0) continue;

    const summary = bySeason.get(race.season) ?? {
      season: race.season,
      driverNames: [],
      races: 0,
      wins: 0,
      podiums: 0,
      points: 0,
    };

    summary.races += 1;
    for (const entry of entries) {
      summary.points += Number(entry.points) || 0;
      if (entry.position === "1") summary.wins += 1;
      if (Number(entry.position) <= 3) summary.podiums += 1;

      const name = driverName(entry.Driver);
      if (!summary.driverNames.includes(name)) summary.driverNames.push(name);
    }

    bySeason.set(race.season, summary);
  }

  return Array.from(bySeason.values()).sort((a, b) => Number(a.season) - Number(b.season));
}

/** All-time totals aggregated across every race a constructor has ever entered. */
export function summarizeConstructorCareer(careerRaces: Race[]): ConstructorCareerTotals {
  const totals: ConstructorCareerTotals = { races: 0, wins: 0, podiums: 0, points: 0, seasons: [] };
  const seasons = new Set<string>();

  for (const race of careerRaces) {
    const entries = race.Results ?? [];
    if (entries.length === 0) continue;

    totals.races += 1;
    for (const entry of entries) {
      totals.points += Number(entry.points) || 0;
      if (entry.position === "1") totals.wins += 1;
      if (Number(entry.position) <= 3) totals.podiums += 1;
    }
    seasons.add(race.season);
  }

  totals.seasons = Array.from(seasons).sort((a, b) => Number(a) - Number(b));
  return totals;
}

export interface DriverDirectoryEntry {
  driverId: string;
  name: string;
  nationality: string;
  debutSeason: string;
  lastSeason: string;
  isCurrent: boolean;
  seasonsRaced: number;
  /** Filled in separately by mergeRaceStarts — 0 until then. */
  raceStarts: number;
  wins: number;
  points: number;
  championships: number;
}

/**
 * Builds a roster of every driver who has ever appeared in a season's
 * final standings, with career wins/points/championships and their
 * first/last season.
 *
 * This deliberately avoids the one thing it can't cheaply do: podiums and
 * poles aren't in standings data at all (only position/points/wins are),
 * and getting them for every driver in F1 history would mean a full
 * race-results fetch per driver — 860+ requests, not feasible on a single
 * page load. Wins, points, and championships, though, are all derivable
 * straight from each season's final standings entry (points/wins are
 * already season totals there, and a championship is just finishing that
 * season in position "1"), so summing/counting across every season a
 * driver appeared in gives accurate career totals with no per-driver
 * fetch at all. `seasonsRaced` counts distinct seasons the driver actually
 * appeared in standings for — not (lastSeason - debutSeason + 1), which
 * would wrongly count any gap years as raced.
 */
export function buildDriverDirectory(
  standingsBySeason: Map<string, DriverStanding[]>,
  currentSeason: string,
): DriverDirectoryEntry[] {
  const byDriver = new Map<string, DriverDirectoryEntry>();

  for (const [season, standings] of standingsBySeason) {
    for (const standing of standings) {
      const id = standing.Driver.driverId;
      const entry = byDriver.get(id) ?? {
        driverId: id,
        name: driverName(standing.Driver),
        nationality: standing.Driver.nationality,
        debutSeason: season,
        lastSeason: season,
        isCurrent: false,
        seasonsRaced: 0,
        raceStarts: 0,
        wins: 0,
        points: 0,
        championships: 0,
      };

      if (Number(season) < Number(entry.debutSeason)) entry.debutSeason = season;
      if (Number(season) > Number(entry.lastSeason)) entry.lastSeason = season;
      entry.seasonsRaced += 1;
      entry.wins += Number(standing.wins) || 0;
      entry.points += Number(standing.points) || 0;
      if (standing.position === "1") entry.championships += 1;

      byDriver.set(id, entry);
    }
  }

  for (const entry of byDriver.values()) {
    entry.isCurrent = entry.lastSeason === currentSeason;
  }

  return Array.from(byDriver.values());
}

/**
 * Counts race starts per driver from a combined set of season-wide race
 * results (see getSeasonResults). One entry in a race's `Results` array is
 * one start, so this is a straight tally — race-level data is the only
 * source with per-driver start counts at all; standings don't carry it.
 */
export function countRaceStartsByDriver(allRaces: Race[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const race of allRaces) {
    for (const result of race.Results ?? []) {
      const id = result.Driver.driverId;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return counts;
}

/** Fills in `raceStarts` on each directory entry from a driverId -> count map. */
export function mergeRaceStarts(directory: DriverDirectoryEntry[], raceStartsByDriver: Map<string, number>): void {
  for (const entry of directory) {
    entry.raceStarts = raceStartsByDriver.get(entry.driverId) ?? 0;
  }
}

export interface ConstructorDirectoryEntry {
  constructorId: string;
  name: string;
  nationality: string;
  debutSeason: string;
  lastSeason: string;
  isCurrent: boolean;
  seasonsRaced: number;
  wins: number;
  points: number;
  championships: number;
}

/**
 * Builds a roster of every constructor who has ever appeared in a season's
 * final standings, with career wins/points/championships and their
 * first/last season — the constructor equivalent of buildDriverDirectory.
 *
 * Cheaper than the driver version, deliberately: standings already carry
 * everything needed here (wins, points, and a championship is just
 * finishing a season in position "1"), with no analogous "race starts"
 * column — that would need a full per-season race-results sweep (the
 * expensive half of the driver directory's own build), and isn't worth it
 * just for a constructor headcount that's already visible as
 * `seasonsRaced`.
 *
 * `standingsBySeason` must be built from seasons in ascending order (see
 * app/api/teams/history/route.ts) — `name` is overwritten on every season a
 * constructor appears in, so the last (most recent) write wins, matching
 * what /teams/[constructorId] itself shows for a constructor that changed
 * display name under the same id over time (e.g. Sauber -> Kick Sauber).
 */
export function buildConstructorDirectory(
  standingsBySeason: Map<string, ConstructorStanding[]>,
  currentSeason: string,
): ConstructorDirectoryEntry[] {
  const byConstructor = new Map<string, ConstructorDirectoryEntry>();

  for (const [season, standings] of standingsBySeason) {
    for (const standing of standings) {
      const id = standing.Constructor.constructorId;
      const entry = byConstructor.get(id) ?? {
        constructorId: id,
        name: standing.Constructor.name,
        nationality: standing.Constructor.nationality,
        debutSeason: season,
        lastSeason: season,
        isCurrent: false,
        seasonsRaced: 0,
        wins: 0,
        points: 0,
        championships: 0,
      };

      if (Number(season) < Number(entry.debutSeason)) entry.debutSeason = season;
      if (Number(season) > Number(entry.lastSeason)) entry.lastSeason = season;
      entry.seasonsRaced += 1;
      entry.wins += Number(standing.wins) || 0;
      entry.points += Number(standing.points) || 0;
      if (standing.position === "1") entry.championships += 1;
      entry.name = standing.Constructor.name;

      byConstructor.set(id, entry);
    }
  }

  for (const entry of byConstructor.values()) {
    entry.isCurrent = entry.lastSeason === currentSeason;
  }

  return Array.from(byConstructor.values());
}

export interface ConstructorProgressionRound {
  round: string;
  raceName: string;
}

export interface ConstructorProgressionSeries {
  constructorId: string;
  name: string;
  /** Cumulative points after each round, aligned index-for-index with `rounds`. */
  points: number[];
  finalPoints: number;
}

export interface ConstructorProgression {
  rounds: ConstructorProgressionRound[];
  /** Sorted by final cumulative points, descending — the order a "Championship Progression" chart should color/legend by. */
  series: ConstructorProgressionSeries[];
}

/**
 * Cumulative constructor points after each completed round of a season —
 * the data behind a championship-progression chart. Built from the same
 * `getSeasonResults` output already used for the season's calendar/results
 * (already reassembled correctly per-race after the pagination-split bug
 * fixed in getSeasonResults itself), so this needs no extra API calls for
 * the Grand Prix side. `sprintRaces` (getSeasonSprintResults) is a second,
 * separate fetch, folded in by round — a sprint weekend awards points on
 * top of the Grand Prix, and omitting it would undercount every round from
 * a sprint weekend onward relative to the real championship total.
 *
 * Only rounds with results are included — a season's remaining, not-yet-run
 * rounds don't get a zero-points data point.
 */
export function summarizeConstructorPointsProgression(
  seasonRaces: Race[],
  sprintRaces: Race[] = [],
): ConstructorProgression {
  const completed = seasonRaces
    .filter((race) => race.Results && race.Results.length > 0)
    .slice()
    .sort((a, b) => Number(a.round) - Number(b.round));

  const rounds: ConstructorProgressionRound[] = completed.map((race) => ({
    round: race.round,
    raceName: race.raceName,
  }));

  const sprintPointsByRound = new Map<string, Map<string, number>>();
  for (const race of sprintRaces) {
    const byConstructor = new Map<string, number>();
    for (const result of race.SprintResults ?? []) {
      const id = result.Constructor.constructorId;
      byConstructor.set(id, (byConstructor.get(id) ?? 0) + (Number(result.points) || 0));
    }
    sprintPointsByRound.set(race.round, byConstructor);
  }

  // Points scored *in* each round alone, per constructor — race points plus
  // that weekend's sprint points, if any — summed below into a running
  // total. A constructor fields two cars, so a round's points for it are
  // the sum of both entries' results.
  const pointsPerRound: Map<string, number>[] = completed.map((race) => {
    const byConstructor = new Map<string, number>();
    for (const result of race.Results ?? []) {
      const id = result.Constructor.constructorId;
      byConstructor.set(id, (byConstructor.get(id) ?? 0) + (Number(result.points) || 0));
    }
    for (const [id, sprintPoints] of sprintPointsByRound.get(race.round) ?? []) {
      byConstructor.set(id, (byConstructor.get(id) ?? 0) + sprintPoints);
    }
    return byConstructor;
  });

  const namesById = new Map<string, string>();
  for (const race of completed) {
    for (const result of race.Results ?? []) {
      namesById.set(result.Constructor.constructorId, result.Constructor.name);
    }
  }
  for (const race of sprintRaces) {
    for (const result of race.SprintResults ?? []) {
      if (!namesById.has(result.Constructor.constructorId)) {
        namesById.set(result.Constructor.constructorId, result.Constructor.name);
      }
    }
  }

  const series: ConstructorProgressionSeries[] = Array.from(namesById.entries()).map(([constructorId, name]) => {
    let running = 0;
    const points = pointsPerRound.map((roundPoints) => {
      running += roundPoints.get(constructorId) ?? 0;
      return running;
    });
    return { constructorId, name, points, finalPoints: points[points.length - 1] ?? 0 };
  });

  series.sort((a, b) => b.finalPoints - a.finalPoints);

  return { rounds, series };
}
