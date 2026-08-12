import { getDriverStandings } from "@/lib/f1-api";
import DriverCard from "@/components/DriverCard";

export const dynamic = "force-dynamic";

export default async function DriversPage() {
  const standings = await getDriverStandings("current");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Drivers</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Current grid, ranked by championship points</p>
      </div>
      <div className="flex flex-col gap-2">
        {standings.map((standing) => (
          <DriverCard key={standing.Driver.driverId} standing={standing} />
        ))}
      </div>
    </div>
  );
}
