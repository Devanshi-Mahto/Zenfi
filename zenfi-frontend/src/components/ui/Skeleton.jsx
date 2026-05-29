/**
 * Skeleton loader components for all data-loading states.
 */

function SkeletonBox({ className = '', rounded = 'rounded-lg' }) {
  return (
    <div
      className={`bg-[var(--border)] ${rounded} animate-pulse ${className}`}
    />
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 ${className}`}>
      <SkeletonBox className="h-4 w-2/3 mb-3" />
      <SkeletonBox className="h-8 w-1/2 mb-2" />
      <SkeletonBox className="h-3 w-1/3" />
    </div>
  );
}

export function SkeletonStatGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0 animate-pulse">
          <SkeletonBox className="w-9 h-9 flex-shrink-0" rounded="rounded-xl" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-3.5 w-2/3" />
            <SkeletonBox className="h-2.5 w-1/3" />
          </div>
          <SkeletonBox className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGoalCard() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 animate-pulse space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonBox className="w-11 h-11 flex-shrink-0" rounded="rounded-xl" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-4 w-3/4" />
          <SkeletonBox className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonBox className="h-2 w-full" rounded="rounded-full" />
      <div className="flex justify-between">
        <SkeletonBox className="h-3 w-24" />
        <SkeletonBox className="h-3 w-12" />
      </div>
    </div>
  );
}

export function SkeletonInsightCard() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3 animate-pulse space-y-2">
      <SkeletonBox className="h-3.5 w-1/2" />
      <SkeletonBox className="h-2.5 w-full" />
      <SkeletonBox className="h-2.5 w-4/5" />
    </div>
  );
}

export default SkeletonBox;
