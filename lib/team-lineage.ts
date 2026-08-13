/**
 * Maps a constructorId that no longer exists under its own identity to the
 * constructorId that represents the team today, for teams that changed
 * `constructorId` entirely across a full ownership/rebrand change — as
 * opposed to a sponsor rename that kept the *same* `constructorId` (e.g.
 * Sauber → Alfa Romeo → Kick Sauber), which is instead detected
 * automatically from race data by summarizeConstructorNameHistory in
 * lib/aggregate.ts, with no hardcoding needed.
 *
 * There is no API endpoint that exposes "these constructorIds are the same
 * team, historically" — it genuinely isn't derivable from the data, so this
 * list is hand-curated from publicly documented F1 team history.
 *
 * CAVEAT: this was written in a sandboxed environment with no network
 * access to the live Jolpica API, so none of these constructorId strings
 * (the conventional Ergast slug format) could be verified against real
 * data. Spot-check each lineage once you have a working deploy — search
 * `/teams` for a former name (e.g. "Jordan") and confirm it resolves to the
 * right current team — and correct/extend entries here as needed. The
 * `mercedes` entry in particular is worth double-checking: if Jolpica's
 * `mercedes` constructorId also covers the unrelated 1954–55 Mercedes-Benz
 * works team (a coincidence of name, not lineage), merging Tyrrell/BAR/
 * Honda/Brawn into it would incorrectly pull that era's stats in too.
 */
export interface TeamLineage {
  /** The constructorId treated as canonical — every page/link points here. */
  canonicalId: string;
  /** Earlier constructorIds that redirect to and roll up into canonicalId, oldest first. */
  formerIds: string[];
}

export const TEAM_LINEAGES: TeamLineage[] = [
  {
    // Jordan (1991) -> MF1/Midland (2006) -> Spyker (2007) -> Force India
    // (2008) -> Racing Point (2019) -> Aston Martin (2021-present).
    canonicalId: "aston_martin",
    formerIds: ["jordan", "midland", "spyker", "force_india", "racing_point"],
  },
  {
    // Tyrrell (1970) -> BAR (1999) -> Honda (2006) -> Brawn (2009) ->
    // Mercedes (2010-present).
    canonicalId: "mercedes",
    formerIds: ["tyrrell", "bar", "honda", "brawn"],
  },
  {
    // Stewart (1997) -> Jaguar Racing (2000) -> Red Bull Racing (2005-present).
    canonicalId: "red_bull",
    formerIds: ["stewart", "jaguar"],
  },
  {
    // Minardi (1985) -> Toro Rosso (2006) -> AlphaTauri (2020) -> RB (2024-present).
    canonicalId: "rb",
    formerIds: ["minardi", "toro_rosso", "alphatauri"],
  },
  {
    // Benetton (1986) -> Renault (2002) -> Lotus F1 Team (2012, a rebrand
    // distinct from the original 1958-1994 Team Lotus) -> Renault again
    // (2016) -> Alpine (2021-present). "renault" recurs under one
    // constructorId across the gap, so only the "lotus_f1" interruption
    // needs to be listed here.
    canonicalId: "alpine",
    formerIds: ["benetton", "renault", "lotus_f1"],
  },
];

const FORMER_TO_CANONICAL = new Map<string, string>(
  TEAM_LINEAGES.flatMap((lineage) => lineage.formerIds.map((id) => [id, lineage.canonicalId] as const)),
);

/** Resolves any constructorId to its lineage's canonical id (itself if it has none). */
export function canonicalConstructorId(constructorId: string): string {
  return FORMER_TO_CANONICAL.get(constructorId) ?? constructorId;
}

/** The lineage entry for a canonical id, if it has any recorded former identities. */
export function lineageFor(canonicalId: string): TeamLineage | undefined {
  return TEAM_LINEAGES.find((lineage) => lineage.canonicalId === canonicalId);
}
