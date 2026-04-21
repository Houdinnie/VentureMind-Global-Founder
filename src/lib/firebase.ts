import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Must use the firestoreDatabaseId from the config
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId); 
export const auth = getAuth(app);

// Connectivity check as per instructions
async function testConnection() {
  try {
    // Attempting to read a dummy doc to verify rules/connection
    await getDocFromServer(doc(db, '_internal', 'connectivity-check'));
  } catch (error: any) {
    if (error?.message?.includes('offline')) {
      console.error("Firebase connection failed: Client is offline.");
    }
  }
}

testConnection();

export default app;
