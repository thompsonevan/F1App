import Link from "next/link";
import { getAllConstructors, getConstructorStandings } from "@/lib/f1-api";
import StandingsTable from "@/components/StandingsTable";
import { lineageFor, TEAM_LINEAGES } from "@/lib/team-lineage";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const [allConstructors, currentStandings] = await Promise.all([
    getAllConstructors(),
    getConstructorStandings("current").catch(() => []),
  ]);

  const activeIds = new Set(currentStandings.map((standing) => standing.Constructor.constructorId));
  const constructorById = new Map(allConstructors.map((c) => [c.constructorId, c]));
  const formerIds = new Set(TEAM_LINEAGES.flatMap((lineage) => lineage.formerIds));

  // Former identities (Jordan, Midland, Spyker, ...) don't get their own
  // row — they roll up into their team's current entry, shown there as
  // "Formerly ...". See lib/team-lineage.ts for how that mapping works.
  const teamEntries = allConstructors
    .filter((constructor) => !formerIds.has(constructor.constructorId))
    .map((constructor) => {
      const lineage = lineageFor(constructor.constructorId);
      const formerNames = (lineage?.formerIds ?? [])
        .map((id) => constructorById.get(id)?.name)
        .filter((name): name is string => Boolean(name));
      return { constructor, formerNames };
    })
    .sort((a, b) => a.constructor.name.localeCompare(b.constructor.name));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Teams</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {teamEntries.length} constructors across F1 history
        </p>
      </div>

      {currentStandings.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Current Season</h2>
          <StandingsTable type="constructor" standings={currentStandings} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">All Constructors</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teamEntries.map(({ constructor, formerNames }) => (
            <Link
              key={constructor.constructorId}
              href={`/teams/${constructor.constructorId}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-4 py-3 hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
            >
              <div>
                <p className="font-medium">{constructor.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{constructor.nationality}</p>
                {formerNames.length > 0 && (
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                    Formerly {formerNames.join(", ")}
                  </p>
                )}
              </div>
              {activeIds.has(constructor.constructorId) && (
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                  Active
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
