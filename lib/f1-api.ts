/**
 * Typed client for the Jolpica-F1 API (open-source, Ergast-compatible).
 * https://api.jolpi.ca/ergast/f1/ — free, no API key, data back to 1950.
 *
 * Caching strategy: every call goes through Next.js `fetch` with a
 * `revalidate` window. Historical/finished data (past seasons, completed
 * races) is cached for a long time since it never changes. Current-season
 * data (standings, upcoming schedule) uses a short window so the dashboard
 * stays reasonably fresh without hammering the upstream API.
 */

import type {
  CircuitTable,
  Constructor,
  ConstructorTable,
  Driver,
  DriverTable,
  MRData,
  Race,
  RaceTable,
  Season,
  SeasonTable,
  StandingsTable,
} from "./types";

const BASE_URL = "https://api.jolpi.ca/ergast/f1";

/** 1 day — for data that is finished and will never change. */
export const REVALIDATE_LONG = 60 * 60 * 24;
/** 1 hour — for current-season standings, next race, in-progress data. */
export const REVALIDATE_SHORT = 60 * 60;

const MAX_PAGE_LIMIT = 100;
/** Safety cap on pagination loops (100 pages * 100 rows = 10,000 rows). */
const MAX_PAGES = 100;

/** Transient-failure retries before giving up on a request. */
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 500;

class F1ApiError extends Error {
  constructor(
    public status: number,
    public path: string,
  ) {
    super(`Jolpica-F1 API request failed (${status}): ${path}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  // 429 = rate limited, 5xx = upstream/transient failure. Everything else
  // (404, etc.) is a real answer and retrying it would just waste time.
  return status === 429 || status >= 500;
}

/**
 * Fetches a single page, retrying with backoff on rate-limit (429) and
 * transient server errors. Without this, a burst of concurrent requests
 * (e.g. one per season of a long career) can get partially rate-limited —
 * and if the caller swallows the error, specific seasons silently vanish
 * from the data instead of surfacing a failure.
 *
 * IMPORTANT: Next.js automatically memoizes `fetch(url, options)` calls that
 * are byte-for-byte identical within a single render pass — retrying with
 * the exact same URL would just hand back the same failed response instead
 * of making a new request, silently defeating retries. So every retry after
 * the first appends a `_retry=N` cache-busting param to force a real
 * network call. (The upstream API ignores unknown query params.)
 */
async function f1Fetch<T>(path: string, revalidate: number): Promise<MRData<T>> {
  let lastError: F1ApiError | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const attemptPath = attempt === 0 ? path : `${path}${path.includes("?") ? "&" : "?"}_retry=${attempt}`;
    const res = await fetch(`${BASE_URL}${attemptPath}`, {
      next: { revalidate },
    });

    if (res.ok) {
      return (await res.json()) as MRData<T>;
    }

    lastError = new F1ApiError(res.status, path);
    if (!isRetryableStatus(res.status) || attempt === MAX_RETRIES) {
      throw lastError;
    }

    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
    const delay = Number.isFinite(retryAfterMs) ? retryAfterMs : RETRY_BASE_DELAY_MS * 2 ** attempt;
    await sleep(delay);
  }

  // Unreachable — the loop above always returns or throws — but keeps TS happy.
  throw lastError;
}

/**
 * Follows Jolpica's `limit`/`offset`/`total` pagination, issuing further
 * requests until every row for the resource has been collected.
 */
async function f1FetchAllPages<T, Row>(
  path: string,
  revalidate: number,
  extractRows: (page: MRData<T>) => Row[],
): Promise<Row[]> {
  const separator = path.includes("?") ? "&" : "?";
  const rows: Row[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const pageData = await f1Fetch<T>(`${path}${separator}limit=${MAX_PAGE_LIMIT}&offset=${offset}`, revalidate);
    const pageRows = extractRows(pageData);
    rows.push(...pageRows);

    const total = Number(pageData.MRData.total);
    offset += MAX_PAGE_LIMIT;
    if (offset >= total || pageRows.length === 0) break;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Races / schedule
// ---------------------------------------------------------------------------

/** Current season's full race calendar. */
export async function getCurrentSeasonSchedule(): Promise<Race[]> {
  const data = await f1Fetch<RaceTable>("/current.json?limit=100", REVALIDATE_SHORT);
  return data.MRData.RaceTable.Races;
}

/** A given season's full race calendar. */
export async function getSeasonSchedule(year: string | number): Promise<Race[]> {
  const revalidate = isPastSeason(year) ? REVALIDATE_LONG : REVALIDATE_SHORT;
  const data = await f1Fetch<RaceTable>(`/${year}.json?limit=100`, revalidate);
  return data.MRData.RaceTable.Races;
}

/** Full results for a single race. */
export async function getRaceResults(year: string | number, round: string | number): Promise<Race | null> {
  const revalidate = isPastSeason(year) ? REVALIDATE_LONG : REVALIDATE_SHORT;
  const data = await f1Fetch<RaceTable>(`/${year}/${round}/results.json?limit=100`, revalidate);
  return data.MRData.RaceTable.Races[0] ?? null;
}

/**
 * Every race's full results for an entire season (all rounds), paginated.
 * Used to count race starts per driver — standings only carry points/wins,
 * not a per-driver races-entered count, so this is the cheapest way to get
 * that without a fetch per driver.
 *
 * The API paginates over the flat list of individual result rows, not by
 * race — `limit=100` rarely divides evenly into ~20-driver grids, so a
 * race can straddle a page boundary. Each page still groups its rows into
 * a `Race` container by round, so a split race comes back as two separate
 * entries for the same round, each holding only part of its grid — the
 * first entry might be P1-P12, say, and the second P13-P20. Anything that
 * naively took "the Results for round N" (a Map keyed by round, last one
 * wins) would silently pick up whichever fragment happened to land last,
 * which is exactly how a race list ended up showing P13-P15 as the
 * "podium". This reassembles same-round fragments before returning, so
 * every caller always gets one complete, correctly-ordered Results array
 * per round.
 */
export async function getSeasonResults(year: string | number): Promise<Race[]> {
  const revalidate = isPastSeason(year) ? REVALIDATE_LONG : REVALIDATE_SHORT;
  const rawRaces = await f1FetchAllPages<RaceTable, Race>(
    `/${year}/results.json`,
    revalidate,
    (page) => page.MRData.RaceTable.Races,
  );

  const byRound = new Map<string, Race>();
  for (const race of rawRaces) {
    const existing = byRound.get(race.round);
    if (!existing) {
      byRound.set(race.round, { ...race, Results: race.Results ? [...race.Results] : race.Results });
      continue;
    }
    existing.Results = [...(existing.Results ?? []), ...(race.Results ?? [])];
  }

  for (const race of byRound.values()) {
    race.Results?.sort((a, b) => Number(a.position) - Number(b.position));
  }

  return Array.from(byRound.values()).sort((a, b) => Number(a.round) - Number(b.round));
}

/**
 * Every sprint race's results for an entire season (all rounds), paginated.
 * A separate endpoint from getSeasonResults — sprint weekends award their
 * own points on top of the Grand Prix, and /{year}/results.json doesn't
 * include them at all. Skipping this anywhere cumulative points are summed
 * would silently undercount relative to the real championship total (caught
 * live: 2023's chart totaled Red Bull at 790, not the real 860 — the 70-point
 * gap was exactly that season's 6 sprints). Uses the same split-round
 * reassembly as getSeasonResults, for the same reason — the pagination
 * split bug applies here identically. Seasons with no sprints (most of F1
 * history) just come back empty.
 */
export async function getSeasonSprintResults(year: string | number): Promise<Race[]> {
  const revalidate = isPastSeason(year) ? REVALIDATE_LONG : REVALIDATE_SHORT;
  const rawRaces = await f1FetchAllPages<RaceTable, Race>(
    `/${year}/sprint.json`,
    revalidate,
    (page) => page.MRData.RaceTable.Races,
  );

  const byRound = new Map<string, Race>();
  for (const race of rawRaces) {
    const existing = byRound.get(race.round);
    if (!existing) {
      byRound.set(race.round, {
        ...race,
        SprintResults: race.SprintResults ? [...race.SprintResults] : race.SprintResults,
      });
      continue;
    }
    existing.SprintResults = [...(existing.SprintResults ?? []), ...(race.SprintResults ?? [])];
  }

  for (const race of byRound.values()) {
    race.SprintResults?.sort((a, b) => Number(a.position) - Number(b.position));
  }

  return Array.from(byRound.values()).sort((a, b) => Number(a.round) - Number(b.round));
}

/**
 * Merges results into a season's schedule by round, so a race list can show
 * podium info without a click-through to the race's own page. A race that
 * hasn't happened yet (or whose results fetch failed/came back empty)
 * simply keeps no Results — RaceCard treats that as "not decided yet".
 */
export function mergeRaceResults(schedule: Race[], results: Race[]): Race[] {
  const resultsByRound = new Map(results.map((r) => [r.round, r.Results]));
  return schedule.map((race) => ({
    ...race,
    Results: resultsByRound.get(race.round) ?? race.Results,
  }));
}

/** Qualifying results (grid) for a single race. */
export async function getQualifyingResults(year: string | number, round: string | number): Promise<Race | null> {
  const revalidate = isPastSeason(year) ? REVALIDATE_LONG : REVALIDATE_SHORT;
  const data = await f1Fetch<RaceTable>(`/${year}/${round}/qualifying.json?limit=100`, revalidate);
  return data.MRData.RaceTable.Races[0] ?? null;
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

/** Driver standings for a season ("current" for the live season). */
export async function getDriverStandings(year: string | number = "current") {
  const revalidate = year === "current" || !isPastSeason(year) ? REVALIDATE_SHORT : REVALIDATE_LONG;
  const data = await f1Fetch<StandingsTable>(`/${year}/driverStandings.json`, revalidate);
  return data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
}

/**
 * Every constructor entered in a given season — independent of results, so
 * a team shows up here as soon as it's on the entry list, whether or not
 * it's scored a point yet.
 */
export async function getSeasonConstructors(year: string | number): Promise<Constructor[]> {
  const revalidate = year === "current" || !isPastSeason(year) ? REVALIDATE_SHORT : REVALIDATE_LONG;
  const data = await f1Fetch<ConstructorTable>(`/${year}/constructors.json?limit=100`, revalidate);
  return data.MRData.ConstructorTable.Constructors;
}

/**
 * Constructor standings for a season ("current" for the live season).
 *
 * The standings endpoint only lists constructors that have been classified
 * in at least one race — a team that has entered the season but hasn't
 * finished a race yet (a new entrant early in the season, everything
 * retired so far, etc.) can be missing entirely, not just shown with 0
 * points. Cross-referencing against the season's actual entry list catches
 * that and backfills a zero-point placeholder, so every entrant shows up
 * everywhere standings are rendered.
 */
export async function getConstructorStandings(year: string | number = "current") {
  const revalidate = year === "current" || !isPastSeason(year) ? REVALIDATE_SHORT : REVALIDATE_LONG;

  const [data, seasonConstructors] = await Promise.all([
    f1Fetch<StandingsTable>(`/${year}/constructorStandings.json`, revalidate),
    getSeasonConstructors(year).catch((err) => {
      console.error(`Failed to load ${year} season constructor list:`, err);
      return [] as Constructor[];
    }),
  ]);

  const standings = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [];
  const classifiedIds = new Set(standings.map((s) => s.Constructor.constructorId));

  const unclassified = seasonConstructors
    .filter((c) => !classifiedIds.has(c.constructorId))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      position: "—",
      positionText: "—",
      points: "0",
      wins: "0",
      Constructor: c,
    }));

  return [...standings, ...unclassified];
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

/** Current grid (all drivers active this season). */
export async function getCurrentDrivers() {
  const data = await f1Fetch<DriverTable>("/current/drivers.json?limit=100", REVALIDATE_SHORT);
  return data.MRData.DriverTable.Drivers;
}

/** Full historical driver list (paginated — every driver since 1950). */
export async function getAllDrivers(): Promise<Driver[]> {
  return f1FetchAllPages<DriverTable, Driver>(
    "/drivers.json",
    REVALIDATE_LONG,
    (page) => page.MRData.DriverTable.Drivers,
  );
}

/** Bio info for a single driver. */
export async function getDriver(driverId: string) {
  const data = await f1Fetch<DriverTable>(`/drivers/${driverId}.json`, REVALIDATE_LONG);
  return data.MRData.DriverTable.Drivers[0] ?? null;
}

/** Every race + result for a driver's entire career (paginated). */
export async function getDriverCareerResults(driverId: string): Promise<Race[]> {
  return f1FetchAllPages<RaceTable, Race>(
    `/drivers/${driverId}/results.json`,
    REVALIDATE_LONG,
    (page) => page.MRData.RaceTable.Races,
  );
}

/** A driver's results within a single season. */
export async function getDriverSeasonResults(year: string | number, driverId: string): Promise<Race[]> {
  const revalidate = isPastSeason(year) ? REVALIDATE_LONG : REVALIDATE_SHORT;
  const data = await f1Fetch<RaceTable>(`/${year}/drivers/${driverId}/results.json?limit=100`, revalidate);
  return data.MRData.RaceTable.Races;
}

// ---------------------------------------------------------------------------
// Circuits
// ---------------------------------------------------------------------------

/** Info (name, location) for a single circuit. */
export async function getCircuit(circuitId: string) {
  const data = await f1Fetch<CircuitTable>(`/circuits/${circuitId}.json`, REVALIDATE_LONG);
  return data.MRData.CircuitTable.Circuits[0] ?? null;
}

/** Every race + result held at a given circuit, across all years (paginated). */
export async function getCircuitResults(circuitId: string): Promise<Race[]> {
  return f1FetchAllPages<RaceTable, Race>(
    `/circuits/${circuitId}/results.json`,
    REVALIDATE_LONG,
    (page) => page.MRData.RaceTable.Races,
  );
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

/** Every season the API has data for, 1950–present (paginated). */
export async function getAllSeasons(): Promise<Season[]> {
  return f1FetchAllPages<SeasonTable, Season>("/seasons.json", REVALIDATE_LONG, (page) => page.MRData.SeasonTable.Seasons);
}

// ---------------------------------------------------------------------------
// Constructors (teams)
// ---------------------------------------------------------------------------

/** Current grid (all constructors active this season). */
export async function getCurrentConstructors(): Promise<Constructor[]> {
  const data = await f1Fetch<ConstructorTable>("/current/constructors.json?limit=100", REVALIDATE_SHORT);
  return data.MRData.ConstructorTable.Constructors;
}

/** Full historical constructor list (paginated — every team since 1950). */
export async function getAllConstructors(): Promise<Constructor[]> {
  return f1FetchAllPages<ConstructorTable, Constructor>(
    "/constructors.json",
    REVALIDATE_LONG,
    (page) => page.MRData.ConstructorTable.Constructors,
  );
}

/** Info (name, nationality) for a single constructor. */
export async function getConstructor(constructorId: string) {
  const data = await f1Fetch<ConstructorTable>(`/constructors/${constructorId}.json`, REVALIDATE_LONG);
  return data.MRData.ConstructorTable.Constructors[0] ?? null;
}

/** Every race + results for a constructor's entire history (paginated). */
export async function getConstructorCareerResults(constructorId: string): Promise<Race[]> {
  return f1FetchAllPages<RaceTable, Race>(
    `/constructors/${constructorId}/results.json`,
    REVALIDATE_LONG,
    (page) => page.MRData.RaceTable.Races,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPastSeason(year: string | number): boolean {
  const y = Number(year);
  if (Number.isNaN(y)) return false;
  return y < new Date().getFullYear();
}

export { F1ApiError };
