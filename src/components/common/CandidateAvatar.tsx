import React, { useEffect, useState } from 'react';

interface CandidateAvatarProps {
  src?: string | null;
  alt: string;
  className?: string;
}

function getInitials(name: string): string {
  const parts = String(name || 'UCC')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'UC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const CandidateAvatar: React.FC<CandidateAvatarProps> = ({
  src,
  alt,
  className = 'w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0'
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || !src.trim() || hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${className} bg-[#EAF2FA] text-[#123B70] font-bold flex items-center justify-center select-none tracking-tight`}
      >
        <span>{getInitials(alt)}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
