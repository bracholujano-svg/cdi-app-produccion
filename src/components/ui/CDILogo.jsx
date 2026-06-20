import React from 'react';

const CDILogo = ({ className = "" }) => {
  return (
    <div className={`flex items-center select-none ${className}`}>
      {/* CDI Letters */}
      <span className="text-4xl md:text-5xl font-black tracking-tighter text-[var(--text-main)] leading-none" style={{ fontFamily: '"Outfit", sans-serif' }}>
        CDI
      </span>
      
      {/* Divider */}
      <div className="w-[3px] h-10 md:h-12 bg-[var(--primary)] mx-2 md:mx-3 rounded-full opacity-80"></div>
      
      {/* Vertical Text */}
      <div className="flex flex-col justify-center items-start" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
        <span className="text-[9px] md:text-[10px] font-medium tracking-[0.2em] text-[var(--text-main)] opacity-90 leading-tight">DISEÑO en</span>
        <span className="text-[11px] md:text-[12px] font-black tracking-[0.2em] text-[var(--text-main)] leading-tight">EXHIBICIÓN</span>
      </div>
    </div>
  );
};

export default CDILogo;
