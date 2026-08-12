# F1 Dashboard — Project Plan

## Overview
A web app that pulls Formula 1 race, driver, and standings data from a public API and presents it as a dashboard. Read-only for now (no auth, no user accounts) — just clean, well-organized views into F1 data, current and historical.

## Data Source
**Jolpica-F1 API** — open-source, Ergast-compatible successor to the (deprecated) Ergast API. Free, no API key required.

- Base URL: `https://api.jolpi.ca/ergast/f1/`
- Response envelope: everything is nested under `MRData`, with pagination fields `limit`, `offset`, `total`.
- Data goes back to 1950.
- Respect their rate limits — cache responses, don't hammer the API on every render (see Caching section).

### Key endpoints to use
| Purpose | Endpoint | Notes |
|---|---|---|
| Current season schedule | `/current.json` or `/{year}.json` | List of all races in a season |
| Single race detail | `/{year}/{round}/results.json` | Full race results |
| Qualifying results | `/{year}/{round}/qualifying.json` | Grid info |
| Driver standings | `/{year}/driverStandings.json` | Current or historical season standings |
| Constructor standings | `/{year}/constructorStandings.json` | Same, for teams |
| All drivers | `/drivers.json` | Full driver list (paginated) |
| Single driver info | `/drivers/{driverId}.json` | Bio info |
| Driver's race results across career | `/drivers/{driverId}/results.json` | For career stats aggregation |
| Driver's results in a given season | `/{year}/drivers/{driverId}/results.json` | For season-by-season stats |
| Circuit info | `/circuits/{circuitId}.json` | For "past seasons at this circuit" |
| Races at a specific circuit across years | `/circuits/{circuitId}/results.json` | Historical comparison per track |
| List of all seasons | `/seasons.json` | Powers the season archive page |

Full docs: https://github.com/jolpica/jolpica-f1 (docs folder has a page per endpoint with example payloads).

## Pages

### 1. Home / Dashboard (`/`)
- Current driver standings (top 5–10, "view all" link)
- Current constructor standings (top 5–10)
- Last race: name, date, podium (top 3), link to full results
- Next race: name, date, countdown, circuit name/location
- Season progress indicator (e.g. "Round 14 of 24")

### 2. Races
- **List (`/races`)**: current season calendar. Each row/card shows round #, race name, circuit, date, status (completed / upcoming).
- **Detail (`/races/{year}/{round}`)**:
  - Race info: circuit, date, laps, location
  - Full results table: position, driver, constructor, time/status, points
  - Qualifying results (grid)
  - **Past seasons at this circuit**: pull results for the same `circuitId` across previous years so the user can compare winners/times year over year

### 3. Drivers
- **List (`/drivers`)**: current grid, with points and standing position, headshot/flag if available
- **Detail (`/drivers/{driverId}`)**:
  - Current season stats: points, wins, podiums, position
  - Season-by-season history table: year, team, points, final position, wins
  - Career totals: races, wins, podiums, poles, points, championships (aggregated client- or server-side from season-by-season data — the API doesn't return this pre-aggregated)

### 4. Seasons archive (`/seasons` and `/seasons/{year}`)
- **List**: every season available (1950–present), link into each
- **Detail**: that season's full calendar (races + results if completed), final driver standings, final constructor standings

## Tech Stack
- **Framework**: Next.js (App Router) — gives file-based routing that maps cleanly to the URL structure above, plus easy API routes for the caching layer
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data fetching**: fetch wrapped in a small API client module (`lib/f1-api.ts`), called from server components where possible so caching + revalidation happens on the server
- **Caching**: Next.js `fetch` with `revalidate` — long TTL (e.g. 1 day+) for historical/finished data that never changes, short TTL (e.g. 1 hour) for current-season standings and next-race info. No database needed for v1; revisit if the app needs to precompute aggregates for performance.

## Data Model (conceptual — not necessarily a DB, just shape)
- `Season` (year) → has many `Race`
- `Race` → circuit, date, round, `Result[]`, `QualifyingResult[]`
- `Driver` → id, name, nationality, DOB; stats derived by aggregating `Result[]` across races/seasons
- `Constructor` → id, name, nationality; same aggregation pattern
- `Circuit` → id, name, location; used to group races across years for the "past seasons here" feature

## Suggested Project Structure
```
/app
  /page.tsx                       → Home dashboard
  /races/page.tsx                 → Races list (current season)
  /races/[year]/[round]/page.tsx  → Race detail
  /drivers/page.tsx               → Drivers list (current grid)
  /drivers/[driverId]/page.tsx    → Driver detail
  /seasons/page.tsx                → Seasons archive list
  /seasons/[year]/page.tsx        → Season detail
/lib
  /f1-api.ts                      → API client (all Jolpica calls, typed)
  /types.ts                       → Shared TS types for API responses
  /aggregate.ts                   → Helpers to compute career/season stats from raw results
/components
  StandingsTable.tsx
  RaceCard.tsx
  DriverCard.tsx
  CountdownNextRace.tsx
  ResultsTable.tsx
```

## Build Order
1. **Scaffold**: Next.js + TypeScript + Tailwind, set up `lib/f1-api.ts` with typed fetch helpers for the endpoints above
2. **Home dashboard**: standings + last/next race — proves the API integration end-to-end
3. **Races list + detail**: including qualifying results
4. **Drivers list + detail**: including season-by-season and career aggregation (this is the most logic-heavy piece — no endpoint gives career totals directly)
5. **Seasons archive**: list + detail views
6. **Cross-referencing**: "past seasons at this circuit" on race detail pages (needs pulling multiple years of data for one circuit)
7. **Polish**: loading states, empty states (e.g. season with no data yet), mobile responsiveness, error handling for API downtime

## Open Questions / Decisions for Later
- Driver/circuit photos: Jolpica doesn't provide images. Either skip images for v1, or source them separately later.
- How far back should "career stats" aggregation reach for very old drivers (1950s era) — may need pagination handling since some endpoints cap results per page.
- Whether to add a lightweight cache/DB layer later if API rate limits become an issue with traffic.
