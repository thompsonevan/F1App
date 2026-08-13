/**
 * Helpers to compute career/season stats from raw race results.
 * The API never returns these pre-aggregated — every number here is
 * derived by walking a driver's `Race[]` (each with a single-entry
 * `Results` array for that driver).
 */

import type { Race } from "./types";
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
