import React from 'react';

interface BrandHeaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  white?: boolean;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({ 
  className = '', 
  size = 'md',
  white = false 
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* UCC Crest Emblem Icon */}
      <div className={`relative flex items-center justify-center rounded-lg font-extrabold tracking-wider transition-transform ${
        size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-11 h-11 text-base' : 'w-9 h-9 text-sm'
      } ${
        white ? 'bg-white text-[#123B70] shadow-sm' : 'bg-[#123B70] text-white shadow-sm'
      }`}>
        <span className="font-mono">UCC</span>
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#C62828] rounded-full border-2 border-white" />
      </div>

      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          <span className={`font-extrabold tracking-tight ${
            size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg'
          } ${white ? 'text-white' : 'text-[#0B1F3A]'}`}>
            UCC<span className="text-[#C62828] ml-0.5">VOTE</span>
          </span>
        </div>
        <span className={`text-[10px] tracking-wider uppercase font-semibold ${
          white ? 'text-blue-100' : 'text-slate-500'
        }`}>
          University of Cape Coast
        </span>
      </div>
    </div>
  );
};
