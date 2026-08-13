import { getDriverStandings } from "@/lib/f1-api";
import DriverExplorer from "@/components/DriverExplorer";

export const dynamic = "force-dynamic";

export default async function DriversPage() {
  const standings = await getDriverStandings("current");

  return <DriverExplorer currentStandings={standings} />;
}
