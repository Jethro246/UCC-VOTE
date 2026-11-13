import React from 'react';
import { Logo, LogoLayout, LogoVariant } from './Logo';

interface BrandHeaderProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  white?: boolean;
  layout?: LogoLayout;
  showTagline?: boolean;
  subtitle?: string;
}

const SIZE_TO_VARIANT: Record<'sm' | 'md' | 'lg', LogoVariant> = {
  sm: 'compact',
  md: 'default',
  lg: 'large',
};

export const BrandHeader: React.FC<BrandHeaderProps> = ({
  className = '',
  size = 'md',
  white = false,
  layout = 'horizontal',
  showTagline = false,
  subtitle = 'University of Cape Coast',
}) => {
  return (
    <Logo
      variant={SIZE_TO_VARIANT[size]}
      theme={white ? 'dark' : 'light'}
      layout={layout}
      showWordmark
      showTagline={showTagline}
      subtitle={subtitle}
      className={className}
    />
  );
};
