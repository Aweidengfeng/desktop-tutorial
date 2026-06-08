import { useState } from 'react';

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className = '' }: SpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="w-8 h-8 border-2 border-slate-600 border-t-primary-light rounded-full animate-spin" />
    </div>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = 'inbox', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="material-symbols-outlined text-5xl text-slate-600 mb-4">{icon}</span>
      <p className="text-slate-300 font-medium">{title}</p>
      {description && <p className="text-slate-500 text-sm mt-1">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="mx-4 my-3 p-4 bg-rose-950/60 border border-rose-800 rounded-xl flex items-center justify-between gap-3">
      <p className="text-rose-300 text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-rose-300 text-sm font-medium whitespace-nowrap hover:text-rose-200"
        >
          重试
        </button>
      )}
    </div>
  );
}

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base' };

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initials = name ? name.slice(0, 1).toUpperCase() : '?';
  const sizeClass = SIZE_MAP[size];

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        className={`${sizeClass} rounded-full object-cover bg-slate-700 ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-primary flex items-center justify-center font-semibold text-white ${className}`}>
      {initials}
    </div>
  );
}
