import { SkeletonBlock, SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-10">
      <SkeletonBlock className="h-8 w-48" />
      <div className="grid gap-6 sm:grid-cols-2">
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
      </div>
      <SkeletonList rows={5} />
    </div>
  );
}
