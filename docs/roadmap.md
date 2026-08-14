# F1 Dashboard — Roadmap / Future Work

A menu of improvements for this app, written for a fresh Claude Code instance (or
a human) picking this repo up with no prior conversation context. Each item has
a description, why it matters, and concrete pointers into the existing code so
you don't have to re-derive established patterns.

Start by reading `docs/project-plan.md` (original spec) and `README.md`
(current structure). This file assumes you've read both.

## Important context before you start

**Nothing in this app has been tested against live data.** Every feature to
date was built in a network-sandboxed environment that could not reach
`api.jolpi.ca` at all — everything was verified via `tsc`/`eslint`/`next build`
plus one-off synthetic-data scripts (mocking the API's JSON shape) checked into
no file, run once, then deleted. That means: **before marking anything below
"done," actually run the app against the real API and look at real output.**
Several bugs in this codebase's history were exactly this class of problem —
most notably, `getSeasonResults` in `lib/f1-api.ts` had a pagination bug where
a race's results could split across two API response pages, and the merge
logic silently kept only the last-loaded fragment (P13–P15 shown as the
"podium" instead of P1–P3). It was only caught because a human looked at a
real screenshot. Don't repeat that pattern — check real output, not just that
the code compiles.

**Established patterns worth reusing rather than reinventing:**

- `lib/f1-api.ts` — the single API client. Every function goes through
  `f1Fetch`, which retries 429/5xx with backoff and busts Next's fetch
  memoization on retry (read the comment above `f1Fetch` — this was a real,
  subtle bug: Next dedupes identical `fetch(url, options)` calls within a
  render pass, which silently defeated naive retries). `REVALIDATE_LONG` (1
  day) for historical data, `REVALIDATE_SHORT` (1 hour) for current-season
  data. `f1FetchAllPages` handles Jolpica's `limit`/`offset` pagination.
- `lib/concurrency.ts` — `mapWithConcurrency(items, limit, fn, staggerMs?)`.
  Use this instead of `Promise.all` for any fan-out over many items (e.g. one
  request per season). Jolpica has a burst rate limit; unbounded concurrent
  requests trip it. Existing call sites use concurrency 2–5 with a small
  stagger — match that unless you have a reason not to.
- `lib/aggregate.ts` — all derived-stat computation (career totals, season
  summaries, driver directory, etc.) lives here as pure functions taking raw
  `Race[]`/`DriverStanding[]` and returning computed structs. Keep it that way
  — pure functions are what let you sanity-check logic against synthetic data
  without hitting the network (see git log for examples of exactly that
  pattern before every feature was shipped).
- `components/StandingsTable.tsx`, `components/RaceCard.tsx`,
  `components/ResultsTable.tsx` — shared display components, already wired for
  both light/dark (Tailwind `dark:` classes) and already linking driver/team
  names to their detail pages.
- Every list/detail page is `export const dynamic = "force-dynamic"` (or has
  unresolved dynamic route params, which has the same effect) specifically so
  `next build` never needs network access. Keep new pages consistent with
  this unless you have a specific reason to prerender.
- `app/*/loading.tsx` and `app/error.tsx` — every route has a loading skeleton
  and there's one shared error boundary. Follow the existing skeleton style
  (`components/Skeleton.tsx`) for new routes.
- Client components that need a year/view picker follow the pattern in
  `components/DriverSeasonExplorer.tsx` (driver detail page) and
  `components/DriverExplorer.tsx` (drivers list All-Time view) — a dropdown
  driving local `useState`, no page reload, data either passed as props or
  lazily fetched once via a small `/api/*` route handler and cached in state.

**Known, deliberate limitations — don't try to "fix" these without a real plan:**

- **Podiums and poles are not shown for the All-Time drivers list**
  (`/drivers`, All-Time view) or anywhere aggregated across many drivers.
  Standings data (what powers that view cheaply) only has points/wins/
  position — podiums and poles require full race results, and getting that
  for all 860+ F1 drivers means 860+ individual fetches. Not feasible in a
  single request. See the "Precomputed data layer" item below for the real
  fix.
- **F1TV links are search-only**, not direct video links. F1TV has no public
  API and its internal page IDs (`f1tv.formula1.com/page/{opaque-id}/...`)
  aren't derivable from race data. `lib/format.ts`'s `f1tvSearchUrl` builds a
  `?search=` query (confirmed working format) — that's the ceiling without a
  hand-maintained ID mapping (tried once, reverted — see git history for
  `lib/f1tv-links.ts` if you want the reasoning before reconsidering it).
- **`lib/team-lineage.ts`** (the Jordan→Aston Martin style rebrand mapping) is
  currently **disabled/unwired** — as of 2026-08-14, `/teams` and
  `/teams/[constructorId]` show every constructorId as its own standalone
  page with no cross-id rollup, and `/api/search` links former names to their
  own page rather than a canonical one. The hand-curated mapping data is
  still in the file, just unused, so it can be re-wired later. If you do,
  re-verify it against live data first — it was originally hand-curated from
  general F1 knowledge with no network access to check it.

---

## Quick wins

### Fastest lap on race results
**What:** Show each race's fastest lap (driver, time, lap number) on the race
detail page — maybe a small badge, maybe a column in the results table.

**Why it's quick:** The data is already fetched and typed. `lib/types.ts`
already defines `FastestLap` and `Result.FastestLap` — the field comes back
from `getRaceResults`/`getSeasonResults` already, it's just never read
anywhere in the UI. Grep confirms zero usages outside the type definition.

**Where:** `components/ResultsTable.tsx` (`RaceResultsTable`), consuming
`result.FastestLap` (has `rank`, `lap`, `Time.time`, optionally
`AverageSpeed`). The driver with `FastestLap.rank === "1"` set the fastest lap
of the race.

### Per-page SEO metadata
**What:** Dynamic `<title>`/`<meta description>` per page (driver name, race
name + year, team name, etc.) instead of every page inheriting the root
layout's generic "F1 Dashboard" title.

**Why:** Zero pages currently export `generateMetadata` — grep confirms it.
Better link previews when shared, better search indexing, basically free.

**Where:** Add `export async function generateMetadata({ params })` to each
`page.tsx` under `app/drivers/[driverId]`, `app/teams/[constructorId]`,
`app/races/[year]/[round]`, `app/seasons/[year]`. Fetch just enough to build a
title (most of these pages already fetch the entity — reuse that call via
Next's request memoization rather than fetching twice).

### Theme toggle
**What:** A manual light/dark/system switcher in the header, rather than only
following the OS preference.

**Why:** `app/globals.css` defines dark mode purely via
`@media (prefers-color-scheme: dark)` — there's no `ThemeToggle` component,
no `data-theme` attribute, nothing manual. Grep confirms.

**Where:** Would need a small client component storing preference (e.g.
`localStorage` + a `data-theme` attribute on `<html>`), plus reworking
`globals.css`'s dark-mode block to also respond to
`:root[data-theme="dark"]` / `:root[data-theme="light"]` alongside the media
query, matching the standard pattern (system default, explicit override wins
in both directions).

### Standings progression chart
**What:** A line chart of championship points (or position) by round across a
season — for a driver, a team, or the whole grid.

**Why:** More visual than a static table; the underlying data
(`getSeasonResults`, already reassembled correctly per round after the
pagination fix) is already there per-race, it just isn't aggregated into a
running total per round yet.

**Where:** New aggregation helper in `lib/aggregate.ts` (points-per-round →
cumulative points per round per driver/team). If you build any chart in this
repo, load the `dataviz` skill first if available in your environment — this
codebase doesn't have a charting library yet, so you're picking one from
scratch.

### PWA basics
**What:** A real `manifest.json` + app icons so the site is installable on
mobile, instead of the default Next.js favicon.

**Where:** `app/manifest.ts` (Next's file-convention route for this) or a
static `public/manifest.json` + `<link rel="manifest">` in `app/layout.tsx`.

---

## Feature additions

### Head-to-head comparison
**What:** Pick two drivers (or two teams) and see their stats side by side —
career totals, head-to-head season-by-season, maybe a shared chart.

**Where:** New route, e.g. `app/drivers/compare/page.tsx` reading two
`driverId`s from `searchParams` (mirrors the `?year=` pattern already used in
`app/races/page.tsx`). Reuse `getDriverCareerResults` +
`lib/aggregate.ts`'s `summarizeCareer`/`summarizeBySeasons` for both drivers
in parallel (`Promise.all`, not `mapWithConcurrency` — only 2 items, no need
for the rate-limit machinery built for larger fan-outs).

### Circuit pages
**What:** A `/circuits` list and `/circuits/[circuitId]` detail page — circuit
info, every race ever held there, lap record, etc.

**Why:** Circuit info currently only exists embedded inside race pages
(`race.Circuit`). `getCircuit(circuitId)` and `getCircuitResults(circuitId)`
already exist in `lib/f1-api.ts` and are already used by the race detail
page's "Past Seasons at this Circuit" section — this would surface that same
data as its own first-class browsable section, following the same
list/detail/search-integration pattern already used for drivers/teams/
seasons (see `app/teams/page.tsx` + `app/teams/[constructorId]/page.tsx` as
the closest template, plus `app/api/search/route.ts` for wiring it into
search).

### Pit stop data
**What:** Pit stop count/timing breakdown on race detail pages.

**Why:** Ergast/Jolpica has a `/​{season}/{round}/pitstops.json` endpoint that
this app has never called — grep for "pitstop" turns up nothing. Entirely new
surface area, not just an unused field like FastestLap.

**Where:** New `getPitStops(year, round)` in `lib/f1-api.ts` following the
existing `getRaceResults` pattern; render as a new section on
`app/races/[year]/[round]/page.tsx`.

### Constructor All-Time view
**What:** Give `/teams` the same sortable, paginated "All-Time" view that
`/drivers` has — currently `/teams` only has current-season standings plus a
flat alphabetical historical list (no sorting by wins/points/championships).

**Why:** The drivers version (`components/DriverExplorer.tsx` +
`app/api/drivers/history/route.ts`) is a direct template, and this is
actually *cheaper* to build than the driver version was — there are ~200
constructors in F1 history vs 860+ drivers, and `getConstructorStandings`
already exists per-season. Mirror the same lazy-load-once-per-tab-switch
pattern rather than blocking the default page load.

**Watch out for:** team lineage. A constructor's stats should probably
aggregate across `lib/team-lineage.ts` chains (Jordan+Midland+...+Aston
Martin as one row), the same way `app/teams/[constructorId]/page.tsx`
already does for a single team's detail page. Reuse `canonicalConstructorId`/
`lineageFor` rather than building parallel logic.

---

## Verify / harden

### Re-wire `lib/team-lineage.ts`, if/when wanted back
This was verify-then-use, but the functionality was turned off entirely
instead (2026-08-14) — see the "Known, deliberate limitations" note above.
If it comes back: search `/teams` for a few former names ("Jordan",
"Minardi", "Tyrrell") and confirm they resolve to the right current team. The
`mercedes` entry is the one flagged as most uncertain in its own code
comment — worth checking whether Jolpica's `mercedes` constructorId also
(incorrectly) covers the unrelated 1954–55 Mercedes-Benz works team.

### Add a real test suite
There are currently **zero test files in this repo** (confirmed:
`find . -iname "*.test.*" -o -iname "*.spec.*"` returns nothing). Every piece
of aggregation logic in `lib/aggregate.ts` and the pagination/merge logic in
`lib/f1-api.ts` has been manually verified against synthetic data at least
once during development but none of that was kept as an actual test. Good
first targets, since they're pure functions with no network dependency:

- `lib/aggregate.ts`: `summarizeBySeasons`, `summarizeCareer`,
  `buildDriverDirectory`, `summarizeConstructorNameHistory`,
  `countRaceStartsByDriver`
- `lib/f1-api.ts`: the reassembly logic inside `getSeasonResults` (the exact
  split-race scenario described above is a perfect regression test),
  `mergeRaceResults`
- `lib/team-lineage.ts`: `canonicalConstructorId` resolution

No test runner is configured yet — pick one (`vitest` is the common choice
for a Next.js + TypeScript project and needs minimal config) and wire a
`test` script into `package.json`.

### Real-device QA + accessibility pass
The app has never been viewed rendering real data or on a real device/screen
size — verify responsive layout on an actual phone, and do a pass for color
contrast and keyboard navigation (the search combobox in
`components/SearchBar.tsx` has ARIA attributes; the rest of the app hasn't
been specifically audited).

---

## Bigger investments (worth a real discussion before starting)

### A precomputed data layer
This is what actually unlocks the things currently ruled out as infeasible:
podiums/poles for every driver, verified F1TV direct links, fast arbitrary
historical race search. The original `docs/project-plan.md` flagged this
exact tradeoff: *"Whether to add a lightweight cache/DB layer later if API
rate limits become an issue with traffic."* We've now hit that wall for real
more than once. Two shapes this could take:

- **A real database** (Postgres/SQLite/KV), populated by a scheduled job that
  walks the full API at a controlled pace and stores aggregated stats. Changes
  the hosting story — no longer "deploy anywhere with zero config."
- **A periodically-regenerated static dataset** committed to the repo or built
  as a separate artifact, refreshed by a script/cron/GitHub Action rather than
  computed live on every request. Avoids a DB but needs a refresh pipeline and
  accepts staleness between refreshes.

Don't start this without deciding which shape first — it's a real
architecture change, not an incremental feature.

### Live timing / telemetry
Jolpica only has classification-level data (results, standings, schedules) —
no lap times, sector splits, or tire strategy. That's a fundamentally
different API ([OpenF1](https://openf1.org/) is a real, free, public option)
and a separate integration, not an extension of `lib/f1-api.ts`'s existing
scope.
