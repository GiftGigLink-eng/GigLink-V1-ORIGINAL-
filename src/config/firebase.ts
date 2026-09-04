/**
 * Firebase Initialization Module for GigLink V1
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app: FirebaseApp;
let authInstance: Auth;
let dbInstance: Firestore;

const config = firebaseConfig;

if (!getApps().length) {
  app = initializeApp(config);
} else {
  app = getApp();
}

authInstance = getAuth(app);

// Initialize Firestore with long-polling fallback to handle iframe/proxy environments
try {
  if (config && config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
    dbInstance = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    }, config.firestoreDatabaseId);
  } else {
    dbInstance = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  }
} catch {
  if (config && config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
    dbInstance = getFirestore(app, config.firestoreDatabaseId);
  } else {
    dbInstance = getFirestore(app);
  }
}

export { app };
export const auth = authInstance;
export const db = dbInstance;
