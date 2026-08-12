import { SkeletonBlock, SkeletonList } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <SkeletonBlock className="h-16 w-full" />
      <SkeletonList rows={8} />
      <SkeletonList rows={8} />
    </div>
  );
}
