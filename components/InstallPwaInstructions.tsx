import React, { useState, useEffect } from 'react';
import ShareIcon from './icons/ShareIcon';

const InstallPwaInstructions: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if the user is on an iOS device and not in standalone mode
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    const isInStandaloneMode = () =>
      ('standalone' in window.navigator) && (window.navigator as any).standalone;

    if (isIos() && !isInStandaloneMode()) {
      setShow(true);
    }
  }, []);

  if (!show) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-lg z-50">
        <div className="bg-slate-800 text-white rounded-xl shadow-2xl p-4 ring-2 ring-slate-700">
            <p className="text-center text-sm leading-relaxed">
                To get the full app experience, add this to your Home Screen. Tap the
                <ShareIcon className="w-5 h-5 inline-block mx-1" />
                icon and then select 'Add to Home Screen'.
            </p>
        </div>
    </div>
  );
};

export default InstallPwaInstructions;
