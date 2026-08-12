import Link from "next/link";
import type { DriverStanding } from "@/lib/types";
import { driverName } from "@/lib/format";

export default function DriverCard({ standing }: { standing: DriverStanding }) {
  return (
    <Link
      href={`/drivers/${standing.Driver.driverId}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-black/10 px-4 py-3 transition-colors hover:bg-black/[.02] dark:border-white/10 dark:hover:bg-white/[.03]"
    >
      <div className="flex items-center gap-4">
        <span className="w-8 shrink-0 text-center text-lg font-bold text-zinc-400 dark:text-zinc-600">
          {standing.position}
        </span>
        <div>
          <p className="font-medium">{driverName(standing.Driver)}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {standing.Constructors.map((c) => c.name).join(" / ")} · {standing.Driver.nationality}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold">{standing.points} pts</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{standing.wins} wins</p>
      </div>
    </Link>
  );
}
