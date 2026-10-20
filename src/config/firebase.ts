/**
 * Firebase Initialization Module for GigLink V1
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  getAuth,
  Auth,
} from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress transient non-fatal SDK connection warnings (e.g. 10s backend unreachable advisory)
try {
  setLogLevel('silent');
} catch {
  // Ignore in environments where setLogLevel is restricted
}

// Intercept harmless Firestore offline connection advisories from polluting console.error
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (
      msg.includes('Could not reach Cloud Firestore backend') ||
      msg.includes("Backend didn't respond within 10 seconds") ||
      msg.includes('operate in offline mode')
    ) {
      // Benign client offline state; demote to info/debug
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

let app: FirebaseApp;
let authInstance: Auth;
let dbInstance: Firestore;

const config = firebaseConfig;

if (!getApps().length) {
  app = initializeApp(config);
  try {
    authInstance = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    });
  } catch {
    authInstance = getAuth(app);
  }
} else {
  app = getApp();
  try {
    authInstance = getAuth(app);
  } catch {
    authInstance = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    });
  }
}

// Initialize Firestore with reliable forced long polling in browser/preview iframe
const databaseId = config?.firestoreDatabaseId;

try {
  const isBrowser = typeof window !== 'undefined';
  const firestoreSettings = {
    ignoreUndefinedProperties: true,
    ...(isBrowser ? { experimentalForceLongPolling: true } : {}),
  };
  if (databaseId && databaseId !== '(default)') {
    dbInstance = initializeFirestore(app, firestoreSettings, databaseId);
  } else {
    dbInstance = initializeFirestore(app, firestoreSettings);
  }
} catch {
  if (databaseId && databaseId !== '(default)') {
    dbInstance = getFirestore(app, databaseId);
  } else {
    dbInstance = getFirestore(app);
  }
}

export { app };
export const auth = authInstance;
export const db = dbInstance;
