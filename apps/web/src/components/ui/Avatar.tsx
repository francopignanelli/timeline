import { initials } from '../../lib/initials';

interface AvatarProps {
  displayName: string;
  /** Presigned URL, when the user has an avatar and it has resolved. */
  url?: string | null;
  size?: 'sm' | 'lg';
}

const SIZES = {
  sm: 'size-9 text-sm',
  lg: 'size-20 text-2xl',
} as const;

/** Initials are the always-available fallback: an avatar may be absent, still loading, or expired. */
export function Avatar({ displayName, url, size = 'sm' }: AvatarProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface font-medium text-text-secondary ${SIZES[size]}`}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        initials(displayName)
      )}
    </span>
  );
}
