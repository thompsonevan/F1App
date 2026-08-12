import Link from "next/link";
import { getAllSeasons } from "@/lib/f1-api";

export const dynamic = "force-dynamic";

export default async function SeasonsPage() {
  const seasons = await getAllSeasons();
  const sorted = seasons.slice().sort((a, b) => Number(b.season) - Number(a.season));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Seasons Archive</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {sorted.length} seasons, {sorted[sorted.length - 1]?.season}–{sorted[0]?.season}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {sorted.map((season) => (
          <Link
            key={season.season}
            href={`/seasons/${season.season}`}
            className="rounded-lg border border-black/10 px-3 py-2 text-center text-sm font-medium hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
          >
            {season.season}
          </Link>
        ))}
      </div>
    </div>
  );
}
