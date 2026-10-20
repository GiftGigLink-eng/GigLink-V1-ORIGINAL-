/**
 * Server-Side Firebase Admin Initialization
 *
 * CRITICAL CONSTRAINTS:
 * 1. Strictly server-side (Node.js runtime). Never imported into browser bundles.
 * 2. Uses Google Application Default Credentials (ADC) provided by the Cloud Run runtime environment.
 * 3. Never requires or stores a private service-account JSON key file in the repository.
 * 4. Explicitly targets the canonical Firebase project: 'giglink-bf27b' (default database).
 * 5. Provides read-only querying capability for privileged backend aggregation (e.g. CEO metrics).
 */

import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export function getTargetProjectId(): string {
  return process.env.GCLOUD_PROJECT || firebaseConfig.projectId || 'giglink-bf27b';
}

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

export function getAdminApp(): App {
  if (!adminApp) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
    } else {
      adminApp = initializeApp({
        projectId: getTargetProjectId(),
      });
    }
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    const app = getAdminApp();
    adminAuth = getAuth(app);
  }
  return adminAuth;
}

export function getAdminFirestore(): Firestore {
  if (!adminDb) {
    const app = getAdminApp();
    adminDb = getFirestore(app);
    // Explicitly configure settings if required
    adminDb.settings({
      ignoreUndefinedProperties: true,
    });
  }
  return adminDb;
}
