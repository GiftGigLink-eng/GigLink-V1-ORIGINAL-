import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackNavButtonProps {
  label?: string;
  fallbackPath?: string;
  className?: string;
}

export const BackNavButton: React.FC<BackNavButtonProps> = ({
  label = 'Back',
  fallbackPath = '/',
  className = '',
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <button
      onClick={handleBack}
      id="back-nav-anchor"
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${className}`}
      aria-label={label}
    >
      <ArrowLeft className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
      <span>{label}</span>
    </button>
  );
};
