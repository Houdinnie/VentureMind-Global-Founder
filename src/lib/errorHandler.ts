import { auth } from './firebase';

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export class AppError extends Error {
  public code: string;
  public details?: any;
  public timestamp: string;
  public context?: string;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', details?: any, context?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Handles Firestore-specific errors with high-integrity context injection.
 */
export function handleFirestoreError(error: any, operation: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  const user = auth.currentUser;
  
  if (error?.message?.includes('insufficient permissions')) {
    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType: operation,
      path: path,
      authInfo: {
        userId: user?.uid || 'anonymous',
        email: user?.email || 'none',
        emailVerified: user?.emailVerified || false,
        isAnonymous: user?.isAnonymous || true,
        providerInfo: user?.providerData?.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || ''
        })) || []
      }
    };
    
    const stringifiedError = JSON.stringify(errorInfo, null, 2);
    console.error(`[FIRESTORE_SECURITY_VIOLATION]: ${stringifiedError}`);
    throw new Error(stringifiedError);
  }
  
  console.error(`[FIRESTORE_API_ERROR] [${operation}] [PATH: ${path}]:`, error);
  throw new AppError(error?.message || 'A database error occurred', 'DATABASE_ERROR', error, `Firestore:${operation}`);
}

/**
 * Normalizes API errors into structured AppErrors.
 */
export function handleApiError(error: any, serviceContext: string): never {
  console.error(`[API_COMMUNICATION_ANOMALY] [${serviceContext}]:`, error);
  
  const message = error instanceof Error ? error.message : String(error);
  
  // Specific handling for common API issues
  if (message.includes('API key not found') || message.includes('INVALID_ARGUMENT')) {
    throw new AppError('Neural authentication parameters are missing or invalid.', 'API_AUTH_ERROR', error, serviceContext);
  }

  if (message.includes('overloaded') || message.includes('503')) {
    throw new AppError('The Neural Network is currently experiencing high load. Retrying in T-minus 10 seconds...', 'API_CAPACITY_ERROR', error, serviceContext);
  }

  throw new AppError(message || 'An unexpected service anomaly occurred.', 'SERVICE_ERROR', error, serviceContext);
}

/**
 * Global logging mechanism for application-wide tracing.
 */
export function logError(error: any, context: string) {
  const timestamp = new Date().toISOString();
  const user = auth.currentUser;
  
  const logPayload = {
    timestamp,
    context,
    user: user ? { uid: user.uid, email: user.email } : 'Guest',
    error: {
      message: error?.message || String(error),
      code: error instanceof AppError ? error.code : 'UNKNOWN',
      details: error instanceof AppError ? error.details : null
    }
  };

  console.error(`[SYSTEM_EVENT_LOG] [${timestamp}] [CONTEXT: ${context}]`, logPayload);
  
  if (window) {
    (window as any).__VM_ERROR_LOG = (window as any).__VM_ERROR_LOG || [];
    (window as any).__VM_ERROR_LOG.push(logPayload);
  }
}

/**
 * Translates technical error codes into human-centric advisory messages.
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!error) return "System Anomaly: An unexpected state occurred within the Global OS kernel.";

  if (typeof error === 'string' && error.includes('authInfo')) {
    try {
      const info = JSON.parse(error) as FirestoreErrorInfo;
      if (info.operationType === 'write' || info.operationType === 'create') {
        return "REGULATORY BLOCK: Your account lacks the required clearance to modify this jurisdictional vector.";
      }
      return "ACCESS DENIED: Neural link to this data segment is currently restricted.";
    } catch (e) {
      return "A security protocols violation has occurred.";
    }
  }

  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any).code || '';

  // API Errors
  if (code === 'API_AUTH_ERROR') return "Neural Link Denied: Identification tokens are invalid or missing.";
  if (code === 'API_CAPACITY_ERROR') return "Mantra Network Overloaded: Decelerating analysis cycles. Please standby.";
  
  // Firebase Auth Errors
  if (msg.includes('auth/invalid-credential')) return "Authentication Failed: Neural handshake rejected. Please re-verify identification.";
  if (msg.includes('auth/user-not-found')) return "Identity Unknown: No record of this founder exists in the central registry.";
  if (msg.includes('auth/wrong-password')) return "Passkey Rejection: Cryptographic identification mismatch.";
  if (msg.includes('auth/popup-closed-by-user')) return "Handshake Aborted: Central registry connection closed by the operative.";
  
  // Generic Network/Platform Errors
  if (msg.includes('network-error') || msg.includes('Failed to fetch')) return "Connectivity link unstable. Retrying synchronization...";
  if (msg.includes('quota-exceeded')) return "System resources exhausted. Please upgrade your operational tier.";
  if (msg.includes('auth/invalid-email')) return "Identification mismatch: Provided email is not recognized by the central registry.";
  
  if (error instanceof AppError) return error.message;

  return "System Anomaly: An unexpected error occurred within the Global OS kernel.";
}
