import type { Metadata } from "next";
import Link from "next/link";
import { getAllDrivers, getDriver } from "@/lib/f1-api";
import { getDriverProfile, type DriverProfile } from "@/lib/driver-profile";
import { driverName } from "@/lib/format";
import type { Driver } from "@/lib/types";
import type { SeasonSummary } from "@/lib/aggregate";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ driver1?: string; driver2?: string }>;
}): Promise<Metadata> {
  const { driver1, driver2 } = await searchParams;
  if (!driver1 || !driver2) {
    return {
      title: "Compare Drivers",
      description: "Pick two F1 drivers to compare career stats and season-by-season results side by side.",
    };
  }
  // Lightweight — just the two drivers' names, not their full career
  // profiles (getDriverProfile below, in the page body, does that; this
  // stays cheap even though both run in the same request).
  const [a, b] = await Promise.all([getDriver(driver1), getDriver(driver2)]);
  if (!a || !b) return { title: "Compare Drivers" };

  return {
    title: `${driverName(a)} vs ${driverName(b)}`,
    description: `Head-to-head career comparison: ${driverName(a)} vs ${driverName(b)} — championships, wins, points, and season-by-season results.`,
  };
}

export default async function CompareDriversPage({
  searchParams,
}: {
  searchParams: Promise<{ driver1?: string; driver2?: string }>;
}) {
  const { driver1: driver1Id, driver2: driver2Id } = await searchParams;
  const allDrivers = await getAllDrivers();
  const sortedDrivers = allDrivers
    .slice()
    .sort((a, b) => a.familyName.localeCompare(b.familyName) || a.givenName.localeCompare(b.givenName));

  const bothSelected = Boolean(driver1Id && driver2Id);
  const sameDriver = bothSelected && driver1Id === driver2Id;

  let profiles: [DriverProfile, DriverProfile] | null = null;
  const notFoundIds: string[] = [];

  if (bothSelected && !sameDriver) {
    // Two drivers — Promise.all, not mapWithConcurrency (that machinery is
    // for larger fan-outs; each side here still uses it internally, for its
    // own per-season standings fetch, via getDriverProfile).
    const [a, b] = await Promise.all([getDriverProfile(driver1Id!), getDriverProfile(driver2Id!)]);
    if (a && b) {
      profiles = [a, b];
    } else {
      if (!a) notFoundIds.push(driver1Id!);
      if (!b) notFoundIds.push(driver2Id!);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Compare Drivers</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pick two drivers to see career stats and season-by-season results side by side.
        </p>
      </div>

      <form action="/drivers/compare" method="get" className="flex flex-wrap items-end gap-4">
        <DriverSelectField name="driver1" label="Driver 1" drivers={sortedDrivers} selected={driver1Id} />
        <DriverSelectField name="driver2" label="Driver 2" drivers={sortedDrivers} selected={driver2Id} />
        <button
          type="submit"
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Compare
        </button>
      </form>

      {sameDriver && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Pick two different drivers to compare.</p>
      )}

      {notFoundIds.length > 0 && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t find driver{notFoundIds.length > 1 ? "s" : ""}: {notFoundIds.join(", ")}.
        </p>
      )}

      {profiles && <ComparisonResult a={profiles[0]} b={profiles[1]} />}
    </div>
  );
}

function DriverSelectField({
  name,
  label,
  drivers,
  selected,
}: {
  name: string;
  label: string;
  drivers: Driver[];
  selected?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <select
        name={name}
        defaultValue={selected ?? ""}
        className="min-w-[220px] rounded-md border border-black/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-red-400 dark:border-white/10 dark:bg-zinc-900"
      >
        <option value="" disabled>
          Select a driver…
        </option>
        {drivers.map((driver) => (
          <option key={driver.driverId} value={driver.driverId}>
            {driverName(driver)} ({driver.nationality})
          </option>
        ))}
      </select>
    </label>
  );
}

function ComparisonResult({ a, b }: { a: DriverProfile; b: DriverProfile }) {
  const headToHead = tallyHeadToHead(a, b);
  const seasonRows = buildSeasonRows(a, b);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-4 text-center">
        <DriverHeader driver={a.driver} />
        <DriverHeader driver={b.driver} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Career Totals</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              <StatRow label="Championships" a={a.championships} b={b.championships} />
              <StatRow label="Race Starts" a={a.careerTotals.races} b={b.careerTotals.races} />
              <StatRow label="Wins" a={a.careerTotals.wins} b={b.careerTotals.wins} />
              <StatRow label="Podiums" a={a.careerTotals.podiums} b={b.careerTotals.podiums} />
              <StatRow label="Poles" a={a.careerTotals.poles} b={b.careerTotals.poles} />
              <StatRow label="Points" a={a.careerTotals.points} b={b.careerTotals.points} />
              <StatRow label="Seasons" a={a.careerTotals.seasons.length} b={b.careerTotals.seasons.length} />
            </tbody>
          </table>
        </div>
      </section>

      {headToHead.sharedSeasons > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Head-to-Head</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            In {headToHead.sharedSeasons} shared season{headToHead.sharedSeasons === 1 ? "" : "s"} (comparing final
            championship position), <span className="font-medium text-black dark:text-white">{driverName(a.driver)}</span>{" "}
            finished ahead {headToHead.aAhead} time{headToHead.aAhead === 1 ? "" : "s"} and{" "}
            <span className="font-medium text-black dark:text-white">{driverName(b.driver)}</span> finished ahead{" "}
            {headToHead.bAhead} time{headToHead.bAhead === 1 ? "" : "s"}
            {headToHead.tied > 0 && ` (${headToHead.tied} tied)`}.
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Season by Season</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-black/[.03] dark:bg-white/[.05] text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Year</th>
                <th className="px-4 py-2 text-right" colSpan={2}>
                  {driverName(a.driver)}
                </th>
                <th className="px-4 py-2 text-right" colSpan={2}>
                  {driverName(b.driver)}
                </th>
              </tr>
              <tr>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2 text-right">Pos</th>
                <th className="px-4 py-2 text-right">Points</th>
                <th className="px-4 py-2 text-right">Pos</th>
                <th className="px-4 py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {seasonRows.map(({ year, a: seasonA, b: seasonB }) => (
                <tr key={year} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/seasons/${year}`} className="hover:underline">
                      {year}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">{seasonA?.finalPosition ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{seasonA?.points ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{seasonB?.finalPosition ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{seasonB?.points ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DriverHeader({ driver }: { driver: Driver }) {
  return (
    <div>
      <Link href={`/drivers/${driver.driverId}`} className="text-lg font-bold hover:underline">
        {driverName(driver)}
      </Link>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{driver.nationality}</p>
    </div>
  );
}

function StatRow({ label, a, b }: { label: string; a: number; b: number }) {
  const aWins = a > b;
  const bWins = b > a;
  return (
    <tr className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
      <td className={`w-2/5 px-4 py-2 text-right ${aWins ? "font-semibold" : ""}`}>{a}</td>
      <td className="px-4 py-2 text-center text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </td>
      <td className={`w-2/5 px-4 py-2 ${bWins ? "font-semibold" : ""}`}>{b}</td>
    </tr>
  );
}

function tallyHeadToHead(a: DriverProfile, b: DriverProfile) {
  const byYearB = new Map(b.seasonSummaries.map((s) => [s.season, s]));
  let aAhead = 0;
  let bAhead = 0;
  let tied = 0;
  let sharedSeasons = 0;

  for (const seasonA of a.seasonSummaries) {
    const seasonB = byYearB.get(seasonA.season);
    if (!seasonB || !seasonA.finalPosition || !seasonB.finalPosition) continue;
    sharedSeasons += 1;
    const posA = Number(seasonA.finalPosition);
    const posB = Number(seasonB.finalPosition);
    if (posA < posB) aAhead += 1;
    else if (posB < posA) bAhead += 1;
    else tied += 1;
  }

  return { aAhead, bAhead, tied, sharedSeasons };
}

function buildSeasonRows(
  a: DriverProfile,
  b: DriverProfile,
): { year: string; a?: SeasonSummary; b?: SeasonSummary }[] {
  const byYearA = new Map(a.seasonSummaries.map((s) => [s.season, s]));
  const byYearB = new Map(b.seasonSummaries.map((s) => [s.season, s]));
  const years = Array.from(new Set([...byYearA.keys(), ...byYearB.keys()])).sort((x, y) => Number(y) - Number(x));
  return years.map((year) => ({ year, a: byYearA.get(year), b: byYearB.get(year) }));
}
