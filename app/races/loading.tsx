import { SkeletonBlock, SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonList rows={10} />
    </div>
  );
}
