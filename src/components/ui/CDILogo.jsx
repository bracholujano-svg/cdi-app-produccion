import React from 'react';

const CDILogo = ({
  className = '',
  heightClass = 'h-11 md:h-12',
  showWordmark = false,
  wordmarkClassName = ''
}) => {
  return (
    <div
      className={`inline-flex items-center gap-3 select-none bg-transparent shrink-0 ${className}`}
      aria-label="CDI Exhibiciones"
    >
      <img
        src="/cdi-logo.png"
        alt="CDI Exhibiciones"
        className={`${heightClass} w-auto object-contain drop-shadow-[0_2px_6px_rgba(15,23,42,0.22)] block shrink-0`}
      />
      {showWordmark && (
        <span
          className={`font-bold tracking-tight text-[#1E293B] dark:text-slate-100 leading-none ${wordmarkClassName || 'text-sm md:text-base'}`}
        >
          CDI EXHIBICIONES
        </span>
      )}
    </div>
  );
};

export default CDILogo;
