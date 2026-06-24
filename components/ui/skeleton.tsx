import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-neutral-200/70 dark:bg-neutral-800/70 motion-reduce:animate-none",
        className
      )}
    />
  );
}
