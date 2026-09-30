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
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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

// Initialize Firestore with long-polling in browser to prevent 10s WebChannel proxy timeouts
const databaseId = config?.firestoreDatabaseId;

try {
  const isBrowser = typeof window !== 'undefined';
  const firestoreSettings = isBrowser ? { experimentalForceLongPolling: true } : {};
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
