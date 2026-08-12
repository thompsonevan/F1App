import { SkeletonBlock } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonBlock className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {Array.from({ length: 24 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}
