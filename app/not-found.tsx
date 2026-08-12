import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-black/10 p-8 text-center dark:border-white/10">
      <h2 className="text-lg font-semibold">Not found</h2>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        We couldn&apos;t find that race, driver, or season. It may not exist in the Jolpica-F1 dataset.
      </p>
      <Link href="/" className="text-sm text-red-600 hover:underline dark:text-red-400">
        Back to dashboard
      </Link>
    </div>
  );
}
