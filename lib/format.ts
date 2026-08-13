/** Small formatting helpers shared across components. */

export function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function raceDateTime(date: string, time?: string): Date {
  return new Date(`${date}T${time ?? "00:00:00Z"}`);
}

export function ordinal(n: string | number): string {
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  switch (num % 10) {
    case 1:
      return `${num}st`;
    case 2:
      return `${num}nd`;
    case 3:
      return `${num}rd`;
    default:
      return `${num}th`;
  }
}

export function driverName(driver: { givenName: string; familyName: string }): string {
  return `${driver.givenName} ${driver.familyName}`;
}

/**
 * Best-effort link to F1TV's own search page for a given race. F1TV has no
 * public API or documented URL scheme for deep-linking to a specific
 * race's video — this points at F1TV's search page with the race
 * pre-filled as a query, which the visitor still has to click through
 * (and needs to be logged into an active F1TV subscription to actually
 * watch, and it may not have every historical race). The `q` param name
 * is an educated guess at a common convention, not verified against the
 * live site — network access to f1tv.formula1.com was blocked from the
 * environment this was built in. If it's wrong, the link still lands on
 * F1TV's real search page, just without the query pre-filled — check it
 * once deployed and adjust here if needed.
 */
export function f1tvSearchUrl(season: string, raceName: string): string {
  const query = `${season} ${raceName}`;
  return `https://f1tv.formula1.com/search?q=${encodeURIComponent(query)}`;
}
