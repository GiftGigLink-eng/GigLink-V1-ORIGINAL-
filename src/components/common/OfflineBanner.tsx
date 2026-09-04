import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      id="offline-banner"
      className="bg-amber-600 text-amber-50 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 text-center sticky top-0 z-50 shadow-sm"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>You are currently offline. Changes will sync when connectivity is restored.</span>
    </div>
  );
};
