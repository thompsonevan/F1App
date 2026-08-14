import Link from "next/link";
import { getAllConstructors, getConstructorStandings } from "@/lib/f1-api";
import StandingsTable from "@/components/StandingsTable";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const [allConstructors, currentStandings] = await Promise.all([
    getAllConstructors(),
    getConstructorStandings("current").catch(() => []),
  ]);

  const activeIds = new Set(currentStandings.map((standing) => standing.Constructor.constructorId));

  // Every constructorId gets its own row — no team-lineage rollup for now.
  // See lib/team-lineage.ts, which still has the hand-curated mapping if
  // this gets re-wired later.
  const teamEntries = allConstructors
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

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
          {teamEntries.map((constructor) => (
            <Link
              key={constructor.constructorId}
              href={`/teams/${constructor.constructorId}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-4 py-3 hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
            >
              <div>
                <p className="font-medium">{constructor.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{constructor.nationality}</p>
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
