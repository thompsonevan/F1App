import Link from "next/link";
import type { ConstructorStanding, DriverStanding } from "@/lib/types";
import { driverName } from "@/lib/format";

interface DriverStandingsProps {
  type: "driver";
  standings: DriverStanding[];
  limit?: number;
  viewAllHref?: string;
}

interface ConstructorStandingsProps {
  type: "constructor";
  standings: ConstructorStanding[];
  limit?: number;
  viewAllHref?: string;
}

type StandingsTableProps = DriverStandingsProps | ConstructorStandingsProps;

export default function StandingsTable(props: StandingsTableProps) {
  const { type, standings, limit, viewAllHref } = props;
  const rows = limit ? standings.slice(0, limit) : standings;

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-black/[.03] dark:bg-white/[.05] text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2">Pos</th>
            <th className="px-4 py-2">{type === "driver" ? "Driver" : "Constructor"}</th>
            {type === "driver" && <th className="px-4 py-2">Team</th>}
            <th className="px-4 py-2 text-right">Wins</th>
            <th className="px-4 py-2 text-right">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/10">
          {type === "driver"
            ? rows.map((standing) => {
                const s = standing as DriverStanding;
                return (
                  <tr key={s.Driver.driverId} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                    <td className="px-4 py-2 font-medium">{s.position}</td>
                    <td className="px-4 py-2">
                      <Link href={`/drivers/${s.Driver.driverId}`} className="hover:underline">
                        {driverName(s.Driver)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {s.Constructors.map((c) => c.name).join(" / ")}
                    </td>
                    <td className="px-4 py-2 text-right">{s.wins}</td>
                    <td className="px-4 py-2 text-right font-medium">{s.points}</td>
                  </tr>
                );
              })
            : rows.map((standing) => {
                const s = standing as ConstructorStanding;
                return (
                  <tr key={s.Constructor.constructorId} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                    <td className="px-4 py-2 font-medium">{s.position}</td>
                    <td className="px-4 py-2">{s.Constructor.name}</td>
                    <td className="px-4 py-2 text-right">{s.wins}</td>
                    <td className="px-4 py-2 text-right font-medium">{s.points}</td>
                  </tr>
                );
              })}
        </tbody>
      </table>
      {viewAllHref && (
        <div className="border-t border-black/10 px-4 py-2 text-sm dark:border-white/10">
          <Link href={viewAllHref} className="text-red-600 hover:underline dark:text-red-400">
            View all →
          </Link>
        </div>
      )}
    </div>
  );
}
