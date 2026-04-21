export type SwarmStatus = 'queued' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
export type EntityType = 'LLC' | 'Ltd' | 'Inc' | 'Foundation';
export type EntityStatus = 'active' | 'pending' | 'dissolved';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  residency?: string;
  credits: number;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentReport {
  id: string;
  name: string;
  type: 'Legal' | 'Tax' | 'Compliance' | 'Governance';
  generatedBy: string;
  timestamp: number;
  content?: string;
  url?: string;
}

export interface LegalEntity {
  id: string;
  ownerId: string;
  name: string;
  jurisdiction: string;
  type: EntityType;
  status: EntityStatus;
  complianceScore: number;
  kycStatus: 'unverified' | 'pending' | 'passed' | 'failed' | 'requires_action';
  kycCheckId?: string;
  formationNotes?: { [key: number]: string };
  reports?: DocumentReport[];
  createdAt: number;
}

export interface Swarm {
  id: string;
  ownerId: string;
  prompt: string;
  status: SwarmStatus;
  cost: number;
  agentPersonas: string[];
  reports?: DocumentReport[];
  createdAt: number;
}

export interface Task {
  id: string;
  swarmId: string;
  persona: string;
  description: string;
  result?: string;
  status: 'pending' | 'processing' | 'done';
  completedAt?: number;
}

export interface VisaStatus {
  id: string;
  ownerId: string;
  country: string;
  visaType: string;
  status: 'active' | 'expiring' | 'expired' | 'pending' | 'none';
  expiryDate?: string;
  complianceScore: number;
  remoteWorkAllowed: boolean;
}

export interface FundingRound {
  id: string;
  entityId: string;
  ownerId: string;
  roundName: 'Pre-Seed' | 'Seed' | 'Series A' | 'Series B' | 'Bridge';
  amount: number;
  postMoneyValuation: number;
  investors: string[];
  date: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
