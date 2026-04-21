import { LegalEntity } from '../types';
import { handleApiError } from '../lib/errorHandler';

export interface KYCResult {
  status: 'passed' | 'failed' | 'pending' | 'requires_action';
  checkId: string;
  provider: string;
  score: number;
  warnings: string[];
}

/**
 * Simulates a KYC/AML verification call to an external high-integrity provider.
 * In a production environment, this would call a real REST API like Sumsub, Veriff, or ComplyAdvantage.
 */
export async function performKYCCheck(entityName: string): Promise<KYCResult> {
  try {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 2500));

    const apiKey = process.env.VITE_KYC_API_KEY;
    if (!apiKey) {
      console.warn("KYC_API_KEY not found in environment. Running in restricted demo mode.");
    }

    // Implementation of a "real" check logic (using high-entropy deterministic simulation for demo)
    const isSuspicious = entityName.toLowerCase().includes('dark') || entityName.toLowerCase().includes('shell');
    
    return {
      status: isSuspicious ? 'requires_action' : 'passed',
      checkId: `KYC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      provider: 'VentureMind Compliance Gateway (V.2)',
      score: isSuspicious ? 42 : 98,
      warnings: isSuspicious 
        ? ['Entity name triggers high-risk keyword alerts', 'Potential shell company markers detected'] 
        : []
    };
  } catch (e) {
    handleApiError(e, 'KYC_VERIFICATION');
  }
}
