"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchResponse, SearchResult } from "@/app/api/search/route";

const DEBOUNCE_MS = 200;
const EMPTY_RESULTS: SearchResponse = { drivers: [], races: [], teams: [], seasons: [] };

const GROUPS: { key: keyof SearchResponse; label: string }[] = [
  { key: "drivers", label: "Drivers" },
  { key: "races", label: "Races" },
  { key: "teams", label: "Teams" },
  { key: "seasons", label: "Seasons" },
];

export default function SearchBar() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Order must match GROUPS above — it's what keyboard nav walks through
  // and what the `indexOf` lookup below relies on to line up with the UI.
  const flatResults = useMemo<SearchResult[]>(
    () => [...results.drivers, ...results.races, ...results.teams, ...results.seasons],
    [results],
  );

  // Debounced, cancellable fetch — typing quickly aborts the previous
  // in-flight request instead of letting stale responses race each other.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      // Nothing to clean up in state: the dropdown is already hidden for an
      // empty query (see `showDropdown` below), so stale results/loading
      // just sit unused until the next non-empty query overwrites them.
      abortRef.current?.abort();
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => res.json() as Promise<SearchResponse>)
        .then((data) => {
          setResults(data);
          setHighlightedIndex(0);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error("Search request failed:", err);
          setResults(EMPTY_RESULTS);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function reset() {
    setOpen(false);
    setQuery("");
    setResults(EMPTY_RESULTS);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || flatResults.length === 0) {
      if (event.key === "Escape") event.currentTarget.blur();
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((i) => (i + 1) % flatResults.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
        break;
      case "Enter": {
        event.preventDefault();
        const target = flatResults[highlightedIndex];
        if (target) {
          router.push(target.href);
          reset();
        }
        break;
      }
      case "Escape":
        setOpen(false);
        break;
    }
  }

  const trimmedQuery = query.trim();
  const showDropdown = open && trimmedQuery.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search drivers, races, teams, seasons…"
        aria-label="Search drivers, races, teams, and seasons"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="search-results-listbox"
        aria-autocomplete="list"
        className="w-full rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-red-400 dark:border-white/10 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
      />

      {showDropdown && (
        <div
          id="search-results-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-2 max-h-96 overflow-y-auto rounded-lg border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900"
        >
          {loading && flatResults.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">Searching…</p>
          )}
          {!loading && flatResults.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              No results for &ldquo;{trimmedQuery}&rdquo;
            </p>
          )}
          {GROUPS.map(({ key, label }) => {
            const items = results[key];
            if (items.length === 0) return null;

            return (
              <div key={key} className="border-b border-black/5 py-1 last:border-b-0 dark:border-white/5">
                <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  {label}
                </p>
                {items.map((item) => {
                  // A plain lookup against the already-flattened list, rather
                  // than an index accumulated while iterating — keeps this a
                  // pure read instead of a mutable counter threaded through JSX.
                  const index = flatResults.indexOf(item);
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={item.href}
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={reset}
                      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${
                        isHighlighted
                          ? "bg-red-50 dark:bg-red-950/40"
                          : "hover:bg-black/[.02] dark:hover:bg-white/[.03]"
                      }`}
                    >
                      <span className="font-medium">{item.label}</span>
                      {item.sub && (
                        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{item.sub}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
