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
