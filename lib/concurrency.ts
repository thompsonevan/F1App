/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once.
 *
 * Used to avoid bursting past the Jolpica-F1 API's rate limit when a page
 * needs many similar requests (e.g. one driverStandings call per season of
 * a long career) — firing them all via `Promise.all` triggers 429s that,
 * if swallowed, silently produce missing data instead of an error.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}
