import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function ImageWithFallback({ src, alt, className = '', fallbackLabel }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 text-slate-500 p-4 ${className}`}
        role="img"
        aria-label={alt}
      >
        <ShoppingBag className="w-7 h-7 text-emerald-600/70 mb-1.5" />
        <span className="text-xs font-medium text-center text-slate-600 line-clamp-2">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
