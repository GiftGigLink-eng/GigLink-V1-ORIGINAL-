import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div id="not-found-view" className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-100 dark:border-indigo-900/40">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Page Not Found (404)</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The requested screen or canonical route does not exist in GigLink V1.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors min-h-[44px]"
          >
            <Home className="w-4 h-4" />
            <span>Return to Ecosystem Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
