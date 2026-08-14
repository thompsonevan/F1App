import { getConstructorStandings } from "@/lib/f1-api";
import TeamExplorer from "@/components/TeamExplorer";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const standings = await getConstructorStandings("current").catch(() => []);

  return <TeamExplorer currentStandings={standings} />;
}
