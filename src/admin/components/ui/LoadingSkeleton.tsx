interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className = '' }: LoadingSkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}
