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
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 400;

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
 */
async function f1Fetch<T>(path: string, revalidate: number): Promise<MRData<T>> {
  let lastError: F1ApiError | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
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

/** Constructor standings for a season ("current" for the live season). */
export async function getConstructorStandings(year: string | number = "current") {
  const revalidate = year === "current" || !isPastSeason(year) ? REVALIDATE_SHORT : REVALIDATE_LONG;
  const data = await f1Fetch<StandingsTable>(`/${year}/constructorStandings.json`, revalidate);
  return data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings ?? [];
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

export async function getConstructors() {
  const data = await f1Fetch<ConstructorTable>("/current/constructors.json?limit=100", REVALIDATE_SHORT);
  return data.MRData.ConstructorTable.Constructors;
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
