"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DriverHistoryResponse } from "@/app/api/drivers/history/route";
import type { DriverDirectoryEntry } from "@/lib/aggregate";
import type { DriverStanding } from "@/lib/types";
import DriverCard from "@/components/DriverCard";
import StandingsTable from "@/components/StandingsTable";

const PAGE_SIZE = 50;

type View = "current" | "byYear" | "allTime";
type SortField =
  | "name"
  | "debutSeason"
  | "lastSeason"
  | "seasonsRaced"
  | "championships"
  | "raceStarts"
  | "wins"
  | "points";

const SORT_LABELS: Record<SortField, string> = {
  name: "Name",
  debutSeason: "Debut",
  lastSeason: "Last Season",
  seasonsRaced: "Years Raced",
  championships: "Championships",
  raceStarts: "Race Starts",
  wins: "Wins",
  points: "Points",
};

export default function DriverExplorer({ currentStandings }: { currentStandings: DriverStanding[] }) {
  const [view, setView] = useState<View>("current");
  const [history, setHistory] = useState<DriverHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState("");
  const [sortField, setSortField] = useState<SortField>("points");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/drivers/history");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data: DriverHistoryResponse = await res.json();
      setHistory(data);
      setSelectedYear((prev) => prev || data.seasons[data.seasons.length - 1] || "");
    } catch (err) {
      console.error("Failed to load driver history:", err);
      setHistoryError("Couldn't load full driver history — the data source may be temporarily unavailable.");
    } finally {
      setHistoryLoading(false);
    }
  }

  // A direct response to a click, not an effect — this is a one-shot fetch
  // triggered by switching tabs, not something that needs to re-run when
  // unrelated state changes.
  function switchView(next: View) {
    setView(next);
    if (next !== "current" && !history && !historyLoading) {
      void loadHistory();
    }
  }

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
    setPage(1);
  }

  const sortedDirectory = useMemo(() => {
    if (!history) return [];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...history.directory].sort((a, b) => {
      switch (sortField) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "debutSeason":
          return (Number(a.debutSeason) - Number(b.debutSeason)) * dir;
        case "lastSeason":
          return (Number(a.lastSeason) - Number(b.lastSeason)) * dir;
        case "seasonsRaced":
          return (a.seasonsRaced - b.seasonsRaced) * dir;
        case "championships":
          return (a.championships - b.championships) * dir;
        case "raceStarts":
          return (a.raceStarts - b.raceStarts) * dir;
        case "wins":
          return (a.wins - b.wins) * dir;
        case "points":
          return (a.points - b.points) * dir;
      }
    });
  }, [history, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedDirectory.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sortedDirectory.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Drivers</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {view === "current" && "Current grid, ranked by championship points"}
            {view === "byYear" && "Final standings for any season since 1950"}
            {view === "allTime" && "Every driver in F1 history"}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">View</span>
          <select
            value={view}
            onChange={(event) => switchView(event.target.value as View)}
            className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm outline-none focus:border-red-400 dark:border-white/10 dark:bg-zinc-900"
          >
            <option value="current">Current Season</option>
            <option value="byYear">By Year</option>
            <option value="allTime">All-Time</option>
          </select>
        </label>
      </div>

      {view === "current" && (
        <div className="flex flex-col gap-2">
          {currentStandings.map((standing) => (
            <DriverCard key={standing.Driver.driverId} standing={standing} />
          ))}
        </div>
      )}

      {view !== "current" && historyLoading && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading full driver history — this pulls every F1 season since 1950, so it can take a little while the
          first time. It&apos;s cached after that.
        </p>
      )}

      {view !== "current" && historyError && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40">
          <p className="text-red-700 dark:text-red-400">{historyError}</p>
          <button
            onClick={() => void loadHistory()}
            className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      )}

      {view === "byYear" && history && (
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Year</span>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm outline-none focus:border-red-400 dark:border-white/10 dark:bg-zinc-900"
            >
              {history.seasons
                .slice()
                .reverse()
                .map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
            </select>
          </label>
          {history.standingsBySeason[selectedYear] ? (
            <StandingsTable type="driver" standings={history.standingsBySeason[selectedYear]} />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No standings available for {selectedYear}.</p>
          )}
        </div>
      )}

      {view === "allTime" && history && (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-black/[.03] dark:bg-white/[.05] text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <tr>
                  <SortableHeader field="name" label="Driver" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHeader
                    field="debutSeason"
                    label="Debut"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    field="seasonsRaced"
                    label="Years"
                    align="right"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-4 py-2">Status</th>
                  <SortableHeader
                    field="championships"
                    label="Titles"
                    align="right"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    field="raceStarts"
                    label="Starts"
                    align="right"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    field="wins"
                    label="Wins"
                    align="right"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    field="points"
                    label="Points"
                    align="right"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {pageItems.map((driver) => (
                  <DriverRow key={driver.driverId} driver={driver} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              {sortedDirectory.length} drivers · page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/10"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-md border border-black/10 px-3 py-1 disabled:opacity-40 dark:border-white/10"
              >
                Next
              </button>
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Podiums and poles aren&apos;t shown here — computing them for every driver in F1 history would take
            860+ individual requests. They&apos;re available on each driver&apos;s own page.
          </p>
        </div>
      )}
    </div>
  );
}

function DriverRow({ driver }: { driver: DriverDirectoryEntry }) {
  return (
    <tr className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
      <td className="px-4 py-2">
        <Link href={`/drivers/${driver.driverId}`} className="font-medium hover:underline">
          {driver.name}
        </Link>
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">{driver.nationality}</span>
      </td>
      <td className="px-4 py-2">{driver.debutSeason}</td>
      <td className="px-4 py-2 text-right">{driver.seasonsRaced}</td>
      <td className="px-4 py-2">
        {driver.isCurrent ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
            Active
          </span>
        ) : (
          <span className="text-zinc-600 dark:text-zinc-400">Retired {driver.lastSeason}</span>
        )}
      </td>
      <td className="px-4 py-2 text-right">{driver.championships || "—"}</td>
      <td className="px-4 py-2 text-right">{driver.raceStarts}</td>
      <td className="px-4 py-2 text-right">{driver.wins}</td>
      <td className="px-4 py-2 text-right font-medium">{driver.points}</td>
    </tr>
  );
}

function SortableHeader({
  field,
  label,
  align,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField;
  label: string;
  align?: "right";
  sortField: SortField;
  sortDir: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  const isActive = field === sortField;
  return (
    <th className={`px-4 py-2 ${align === "right" ? "text-right" : ""}`}>
      <button
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-black dark:hover:text-white ${
          isActive ? "text-black dark:text-white" : ""
        }`}
        title={`Sort by ${SORT_LABELS[field]}`}
      >
        {label}
        {isActive && <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
