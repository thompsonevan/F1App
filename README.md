# F1App

A dashboard for Formula 1 race, driver, and standings data — current season and historical, back to 1950.

Read-only for now: no auth, no accounts, just clean views into F1 data pulled from a public API.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- Data from the [Jolpica-F1 API](https://github.com/jolpica/jolpica-f1) — a free, open-source, Ergast-compatible successor to the deprecated Ergast API. No API key required.

See [`docs/project-plan.md`](./docs/project-plan.md) for the full project plan (pages, data model, caching strategy, build order), and [`docs/roadmap.md`](./docs/roadmap.md) for a menu of future improvements with implementation notes.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
/app        → routes (home, races, drivers, seasons)
/components  → shared UI (standings tables, race/driver cards, results tables)
/lib         → API client (f1-api.ts), shared types, stat aggregation helpers
```

## Notes

- Every fetch to the Jolpica-F1 API goes through Next.js's `fetch` caching with a `revalidate` window: long for historical/finished data, short for current-season standings and the next race.
- Career and season-by-season driver stats (wins, podiums, points, championships) aren't returned pre-aggregated by the API — they're computed client-side in [`lib/aggregate.ts`](./lib/aggregate.ts) from raw race results.
- Driver/circuit photos aren't provided by the API and are skipped for v1.
