
import React from 'react';

const SpellCheckIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
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
        <path d="m3 16 4 4 8-8" />
        <path d="m16 4-5 5" />
        <path d="M13.5 2.5a2.12 2.12 0 0 1 3 3L5 21l-4 1 1-4Z" />
    </svg>
);

export default SpellCheckIcon;
