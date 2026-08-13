@AGENTS.md

# F1 Dashboard — orientation for a new session

Read-only F1 stats app: Next.js App Router + TypeScript + Tailwind, data from
the free Jolpica-F1 API, no database, no auth.

Before starting work, read:
- `docs/project-plan.md` — original spec: pages, data model, caching strategy.
- `docs/roadmap.md` — menu of planned improvements *and* established codebase
  conventions (the `f1Fetch` retry/memoization handling, `mapWithConcurrency`
  for rate-limit-safe fan-outs, the `force-dynamic` + `loading.tsx`/
  `error.tsx` pattern) plus known deliberate limitations (no podiums/poles in
  the all-time drivers list, F1TV links are search-only, `lib/team-lineage.ts`
  is unverified against live data). Read this even if you're not picking an
  item from it — it'll save you from re-deriving decisions already made.

**This app has never been verified against live data from inside a Claude
Code session** — every sandbox used so far has blocked outbound access to
`api.jolpi.ca`. If you have real network access, actually run `npm run dev`
and look at real rendered output before trusting that something works.
Several past bugs here were exactly "typechecks and builds fine, wrong in
practice" — e.g. a pagination bug where a race's results silently split
across two API pages and showed P13–P15 as the podium.
