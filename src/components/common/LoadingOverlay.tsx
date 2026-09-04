import React from 'react';

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Loading workspace data...',
  fullScreen = false,
}) => {
  return (
    <div
      id="loading-overlay"
      className={`flex flex-col items-center justify-center p-6 text-center ${
        fullScreen
          ? 'fixed inset-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm'
          : 'w-full py-12'
      }`}
    >
      <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{message}</p>
    </div>
  );
};
