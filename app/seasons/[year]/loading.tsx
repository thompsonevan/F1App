import { SkeletonBlock, SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <SkeletonBlock className="h-8 w-48" />
      <div className="grid gap-8 sm:grid-cols-2">
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
      </div>
      <SkeletonList rows={10} />
    </div>
  );
}
