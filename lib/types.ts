/**
 * Shared TypeScript types for the Jolpica-F1 API (Ergast-compatible).
 * Docs: https://github.com/jolpica/jolpica-f1
 *
 * Every response is wrapped in an `MRData` envelope with pagination info.
 * The actual payload lives under a resource-specific table key
 * (e.g. `RaceTable`, `StandingsTable`, `DriverTable`, ...).
 */

export interface MRData<T> {
  MRData: {
    xmlns: string;
    series: string;
    url: string;
    limit: string;
    offset: string;
    total: string;
  } & T;
}

export interface Location {
  lat: string;
  long: string;
  locality: string;
  country: string;
}

export interface Circuit {
  circuitId: string;
  url: string;
  circuitName: string;
  Location: Location;
}

export interface Driver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  url: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  nationality: string;
}

export interface Constructor {
  constructorId: string;
  url: string;
  name: string;
  nationality: string;
}

export interface RaceTime {
  millis?: string;
  time: string;
}

export interface FastestLap {
  rank: string;
  lap: string;
  Time: { time: string };
  AverageSpeed?: { units: string; speed: string };
}

export interface Result {
  number: string;
  position: string;
  positionText: string;
  positionOrder?: string;
  points: string;
  Driver: Driver;
  Constructor: Constructor;
  grid: string;
  laps: string;
  status: string;
  Time?: RaceTime;
  FastestLap?: FastestLap;
}

export interface QualifyingResult {
  number: string;
  position: string;
  Driver: Driver;
  Constructor: Constructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

export interface Race {
  season: string;
  round: string;
  url: string;
  raceName: string;
  Circuit: Circuit;
  date: string;
  time?: string;
  Results?: Result[];
  QualifyingResults?: QualifyingResult[];
  /** Only populated by getSeasonSprintResults — a separate endpoint, not part of the regular results fetch. */
  SprintResults?: Result[];
}

export interface DriverStanding {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Driver: Driver;
  Constructors: Constructor[];
}

export interface ConstructorStanding {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Constructor: Constructor;
}

export interface StandingsList {
  season: string;
  round: string;
  DriverStandings?: DriverStanding[];
  ConstructorStandings?: ConstructorStanding[];
}

export interface Season {
  season: string;
  url: string;
}

// Resource-table shapes, keyed as they appear under MRData.
export type RaceTable = { RaceTable: { season?: string; round?: string; Races: Race[] } };
export type StandingsTable = { StandingsTable: { season: string; StandingsLists: StandingsList[] } };
export type DriverTable = { DriverTable: { Drivers: Driver[] } };
export type ConstructorTable = { ConstructorTable: { Constructors: Constructor[] } };
export type CircuitTable = { CircuitTable: { Circuits: Circuit[] } };
export type SeasonTable = { SeasonTable: { Seasons: Season[] } };
