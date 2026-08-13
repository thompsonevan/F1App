/**
 * Hand-curated direct links to a race's page on F1TV, keyed by
 * "{season}/{circuitId}". F1TV has no public API for this (see
 * f1tvSearchUrl in lib/format.ts for why), so these are real URLs found by
 * browsing F1TV directly, added one at a time as they're found. A race not
 * in this table falls back to a best-effort F1TV search link instead —
 * that's the normal case, not a failure state.
 *
 * Keyed by circuitId rather than round number on purpose: circuitId is
 * already on hand wherever this is looked up (race.Circuit.circuitId), so
 * adding an entry doesn't require figuring out a season's round numbering.
 *
 * To add one: browse to the race's page on F1TV (e.g.
 * https://f1tv.formula1.com/page/{id}/...), copy the full URL, and add an
 * entry below. The circuitId is shown on that race's own /races/{year}/{round}
 * page in this app (e.g. Hungaroring for the Hungarian Grand Prix).
 */
export const F1TV_RACE_LINKS: Record<string, string> = {
  "2026/hungaroring": "https://f1tv.formula1.com/page/12317/formula-1-aws-hungarian-grand-prix-2026",
};

export function getCuratedF1tvLink(season: string, circuitId: string): string | undefined {
  return F1TV_RACE_LINKS[`${season}/${circuitId}`];
}
