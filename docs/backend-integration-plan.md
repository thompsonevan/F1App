# Backend Integration Plan — Neon Postgres on Vercel

**Status: decided, not yet started.** This is the next project task (see
`docs/roadmap.md`'s "Bigger investments" section and `docs/project-plan.md`'s
"Open Questions" section, both updated to point here).

## Why

This app has been deliberately backend-less: every page is a server
component or route handler calling Jolpica live, cached only via Next's
`fetch` `revalidate` (`REVALIDATE_LONG` / `REVALIDATE_SHORT` in
`lib/f1-api.ts`). That's fine for anything scoped to one entity or one
season. It breaks down for anything that needs to aggregate **across** many
entities, because that means one Jolpica request per entity and Jolpica has a
burst rate limit (`mapWithConcurrency` in `lib/concurrency.ts` exists
specifically to survive that limit, not eliminate the problem).

Concretely, this blocks three things already called out in
`docs/roadmap.md`:

1. **Podiums/poles on the All-Time drivers view** (`/drivers`) — standings
   data has points/wins/position but not podiums/poles; getting those needs
   full race results for all 860+ drivers, which is a fetch storm.
2. **Constructor All-Time view** (`/teams`), including re-wiring
   `lib/team-lineage.ts` to roll lineage chains (e.g. Jordan → Aston Martin)
   into one row — same shape of problem, smaller N (~200 constructors).
3. **General rate-limit exposure** for any future feature that fans out
   across seasons/entities (e.g. circuit cross-year comparisons at scale).

A backend here does **not** mean auth, user accounts, or writes — there are
none. Its only job is a **precomputed aggregate store + a scheduled refresh
job**. It sits alongside the existing live-fetch pages, not instead of them.

## Decision

- **Shape:** a real database, not a periodically-regenerated static dataset.
  The app needs relational operations — sort all drivers by wins/podiums,
  roll up a constructor's stats across lineage IDs, look up "every race at
  this circuit" — that are a poor fit for flat JSON blobs in KV/blob storage.
- **Service:** **Neon Postgres**, provisioned via Vercel's Storage tab
  (Vercel's own marketplace integration with Neon). Free tier (0.5GB
  storage, scale-to-zero compute) comfortably covers this dataset's actual
  size (races since 1950, ~860 drivers, ~200 constructors — small even
  unaggregated). Env vars (`DATABASE_URL`) are auto-injected into the Vercel
  project, no manual wiring.
- **Driver:** `@neondatabase/serverless` (Neon's HTTP-based driver, built for
  serverless/edge runtimes) with hand-written SQL in a new `lib/db.ts`. No
  ORM — mirrors the existing "typed function per query" convention already
  established in `lib/f1-api.ts`, and keeps the dependency footprint small
  (this repo doesn't carry an ORM or a charting library yet either).
- **Scheduler:** Vercel Cron Jobs (`vercel.json` → `crons`), free on the
  Hobby plan (2 jobs, daily granularity). Daily is sufficient — F1 results
  change at most once per race weekend.
- **Rejected: Render.** Free Postgres on Render expires 30 days after
  creation (14-day grace period, then deleted unless upgraded to a paid
  Starter instance) — disqualifying for a store meant to persist and be
  refreshed indefinitely. Render also has no free tier for Cron Jobs at all.
  Neon's free tier doesn't expire and integrates natively with the chosen
  Vercel hosting, so there's no reason to split across two platforms.

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

### Schema (draft)

- `drivers` — driverId (PK), name, nationality, DOB
- `constructors` — constructorId (PK), name, nationality
- `races` — season, round, circuitId, date, name (composite key: season+round)
- `results` — season, round, driverId, constructorId, position, points,
  status, fastest lap fields — the raw rows career/season stats get derived
  from
- `driver_career_stats` / `driver_season_stats` — precomputed via the
  **existing** `summarizeCareer` / `summarizeBySeasons` logic in
  `lib/aggregate.ts` at write time, not reimplemented in SQL
- `constructor_career_stats` / `constructor_season_stats` — same, via
  `summarizeConstructorCareer` / `summarizeConstructorBySeasons`, written
  per canonical lineage ID (`lib/team-lineage.ts`'s `canonicalConstructorId`)
  so lineage rollup is baked into the table rather than computed on read

Exact columns get finalized when Phase 1 starts — this is enough to size the
work, not a migration file.

## Phases

### Phase 0 — Provision
Add Postgres from Vercel's Storage tab (Neon). `vercel env pull` locally so
`lib/db.ts` has `DATABASE_URL` in dev.

### Phase 1 — Schema + one-time backfill
- Write `db/schema.sql`, apply it once.
- Write `scripts/backfill.ts`: walks all seasons via the **existing**
  `getSeasonSchedule` / `getSeasonResults` / `getAllDrivers` /
  `getAllConstructors` / `getDriverCareerResults` /
  `getConstructorCareerResults` (all already in `lib/f1-api.ts`), fanned out
  with `mapWithConcurrency` at the same concurrency (2–5, staggered) already
  used elsewhere in the codebase. Feeds results through the existing
  `lib/aggregate.ts` functions rather than duplicating aggregation logic in
  SQL.
- Run manually (`npx tsx scripts/backfill.ts`) — a 75-year backfill will
  exceed a Vercel serverless function's time budget, so this never runs as a
  route handler.

### Phase 2 — Read paths
- `lib/db.ts`: typed query functions (`getDriverAllTimeStats()`,
  `getConstructorAllTimeStats()`, etc.).
- Rewire only the pages this unblocks:
  - `/drivers` All-Time view (`components/DriverExplorer.tsx`,
    `app/api/drivers/history/route.ts`) — add podiums/poles columns.
  - `/teams` — build the sortable All-Time view called for in
    `docs/roadmap.md`, and re-wire `lib/team-lineage.ts` (currently
    unwired) so lineage chains roll up into one row, per that file's own
    "verify against live data first" warning.
- Every other page keeps its current live-Jolpica-fetch behavior. This is
  additive, not a rewrite.

### Phase 3 — Incremental refresh
- `app/api/cron/refresh/route.ts`, guarded by Vercel's auto-injected
  `CRON_SECRET`. Fetches only the current season's recent rounds (cheap —
  historical seasons never change) and upserts.
- Add the cron entry to `vercel.json`, once daily.

### Phase 4 — Verify against live data
This repo's standing rule (`CLAUDE.md`, `docs/roadmap.md`) is that nothing
here has ever been checked against real Jolpica data, and the one bug found
so far (`getSeasonResults`' pagination split, P13–P15 shown as podium) was
exactly a "typechecks and builds fine, wrong in practice" class of bug. This
feature is high-risk for the same failure mode — an aggregation bug here is
silent (numbers look plausible, just wrong). Before marking any of this
done: run the backfill against the real API, and spot-check output against
known facts (a driver's known career win count, a constructor's known
championship count) rather than trusting that it compiled and ran.

## Open risks / questions

- **Neon free tier limits**: 0.5GB storage / scale-to-zero compute should be
  plenty at this data size, but scale-to-zero means occasional cold-start
  latency on the first query after idle — acceptable for a low-traffic app,
  worth confirming once live.
- **Backfill failure handling**: wrap writes in transactions per
  season/entity so a failed run doesn't leave partial/inconsistent rows.
- **Schema changes**: no migration framework planned given the small,
  slow-changing schema — plain SQL files applied manually is enough at this
  scale; revisit if the schema grows past a handful of tables.
