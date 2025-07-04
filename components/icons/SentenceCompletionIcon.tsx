
import React from 'react';

const SentenceCompletionIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
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
        <path d="M13 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9"></path>
        <path d="M14 4l5 5h-5V4Z"></path>
        <path d="M9 12h-1"></path>
        <path d="M15 12h-1"></path>
        <path d="M12 12h-1"></path>
        <path d="M10 18h4"></path>
        <path d="m17 15-1 1 1 1"></path>
        <path d="m14 15 1 1-1 1"></path>
    </svg>
);

export default SentenceCompletionIcon;
