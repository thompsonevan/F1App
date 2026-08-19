# Backend Integration Plan — Neon Postgres on Vercel

**Status: decided, not yet started.** This is the next project task (see
`docs/roadmap.md`'s "Bigger investments" section and `docs/project-plan.md`'s
"Open Questions" section, both updated to point here).

## Scope — read this before anything else below

**This is infrastructure only, not a feature.** The goal right now is:

1. Build a Postgres mirror of the raw reference data — drivers, circuits
   (tracks), races (including results), and constructors (teams).
2. Make the app check that mirror before falling back to a live Jolpica
   fetch.
3. Refresh the mirror from the API on a schedule.

That's it. **No precomputed/derived stats tables, no podiums/poles rollup,
no constructor lineage rollup, no new pages.** Those were explored in an
earlier draft of this plan; they're real possible follow-ups once the
mirror exists, but building them now would be scope creep on top of what's
actually needed first — a working DB-backed cache. `lib/aggregate.ts`'s
existing career/season aggregation logic is untouched by this plan; it
keeps working exactly as it does today, computed on the fly from whatever
`Race[]` it's handed (mirror-sourced or API-sourced makes no difference to
it).

## Why

This app has been deliberately backend-less: every page is a server
component or route handler calling Jolpica live, cached only via Next's
`fetch` `revalidate` (`REVALIDATE_LONG` / `REVALIDATE_SHORT` in
`lib/f1-api.ts`). That's fine for anything scoped to one entity or one
season, but every request still round-trips to Jolpica on a cache miss, and
Jolpica has a burst rate limit (`mapWithConcurrency` in `lib/concurrency.ts`
exists specifically to survive that limit on multi-entity fetches, not
eliminate the dependency on the live API). A local mirror removes that
dependency for anything already backfilled, with the live API as fallback —
which also happens to be the foundation any future cross-entity feature
(podiums/poles, constructor all-time rollups, etc.) would need, without
committing to building those features now.

A backend here does **not** mean auth, user accounts, or writes from users —
there are none. Its only job is a **local mirror of Jolpica's reference
data + a scheduled refresh job**, sitting in front of the existing
live-fetch behavior rather than replacing it.

## Decision

- **Shape:** a real database, not a periodically-regenerated static
  dataset. Even without derived stats tables, the app needs relational
  lookups — every race at a given circuit, every result for a given
  driver — that are a poor fit for flat JSON blobs in KV/blob storage.
- **Service:** **Neon Postgres**, provisioned via Vercel's Storage tab
  (Vercel's own marketplace integration with Neon). Free tier (0.5GB
  storage, scale-to-zero compute) comfortably covers this dataset's actual
  size (races since 1950, ~860 drivers, ~200 constructors — small even
  unaggregated). Env vars (`DATABASE_URL`) are auto-injected into the
  Vercel project, no manual wiring.
- **Driver:** `@neondatabase/serverless` (Neon's HTTP-based driver, built
  for serverless/edge runtimes) with hand-written SQL in a new `lib/db.ts`.
  No ORM — mirrors the existing "typed function per query" convention
  already established in `lib/f1-api.ts`, and keeps the dependency
  footprint small (this repo doesn't carry an ORM or a charting library yet
  either).
- **Scheduler:** Vercel Cron Jobs (`vercel.json` → `crons`), free on the
  Hobby plan (2 jobs, daily granularity). Daily is sufficient — F1 results
  change at most once per race weekend.
- **Rejected: Render.** Free Postgres on Render expires 30 days after
  creation (14-day grace period, then deleted unless upgraded to a paid
  Starter instance) — disqualifying for a store meant to persist and be
  refreshed indefinitely. Render also has no free tier for Cron Jobs at
  all. Neon's free tier doesn't expire and integrates natively with the
  chosen Vercel hosting, so there's no reason to split across two
  platforms.

## Architecture

```
scripts/backfill.ts          → one-time full historical load (run locally, not on Vercel)
lib/db.ts                    → typed Postgres query functions (mirrors lib/f1-api.ts)
db/schema.sql                → table definitions, applied once via Neon console/psql
app/api/cron/refresh/route.ts → incremental refresh, hit by Vercel Cron
vercel.json                  → cron schedule + CRON_SECRET-protected route
```

Everything DB-related is isolated behind `lib/db.ts` — if Neon's free tier
ever becomes a problem, swapping providers (Turso, self-managed Postgres)
touches one file, not every page.

**Read path:** each existing function in `lib/f1-api.ts` gets a DB check
added ahead of its live fetch — look the row up via `lib/db.ts`, and only
call Jolpica if the mirror doesn't have it (not backfilled yet) or the DB
is unreachable. This lives entirely inside the API client layer, so no
page or component needs to change to benefit from it, and a DB outage
degrades to exactly today's behavior (live fetch) rather than breaking the
app.

## Schema (draft — mirror tables only, no derived/rollup tables)

- `drivers` — driverId (PK), given name, family name, nationality, DOB,
  code, permanent number
- `constructors` — constructorId (PK), name, nationality — raw ids as
  Jolpica returns them, no lineage rollup
- `circuits` — circuitId (PK), name, locality, country, lat/long —
  populated from the `Circuit` object embedded in each race response, no
  separate circuits endpoint needed
- `races` — season, round (composite PK), circuit_id (FK), name, date,
  time
- `results` — season, round (FK → races), driver_id (FK), constructor_id
  (FK), position, points, grid, status, fastest-lap fields — one row per
  driver per race, the raw data everything else would eventually be
  derived from
- `sprint_results` — same shape as `results`, for sprint weekends. Worth
  including from the start: `lib/f1-api.ts`'s own comment on
  `getSeasonSprintResults` documents a past real bug where omitting sprint
  points undercounted a season's totals by up to 70 points. Since sprints
  are races too and are in scope ("race... information"), leaving them out
  of the mirror would just reproduce that gap in a new place. Easy to drop
  later if it turns out not to be wanted.

Exact columns get finalized when Phase 1 starts — this is enough to size
the work, not a migration file.

## Phases

### Phase 0 — Provision
Add Postgres from Vercel's Storage tab (Neon). `vercel env pull` locally so
`lib/db.ts` has `DATABASE_URL` in dev.

### Phase 1 — Schema + one-time backfill
- Write `db/schema.sql` for the tables above, apply it once.
- Write `scripts/backfill.ts`: walk every season via `getAllSeasons()`, and
  for each, `getSeasonSchedule` / `getSeasonResults` /
  `getSeasonSprintResults` (all already in `lib/f1-api.ts`), fanned out
  with `mapWithConcurrency` at the same concurrency (2–5, staggered)
  already used elsewhere in the codebase — this populates `races`,
  `circuits` (from each race's embedded `Circuit`), `results`, and
  `sprint_results`. Separately, `getAllDrivers()` / `getAllConstructors()`
  populate the `drivers` / `constructors` reference tables. No per-driver
  or per-constructor career sweep is needed — once the season sweep is
  done, `results` already has every driver's and constructor's full
  history in it.
- Run manually (`npx tsx scripts/backfill.ts`) — a 75-year backfill will
  exceed a Vercel serverless function's time budget, so this never runs as
  a route handler.

### Phase 2 — Read-through with API fallback
- `lib/db.ts`: typed query functions per resource, mirroring
  `lib/f1-api.ts`'s existing shape (e.g. a DB-backed counterpart for each
  of `getSeasonSchedule`, `getSeasonResults`, `getDriver`, `getAllDrivers`,
  `getConstructor`, `getCircuit`, etc.).
- Wire each into the corresponding `lib/f1-api.ts` function as a
  try-DB-first step ahead of the existing live fetch, which becomes the
  fallback rather than being replaced.
- Current-season / in-progress data (standings, upcoming schedule —
  anything using `REVALIDATE_SHORT` today) needs a per-endpoint decision:
  prefer live API for freshness, or accept staleness up to the daily
  refresh window? Not a blanket call — pin this down while wiring each
  function.
- No page or component changes required — this phase is entirely inside
  the API client layer, which is the point.

### Phase 3 — Scheduled refresh
- `app/api/cron/refresh/route.ts`, guarded by Vercel's auto-injected
  `CRON_SECRET`. Fetches the current season's recent rounds (cheap —
  historical seasons never change) and upserts into the mirror tables.
- Add the cron entry to `vercel.json`, once daily.

### Phase 4 — Verify against live data
This repo's standing rule (`CLAUDE.md`, `docs/roadmap.md`) is that nothing
here has ever been checked against real Jolpica data, and the one bug found
so far (`getSeasonResults`' pagination split, P13–P15 shown as podium) was
exactly a "typechecks and builds fine, wrong in practice" class of bug.
Before marking any of this done: run the backfill against the real API,
and spot-check the mirror against known facts (a driver's known career
race count, a specific race's known winner) rather than trusting that it
compiled and ran.

## Open risks / questions

- **Neon free tier limits**: 0.5GB storage / scale-to-zero compute should
  be plenty at this data size, but scale-to-zero means occasional
  cold-start latency on the first query after idle. Once the DB sits in
  front of every read (Phase 2), that cold-start hit lands on any page,
  not just new ones — worth confirming it's acceptable once live, not just
  for the pages this used to be scoped to.
- **Backfill failure handling**: wrap writes in transactions per
  season/entity so a failed run doesn't leave partial/inconsistent rows.
- **Schema changes**: no migration framework planned given the small,
  slow-changing schema — plain SQL files applied manually is enough at
  this scale; revisit if the schema grows past a handful of tables.
