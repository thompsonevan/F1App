import { SkeletonBlock, SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-48 w-full" />
      <SkeletonList rows={10} />
    </div>
  );
}
