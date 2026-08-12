"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/40">
      <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Couldn&apos;t load this page</h2>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        {error.message || "The Jolpica-F1 API may be temporarily unavailable. Please try again."}
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  );
}
