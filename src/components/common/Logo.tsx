import React from 'react';

export const UCC_CREST_PATH = '/assets/aistudio/image_b7db00c2.png';

export type LogoVariant = 'compact' | 'default' | 'large';
export type LogoTheme = 'light' | 'dark';
export type LogoLayout = 'horizontal' | 'stacked';

export interface LogoProps {
  variant?: LogoVariant;
  theme?: LogoTheme;
  layout?: LogoLayout;
  showWordmark?: boolean;
  showTagline?: boolean;
  subtitle?: string;
  className?: string;
}

const CREST_SIZES: Record<LogoVariant, string> = {
  compact: 'w-8 h-8 p-0.5 rounded-lg',
  default: 'w-10 h-10 p-1 rounded-xl',
  large: 'w-16 h-16 sm:w-20 sm:h-20 p-1.5 rounded-2xl',
};

const WORDMARK_SIZES: Record<LogoVariant, string> = {
  compact: 'text-base',
  default: 'text-lg',
  large: 'text-2xl sm:text-3xl',
};

const SUBTITLE_SIZES: Record<LogoVariant, string> = {
  compact: 'text-[9px]',
  default: 'text-[10px]',
  large: 'text-xs',
};

export const Logo: React.FC<LogoProps> = ({
  variant = 'default',
  theme = 'light',
  layout = 'horizontal',
  showWordmark = true,
  showTagline = false,
  subtitle = 'University of Cape Coast',
  className = '',
}) => {
  const isStacked = layout === 'stacked';
  const isDark = theme === 'dark';

  return (
    <div
      className={`inline-flex ${
        isStacked ? 'flex-col items-center text-center gap-2.5' : 'flex-row items-center gap-2.5 sm:gap-3'
      } ${className}`}
    >
      {/* Official UCC Crest Container — neutral white backing preserves original colours without cropping */}
      <div
        className={`shrink-0 bg-white flex items-center justify-center border ${
          isDark ? 'border-white/25 shadow-md' : 'border-slate-200/90 shadow-xs'
        } ${CREST_SIZES[variant]}`}
      >
        <img
          src={UCC_CREST_PATH}
          alt="University of Cape Coast Official Crest"
          className="w-full h-full object-contain select-none"
          draggable={false}
        />
      </div>

      {showWordmark && (
        <div className={`flex flex-col leading-tight ${isStacked ? 'items-center' : 'items-start'}`}>
          <span
            className={`font-extrabold tracking-tight ${WORDMARK_SIZES[variant]} ${
              isDark ? 'text-white' : 'text-[#0B1F3A]'
            }`}
          >
            UCC<span className="text-[#C62828] ml-0.5">VOTE</span>
          </span>
          <span
            className={`tracking-wider uppercase font-semibold ${SUBTITLE_SIZES[variant]} ${
              isDark ? 'text-blue-100' : 'text-slate-500'
            }`}
          >
            {subtitle}
          </span>
          {showTagline && (
            <span
              className={`mt-1 text-[10px] font-bold tracking-widest uppercase ${
                isDark ? 'text-amber-300' : 'text-[#123B70]'
              }`}
            >
              YOUR VOICE. YOUR VOTE. YOUR UCC.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const BrandedLoadingScreen: React.FC<{
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
}> = ({
  title = 'UCC VOTE Electoral Portal',
  subtitle = 'Verifying institutional session and cryptographic integrity...',
  fullScreen = false,
}) => {
  return (
    <div
      className={`${
        fullScreen ? 'min-h-screen' : 'min-h-[340px]'
      } flex items-center justify-center p-6 bg-[#F4F6F9]`}
    >
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-sm max-w-md w-full text-center space-y-5">
        <div className="flex justify-center">
          <Logo variant="large" layout="stacked" showTagline />
        </div>
        <div className="space-y-2">
          <div className="w-40 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
            <div className="h-full w-1/2 bg-[#123B70] rounded-full animate-pulse" />
          </div>
          <h2 className="text-base font-bold text-slate-900 pt-1">{title}</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};
