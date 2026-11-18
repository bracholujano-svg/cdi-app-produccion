import React from 'react';

const CDILogo = ({ className = '', heightClass = 'h-10 md:h-12' }) => {
  return (
    <div
      className={`inline-flex items-center select-none bg-transparent shrink-0 ${className}`}
      aria-label="CDI - Donde la creatividad cobra vida"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 380 86"
        fill="none"
        className={`${heightClass} w-auto block`}
        style={{ backgroundColor: 'transparent' }}
      >
        <text
          x="4"
          y="68"
          fontFamily='"Arial Black", "Outfit", sans-serif'
          fontWeight="900"
          fontSize="72"
          letterSpacing="-2"
          fill="#F5EFC4"
          stroke="#2B3844"
          strokeWidth="2"
          paintOrder="stroke fill"
        >
          CDI
        </text>
        <rect x="148" y="8" width="228" height="70" fill="#485A69" />
        <text
          x="158"
          y="30"
          fontFamily='"Arial", "Helvetica", sans-serif'
          fontWeight="700"
          fontSize="18"
          letterSpacing="0.8"
          fill="#F8FAFC"
        >
          DONDE LA
        </text>
        <text
          x="158"
          y="50"
          fontFamily='"Arial", "Helvetica", sans-serif'
          fontWeight="700"
          fontSize="18"
          letterSpacing="0.8"
          fill="#F8FAFC"
        >
          CREATIVIDAD
        </text>
        <text
          x="158"
          y="70"
          fontFamily='"Arial", "Helvetica", sans-serif'
          fontWeight="700"
          fontSize="18"
          letterSpacing="0.8"
          fill="#F8FAFC"
        >
          COBRA VIDA
        </text>
      </svg>
    </div>
  );
};

export default CDILogo;
