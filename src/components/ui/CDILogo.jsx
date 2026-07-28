import React from 'react';

const CDILogo = ({ className = "" }) => {
  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      {/* CDI Letters */}
      <span className="text-5xl md:text-6xl font-black tracking-tighter theme-text-main leading-none" style={{ fontFamily: '"Outfit", sans-serif' }}>
        CDI
      </span>
      
      {/* Divider */}
      <div className="h-[3px] md:h-[4px] w-full bg-[var(--color-primary)] rounded-full mt-1 mb-1"></div>
      
      {/* Horizontal Text */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-1 text-center w-full mt-1">
        <span className="text-sm md:text-base font-bold tracking-[0.2em] theme-text-main leading-tight">DISEÑO EN</span>
        <span className="text-sm md:text-base font-black tracking-[0.2em] theme-text-main leading-tight">EXHIBICIÓN</span>
      </div>
    </div>
  );
};

export default CDILogo;
