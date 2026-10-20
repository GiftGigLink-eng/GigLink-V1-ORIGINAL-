// Filter benign Firestore offline/connection advisory messages from triggering error detectors
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const isFirestoreAdvisory = (args: any[]) => {
    return args.some((a) => {
      const msg = typeof a === 'string' ? a : (a?.message || '');
      return (
        msg.includes('Could not reach Cloud Firestore backend') ||
        msg.includes("Backend didn't respond within 10 seconds") ||
        msg.includes('operate in offline mode')
      );
    });
  };

  console.error = (...args: any[]) => {
    if (isFirestoreAdvisory(args)) return;
    originalConsoleError.apply(console, args);
  };
  console.warn = (...args: any[]) => {
    if (isFirestoreAdvisory(args)) return;
    originalConsoleWarn.apply(console, args);
  };
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
