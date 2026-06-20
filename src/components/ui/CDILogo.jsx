import React from 'react';

const CDILogo = ({ className = "" }) => {
  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      {/* CDI Letters */}
      <span className="text-4xl md:text-5xl font-black tracking-tighter text-[var(--text-main)] leading-none" style={{ fontFamily: '"Outfit", sans-serif' }}>
        CDI
      </span>
      
      {/* Divider */}
      <div className="h-[2px] md:h-[3px] w-full bg-[var(--primary)] rounded-full opacity-80 mt-1 mb-1"></div>
      
      {/* Horizontal Text */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-0 md:gap-1 text-center w-full mt-0.5">
        <span className="text-[7.5px] md:text-[8.5px] font-medium tracking-[0.2em] text-[var(--text-main)] opacity-90 leading-tight">DISEÑO EN</span>
        <span className="text-[8.5px] md:text-[9.5px] font-black tracking-[0.2em] text-[var(--text-main)] leading-tight">EXHIBICIÓN</span>
      </div>
    </div>
  );
};

export default CDILogo;
