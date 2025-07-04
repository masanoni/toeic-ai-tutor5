import React from 'react';

const CarIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={className}
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M14 16.94A2 2 0 1 1 10.06 15M4.01 15.14A2 2 0 1 1 0 16.94"/>
        <path d="M4 17h6l2-4H4.22A2 2 0 0 0 2.25 15c0 .7.36 1.34.9 1.7"/>
        <path d="m14 7-2 4h8.5a2 2 0 0 1 1.95 2.57l-1.23 4.93A2 2 0 0 1 19.3 20H14.1a2 2 0 0 1-1.95-1.43L11.5 16"/>
        <path d="M6.5 13H11"/>
    </svg>
);

export default CarIcon;
