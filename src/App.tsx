import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  User, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Building2, 
  Cpu, 
  CreditCard, 
  Settings, 
  LogOut, 
  Plus, 
  Terminal, 
  ShieldCheck,
  ChevronRight,
  Loader2,
  Globe,
  PlusCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  TrendingUp,
  Landmark,
  X,
  Send,
  MessageSquare,
  Zap,
  Sparkles,
  Pause,
  Play,
  XCircle,
  FileText,
  ArrowLeftRight,
  Eye,
  Download,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './lib/firebase';
import { cn } from './lib/utils';
import { handleFirestoreError, logError, getFriendlyErrorMessage } from './lib/errorHandler';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { UserProfile, LegalEntity, Swarm, Task, DocumentReport, VisaStatus, FundingRound, ChatMessage, SwarmStatus } from './types';
import { decomposeIntent, executeAgentTask, PlanStep, checkNomadicCompliance, chatWithMantra, consultPersona } from './services/geminiService';
import { performKYCCheck } from './services/kycService';

// --- Shared Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-4 px-6 py-4 text-xs font-medium transition-all group relative",
      active ? "text-white" : "text-white/40 hover:text-white"
    )}
  >
    {active && (
      <motion.div 
        layoutId="active-bar" 
        className="absolute left-0 w-1 h-6 bg-amber-500 rounded-full" 
      />
    )}
    <Icon size={18} className={cn("transition-colors", active ? "text-amber-500" : "group-hover:text-white/60")} />
    <span className="uppercase tracking-[0.2em]">{label}</span>
  </button>
);

const MetricCard = ({ label, value, sublabel }: { label: string, value: string | number, sublabel?: string }) => (
  <div className="bg-white/5 border border-white/10 p-6 lg:p-8 rounded-xl backdrop-blur-sm group hover:border-amber-500/30 transition-all">
    <span className="col-header block mb-4">{label}</span>
    <span className="text-3xl lg:text-4xl font-serif font-light tracking-tight">{value}</span>
    {sublabel && <span className="text-[10px] text-white/30 font-mono mt-3 block uppercase tracking-widest">{sublabel}</span>}
  </div>
);

const ErrorAdvisory = ({ error, onClose }: { error: any, onClose: () => void }) => {
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-6 right-6 left-6 md:left-auto md:right-12 md:w-[400px] z-[100] bg-[#0c0505] border border-red-500/30 rounded-2xl p-6 backdrop-blur-xl shadow-2xl flex items-start gap-4 overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/50 via-amber-500/50 to-red-500/50" />
      <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
        <AlertTriangle size={20} className="text-red-500" />
      </div>
      <div className="flex-1 space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-500">System Anomaly Detected</h4>
        <p className="text-sm font-serif italic text-white/80 leading-relaxed">
          {getFriendlyErrorMessage(error)}
        </p>
        
        {showTechnical && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 p-3 bg-black/40 border border-white/5 rounded-lg text-[8px] font-mono text-white/40 overflow-x-auto"
          >
            <pre>{JSON.stringify({
              code: error?.code || 'UNKNOWN',
              message: error?.message || String(error),
              context: error?.context || 'GLOBAL',
              timestamp: error?.timestamp || new Date().toISOString()
            }, null, 2)}</pre>
          </motion.div>
        )}

        <div className="flex gap-4 pt-2">
          <button 
            onClick={onClose}
            className="text-[9px] uppercase tracking-widest font-bold text-white/40 hover:text-white transition-colors"
          >
            Acknowledge
          </button>
          <button 
            onClick={() => setShowTechnical(!showTechnical)}
            className="text-[9px] uppercase tracking-widest font-bold text-amber-500/60 hover:text-amber-500 transition-colors"
          >
            {showTechnical ? 'Hide Diagnostics' : 'View Diagnostics'}
          </button>
        </div>
      </div>
      <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
        <X size={16} />
      </button>
    </motion.div>
  );
};

// --- Pages ---

const JURISDICTIONS = [
  { 
    name: 'Wyoming', 
    desc: 'Privacy-focused, Common Law, Zero State Tax', 
    cat: 'US/CAN', 
    features: ['Series LLC Support', 'No minimum capital', 'Strong asset protection'],
    tax: '0% State',
    governance: 'Common Law',
    speed: '2-3 Days',
    currency: 'USD'
  },
  { 
    name: 'Estonia', 
    desc: 'e-Residency, EU Nexus, 20% Uniform Tax', 
    cat: 'EU', 
    features: ['100% Digital management', '0% tax on reinvested profits', 'EU Single Market access'],
    tax: '20% (Profits)',
    governance: 'Civil Law',
    speed: '1-5 Days',
    currency: 'EUR'
  },
  { 
    name: 'Singapore', 
    desc: 'Stable, Financial Hub, Low Corporate Tax', 
    cat: 'ASIA', 
    features: ['Territorial tax system', 'Extensive DTA network', 'VCC fund structures'],
    tax: '17% (Global)',
    governance: 'Common Law',
    speed: '1-2 Days',
    currency: 'SGD'
  },
  { 
    name: 'Cayman Islands', 
    desc: 'Zero-tax, Hedge Fund Hub, Tax Neutral', 
    cat: 'CARB', 
    features: ['Exempt company status', 'No reporting requirements', 'Global capital gateway'],
    tax: '0%',
    governance: 'Common Law',
    speed: '4-7 Days',
    currency: 'KYD'
  }
];

const ComparisonModal = ({ src, target, onClose }: { src: any, target: any, onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 lg:p-8"
  >
    <motion.div 
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      className="bg-[#0A0A0A] border border-white/10 rounded-[24px] lg:rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
    >
      <div className="px-6 lg:px-10 py-6 lg:py-8 border-b border-white/5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <ArrowLeftRight size={18} className="text-amber-500" />
          </div>
          <h3 className="text-xl lg:text-2xl font-serif">Jurisdiction Matchup</h3>
        </div>
        <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="p-6 lg:p-10 grid grid-cols-2 lg:grid-cols-3 gap-8 overflow-y-auto custom-scrollbar flex-1">
        <div className="hidden lg:block space-y-8">
          <div className="h-20 flex flex-col justify-end">
            <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold mb-2">Metric</span>
          </div>
          {['Nexus', 'Tax Profile', 'Legal Framework', 'Processing Time'].map(m => (
            <div key={m} className="h-12 flex items-center border-b border-white/5">
              <span className="text-xs text-white/40 font-mono uppercase tracking-wider">{m}</span>
            </div>
          ))}
        </div>

        <div className="space-y-8 bg-white/[0.02] p-6 rounded-2xl border border-white/5 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest whitespace-nowrap">Active Choice</div>
          <div className="h-20 flex flex-col justify-end">
            <h4 className="text-2xl font-serif text-amber-500">{src.name}</h4>
          </div>
          {[src.cat, src.tax, src.governance, src.speed].map((v, i) => (
            <div key={i} className="h-12 flex flex-col lg:flex-row lg:items-center text-sm font-serif">
              <span className="lg:hidden text-[8px] uppercase text-white/20 font-mono mb-1">{['Nexus', 'Tax', 'Law', 'Speed'][i]}</span>
              {v}
            </div>
          ))}
        </div>

        <div className="space-y-8 p-6 rounded-2xl border border-white/5">
          <div className="h-20 flex flex-col justify-end">
            <h4 className="text-2xl font-serif text-white/60">{target.name}</h4>
          </div>
          {[target.cat, target.tax, target.governance, target.speed].map((v, i) => (
            <div key={i} className="h-12 flex flex-col lg:flex-row lg:items-center text-sm font-serif text-white/40">
              <span className="lg:hidden text-[8px] uppercase text-white/10 font-mono mb-1">{['Nexus', 'Tax', 'Law', 'Speed'][i]}</span>
              {v}
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 lg:px-10 py-6 lg:py-8 bg-white/[0.02] border-t border-white/5 flex justify-end shrink-0">
        <button 
          onClick={onClose}
          className="w-full lg:w-auto px-8 py-3 bg-white text-black rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-amber-500 hover:text-white transition-all shadow-xl"
        >
          Close Analysis
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const LegalPolicyModal = ({ onClose }: { onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 lg:p-8"
  >
    <motion.div 
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-[#050505] border border-white/10 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,1)] relative flex flex-col max-h-[85vh]"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      
      <div className="px-8 lg:px-12 py-8 lg:py-10 border-b border-white/5 flex justify-between items-center shrink-0">
        <div className="space-y-1">
          <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase block">Legal Protocol VM-01</span>
          <h3 className="text-2xl lg:text-3xl font-serif font-light">Global Terms & Disclaimers</h3>
        </div>
        <button onClick={onClose} className="p-2 text-white/20 hover:text-white transition-colors bg-white/5 rounded-full">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-12 custom-scrollbar">
        <section className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 border-l-2 border-amber-500 pl-4">1. Neural Swarm Disclaimer</h4>
          <p className="text-sm font-serif italic text-white/70 leading-relaxed">
            The VentureMind Global Founder OS utilizes high-autonomy Neural Swarms to simulate legal and fiscal architectures. 
            <strong> These agents are not professional legal counsel, and their outputs do not constitute legal or financial advice.</strong> 
            All suggestions must be audited by qualified professionals in the respective jurisdictions (Wyoming, Estonia, Singapore, etc.).
          </p>
        </section>

        <section className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 border-l-2 border-white/20 pl-4">2. Developer Liability Protection</h4>
          <div className="space-y-2 text-xs font-mono text-white/40 leading-relaxed uppercase tracking-wider">
            <p className="border-b border-white/5 pb-2">• THE DEVELOPERS OF VENTUREMIND DISCLAIM ALL LIABILITY FOR FINANCIAL LOSS.</p>
            <p className="border-b border-white/5 pb-2">• ALL OPERATIONS CONDUCTED VIA THE MANTRA INTERFACE ARE AS-IS.</p>
            <p className="border-b border-white/5 pb-2">• USER INDEMNIFIES DEVELOPERS AGAINST ALL THIRD-PARTY CLAIMS.</p>
            <p>• NO FIDUCIARY DUTY IS CREATED BY AUTHENTICATION TO THIS OS.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 border-l-2 border-white/20 pl-4">3. Data Residency & Encryption</h4>
          <p className="text-sm font-serif italic text-white/70 leading-relaxed">
            VentureMind employs e-Residency nexus protocols for EU-data compliance. While communication is encrypted, 
            the user acknowledges the recursive nature of AI simulations and agrees to the ingestion of provided data 
            for the sole purpose of operational simulation and automation routing.
          </p>
        </section>

        <section className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 border-l-2 border-white/20 pl-4">4. Intellectual Property Isolation</h4>
          <p className="text-sm font-serif italic text-white/70 leading-relaxed">
            All code blocks, formation notes, and jurisdictional blueprints generated by the system are licensed 
            to the user for internal use only. The underlying Mantra Intelligence Kernel remains the exclusive 
            intellectual property of the VentureMind Core Developers.
          </p>
        </section>
      </div>

      <div className="p-8 lg:p-12 border-t border-white/5 bg-white/[0.02] shrink-0">
        <button 
          onClick={onClose}
          className="w-full bg-white text-black py-4 rounded-2xl font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-amber-500 hover:text-white transition-all shadow-2xl"
        >
          Acknowledge & Seal Protocol
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const EntityFormationWizard = ({ onComplete, onCancel, userProfile, onError }: { onComplete: () => void, onCancel: () => void, userProfile: UserProfile, onError: (e: any, ctx: string) => void }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    jurisdiction: '',
    type: 'LLC' as LegalEntity['type'],
    currency: 'USD',
  });
  const [isConsulting, setIsConsulting] = useState(false);
  const [isVerifyingKYC, setIsVerifyingKYC] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [kycResult, setKycResult] = useState<{ status: string; checkId: string } | null>(null);
  const [stepNotes, setStepNotes] = useState<{ [key: number]: string }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [comparingJurisdiction, setComparingJurisdiction] = useState<any | null>(null);
  const [activeSwarmId, setActiveSwarmId] = useState<string | null>(null);
  const [swarmTasks, setSwarmTasks] = useState<Task[]>([]);
  const [swarmType, setSwarmType] = useState<'legal' | 'document' | 'jurisdiction' | null>(null);
  const [selectedReport, setSelectedReport] = useState<DocumentReport | null>(null);

  const [reports, setReports] = useState<DocumentReport[]>([]);

  const validateStep = (currentStep: number) => {
    const newErrors: { [key: string]: string } = {};
    if (currentStep === 1) {
      const name = formData.name;
      if (!name) newErrors.name = "Entity name is required";
      else if (name !== name.trim()) newErrors.name = "Leading or trailing whitespace is disallowed";
      else if (name.length < 3) newErrors.name = "Name must be at least 3 characters";
      else if (name.length > 60) newErrors.name = "Name must be under 60 characters";
      else if (/[^a-zA-Z0-9\s-]/.test(name)) newErrors.name = "Only alphanumeric, spaces, and hyphens allowed";

      if (!formData.type) newErrors.type = "Corporate architecture selection is required";
    }
    if (currentStep === 2) {
      if (!formData.jurisdiction) newErrors.jurisdiction = "Please select a jurisdiction to continue";
    }
    if (currentStep === 3) {
      if (!advice) newErrors.advice = "Legal Nexus Audit must be executed via Persona L4";
    }
    
    const notes = stepNotes[currentStep];
    if (notes && notes.length > 1000) {
      newErrors.notes = "Formation notes exceed the 1000 character integrity limit";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const steps = [
    { id: 1, title: 'Identification', icon: Terminal },
    { id: 2, title: 'Jurisdiction', icon: Globe },
    { id: 3, title: 'KYC/AML', icon: ShieldCheck },
    { id: 4, title: 'Finalize', icon: CheckCircle2 }
  ];

  useEffect(() => {
    if (!activeSwarmId) return;

    const qTasks = query(collection(db, 'tasks'), where('swarmId', '==', activeSwarmId));
    const unsub = onSnapshot(qTasks, (snapshot) => {
      const ts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setSwarmTasks(ts);
      
      const allDone = ts.length > 0 && ts.every(t => t.status === 'done');
      if (allDone) {
        setAdvice(ts.map(t => `[${t.persona}]: ${t.description}`).join('\n\n'));
        
        // Generate high-integrity reports based on persona logic
        const generatedReports: DocumentReport[] = ts.map((t, idx) => ({
          id: `rep_${t.id}_${Date.now()}`,
          name: `${t.persona.split(' ').pop()} Audit v1.0`,
          type: (t.persona.toLowerCase().includes('tax') ? 'Tax' : 
                 t.persona.toLowerCase().includes('lawyer') ? 'Legal' : 
                 t.persona.toLowerCase().includes('software') ? 'Governance' : 'Compliance') as DocumentReport['type'],
          generatedBy: t.persona,
          content: t.description,
          timestamp: Date.now() + (idx * 60000), // Spaced out for realism
        }));
        setReports(generatedReports);
        setIsConsulting(false);
      }
    }, (e) => onError(e, 'WIZARD_SWARM_SYNC'));

    return () => unsub();
  }, [activeSwarmId]);

  const handlePerformKYC = async () => {
    setIsVerifyingKYC(true);
    try {
      const result = await performKYCCheck(formData.name);
      setKycResult(result);
    } catch (e) {
      onError(e, 'KYC_VERIFICATION_STREAM');
    } finally {
      setIsVerifyingKYC(false);
    }
  };

  const triggerNexusSwarm = async (type: 'legal' | 'document' | 'jurisdiction') => {
    setIsConsulting(true);
    setSwarmType(type);
    setActiveSwarmId(null);
    setSwarmTasks([]);
    
    try {
      const fileNames = uploadedFiles.map(f => f.name).join(', ');
      let prompt = '';
      
      if (type === 'legal') {
        prompt = `Perform a full jurisdictional audit for an ${formData.type} named "${formData.name}" in ${formData.jurisdiction}. 
        Task: Comprehensive Legal Nexus Assessment. 
        ${fileNames ? `Uploaded Legal Documents: ${fileNames}.` : ''}
        Analyze suitability, tax implications, and regulatory compliance requirements.`;
      } else if (type === 'document') {
        prompt = `Analyze the newly uploaded documents: ${fileNames}.
        Context: Entity formation for "${formData.name}" (Type: ${formData.type}) in ${formData.jurisdiction}.
        Task: Document Intelligence & Compliance Verification. Extract key risks and obligations.`;
      } else if (type === 'jurisdiction') {
        prompt = `Analyze jurisdictional suitability of ${formData.jurisdiction} for a ${formData.type} named "${formData.name}".
        Task: Jurisdictional Nexus & Tax Optimization Audit.
        Evaluate against global nomadic standards and EU/US data residency protocols.`;
      }
      
      const steps = await decomposeIntent(prompt, type === 'legal' ? "Entity Lawyer" : "Compliance Officer");
      
      const swarmRef = await addDoc(collection(db, 'swarms'), {
        ownerId: userProfile.uid,
        prompt: prompt,
        status: 'running',
        cost: steps.length * 10,
        agentPersonas: Array.from(new Set(steps.map(s => s.persona))),
        type: type,
        createdAt: Date.now()
      }).catch(e => handleFirestoreError(e, 'create', 'swarms'));

      for (const step of steps) {
        await addDoc(collection(db, 'tasks'), {
          swarmId: swarmRef.id,
          persona: step.persona,
          description: step.description,
          status: 'pending'
        }).catch(e => handleFirestoreError(e, 'create', 'tasks'));
      }

      setActiveSwarmId(swarmRef.id);
    } catch (e) {
      onError(e, 'SWARM_WIZARD_INIT');
      setIsConsulting(false);
    }
  };

  useEffect(() => {
    // Automatically trigger document audit when files are added in Step 3
    if (step === 3 && uploadedFiles.length > 0 && !activeSwarmId && !advice && !isConsulting) {
      triggerNexusSwarm('document');
    }
  }, [uploadedFiles.length, step, isConsulting]);

  const handleConsultLawyer = () => {
    setAdvice(null);
    triggerNexusSwarm('legal');
  };

  const handleFinalize = async () => {
    try {
      await addDoc(collection(db, 'entities'), {
        ownerId: userProfile.uid,
        name: formData.name,
        jurisdiction: formData.jurisdiction,
        type: formData.type,
        status: 'pending',
        complianceScore: 100,
        kycStatus: kycResult?.status || 'unverified',
        kycCheckId: kycResult?.checkId || '',
        formationNotes: stepNotes,
        reports: reports,
        createdAt: Date.now()
      });
      onComplete();
    } catch (e) {
      try {
        handleFirestoreError(e, 'create', 'entities');
      } catch (fe) {
        onError(fe, 'ENTITY_FORMATION');
      }
    }
  };

  return (
    <div className="bg-[#050505] border border-white/10 rounded-[24px] lg:rounded-[32px] overflow-hidden shadow-2xl w-full max-w-2xl mx-auto relative flex flex-col max-h-[90vh]">
      <div className="h-1 bg-white/5 w-full shrink-0">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(step / steps.length) * 100}%` }}
          className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-500"
        />
      </div>
      <div className="px-6 lg:px-8 py-5 lg:py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
        <div className="flex gap-2 lg:gap-4 overflow-x-auto no-scrollbar">
          {steps.map((s) => (
            <div key={s.id} className="flex items-center gap-2 shrink-0">
              <div className={cn(
                "w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold border transition-all",
                step >= s.id ? "bg-amber-500 border-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]" : "bg-white/5 border-white/10 text-white/20"
              )}>{step > s.id ? <CheckCircle2 size={10} /> : s.id}</div>
              <span className={cn(
                "hidden sm:block text-[9px] lg:text-[10px] uppercase tracking-widest font-bold",
                step === s.id ? "text-white" : "text-white/20"
              )}>{s.title}</span>
            </div>
          ))}
        </div>
        <button onClick={onCancel} className="text-white/20 hover:text-white p-2 -mr-2"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-12 space-y-8 custom-scrollbar">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="space-y-2">
                <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">Phase 01</span>
                <h3 className="text-3xl font-serif font-light">Entity Identification</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Proposed Name</label>
                    <span className={cn(
                      "text-[9px] font-mono tracking-widest",
                      formData.name.length > 60 ? "text-red-500" : "text-white/20"
                    )}>
                      {formData.name.length}/60
                    </span>
                  </div>
                  <input 
                    className={cn(
                      "w-full bg-white/5 border rounded-xl px-6 py-4 outline-none transition-all font-serif text-xl text-white",
                      errors.name ? "border-red-500/50 bg-red-500/5" : "border-white/10 focus:border-amber-500/50"
                    )}
                    placeholder="e.g. Cyberdyn Global"
                    value={formData.name}
                    onChange={e => {
                      setFormData({...formData, name: e.target.value});
                      if (errors.name) setErrors({...errors, name: ''});
                    }}
                  />
                  {errors.name && <p className="text-[10px] text-red-500 font-mono uppercase tracking-wider">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Corporate Architecture</label>
                  <div className="grid grid-cols-2 gap-4">
                    {['LLC', 'Ltd', 'Inc', 'Foundation'].map(t => (
                      <button 
                        key={t}
                        onClick={() => {
                          setFormData({...formData, type: t as any});
                          if (errors.type) setErrors({...errors, type: ''});
                        }}
                        className={cn(
                          "px-6 py-4 rounded-xl border text-xs font-bold tracking-widest transition-all",
                          formData.type === t ? "bg-white text-black border-white" : "bg-white/5 border-white/10 hover:border-white/30",
                          errors.type && "border-red-500/50"
                        )}
                      >{t}</button>
                    ))}
                  </div>
                  {errors.type && <p className="text-[10px] text-red-500 font-mono uppercase tracking-wider">{errors.type}</p>}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="space-y-2">
                <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">Phase 02</span>
                <h3 className="text-3xl font-serif font-light">Jurisdictional Selection</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {errors.jurisdiction && <p className="text-[10px] text-red-500 font-mono uppercase tracking-wider mb-2">{errors.jurisdiction}</p>}
                {JURISDICTIONS.map(j => (
                  <div key={j.name} className="relative group">
                    <button 
                      onClick={() => {
                        setFormData({...formData, jurisdiction: j.name, currency: j.currency});
                        if (errors.jurisdiction) setErrors({...errors, jurisdiction: ''});
                      }}
                      className={cn(
                        "w-full p-6 rounded-2xl border flex flex-col gap-4 transition-all text-left group relative",
                        formData.jurisdiction === j.name 
                          ? "bg-amber-500/10 border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.1)] scale-[1.02]" 
                          : "bg-white/5 border-white/10 hover:bg-white/[0.08]"
                      )}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-3">
                            <p className="font-serif text-xl tracking-tight text-white group-hover:text-amber-200 transition-colors">{j.name}</p>
                            {formData.jurisdiction === j.name && (
                              <motion.div
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                className="text-amber-500"
                              >
                                <CheckCircle2 size={18} />
                              </motion.div>
                            )}
                          </div>
                          <p className="text-[11px] text-amber-500/60 font-mono uppercase tracking-widest mt-1 font-bold">{j.desc}</p>
                        </div>
                        <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest border border-white/5 px-2 py-1 rounded bg-white/5">{j.cat}</span>
                      </div>

                      {formData.jurisdiction === j.name && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-4 border-t border-amber-500/20"
                        >
                          <div className="flex flex-wrap gap-2">
                            {j.features.map((f, idx) => (
                              <span key={idx} className="text-[9px] uppercase tracking-wider bg-white/5 border border-white/10 px-2 py-1 rounded-full text-white/60">
                                • {f}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </button>
                    {formData.jurisdiction && formData.jurisdiction !== j.name && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setComparingJurisdiction(j);
                        }}
                        className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all bg-white/5 hover:bg-amber-500 text-white/40 hover:text-black p-2 rounded-lg border border-white/10 flex items-center gap-2 text-[8px] font-bold uppercase tracking-widest z-10"
                      >
                        <ArrowLeftRight size={12} />
                        Compare
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {comparingJurisdiction && (
                  <ComparisonModal 
                    src={JURISDICTIONS.find(x => x.name === formData.jurisdiction)!} 
                    target={comparingJurisdiction} 
                    onClose={() => setComparingJurisdiction(null)} 
                  />
                )}
              </AnimatePresence>

              {formData.jurisdiction && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 pt-6 border-t border-white/5"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Base Operational Currency</label>
                    <button 
                      onClick={() => triggerNexusSwarm('jurisdiction')}
                      disabled={isConsulting}
                      className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-amber-500 font-bold hover:text-white transition-colors disabled:opacity-30"
                    >
                      <Sparkles size={12} className={cn(isConsulting && swarmType === 'jurisdiction' && "animate-spin")} />
                      {isConsulting && swarmType === 'jurisdiction' ? "Auditing Suitability..." : "Neural Suitability Audit"}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                    {['USD', 'EUR', 'GBP', 'SGD', 'KYD', 'CHF', 'JPY', 'CAD'].map(cur => (
                      <button 
                        key={cur}
                        onClick={() => setFormData({...formData, currency: cur})}
                        className={cn(
                          "py-2 rounded-lg border text-[10px] font-bold tracking-widest transition-all",
                          formData.currency === cur ? "bg-amber-500 border-amber-500 text-black" : "bg-white/5 border-white/10 hover:border-white/30 text-white/40"
                        )}
                      >
                        {cur}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="space-y-2">
                <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">Phase 03</span>
                <h3 className="text-3xl font-serif font-light">Legal Nexus Audit</h3>
                {errors.advice && <p className="text-[10px] text-red-500 font-mono uppercase tracking-wider">{errors.advice}</p>}
              </div>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <span className="text-[10px] uppercase font-bold text-white/30">Configuration</span>
                  <span className="font-serif text-amber-200">{formData.name} / {formData.type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold text-white/30">Nexus</span>
                  <span className="font-serif text-amber-200">{formData.jurisdiction}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Supporting Documentation</span>
                  <div className="flex items-center gap-4">
                    {uploadedFiles.length > 0 && !isConsulting && (
                      <button 
                        onClick={() => triggerNexusSwarm('document')}
                        className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-amber-500 font-bold hover:text-white transition-colors"
                      >
                        <Zap size={10} /> Re-analyze Docs
                      </button>
                    )}
                    <label className="cursor-pointer bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest font-bold transition-colors">
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        onChange={e => {
                          if (e.target.files) {
                            const newFiles = Array.from(e.target.files!);
                            setUploadedFiles(prev => [...prev, ...newFiles]);
                            setAdvice(null);
                          }
                        }}
                      />
                      Upload Context
                    </label>
                  </div>
                </div>
                
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {uploadedFiles.map((file, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-3 group hover:border-amber-500/30 transition-all shadow-sm"
                      >
                        <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <FileText size={12} className="text-amber-500" />
                        </div>
                        <span className="text-[10px] font-mono text-white/70 truncate max-w-[140px]" title={file.name}>
                          {file.name}
                        </span>
                        <button 
                          onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded-md text-white/20 hover:text-red-500 transition-all"
                          aria-label="Remove file"
                        >
                          <X size={12} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {!advice ? (
                <div className="space-y-4">
                  {isConsulting && activeSwarmId && swarmTasks.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest">
                          {swarmType === 'document' ? 'Document Intelligence Swarm' : 
                           swarmType === 'jurisdiction' ? 'Jurisdictional Nexus Audit' : 
                           'Active Neural Swarm'}
                        </span>
                        <span className="text-[10px] font-mono text-amber-500 font-bold">
                          {Math.round((swarmTasks.filter(t => t.status === 'done').length / swarmTasks.length) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(swarmTasks.filter(t => t.status === 'done').length / swarmTasks.length) * 100}%` }}
                          className="h-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all duration-500"
                        />
                      </div>
                      <div className="space-y-2 max-h-[120px] overflow-y-auto no-scrollbar pt-2 border-t border-white/5">
                        {swarmTasks.map(t => (
                          <div key={t.id} className="flex items-center gap-3">
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              t.status === 'done' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500/30 animate-pulse"
                            )} />
                            <span className="text-[9px] font-mono uppercase tracking-tighter text-white/40 w-24">{t.persona}</span>
                            <span className="text-[9px] text-white/20 truncate">{t.description}</span>
                            {t.status === 'done' && <CheckCircle2 size={10} className="text-emerald-500 ml-auto" />}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  
                  <button 
                    onClick={handleConsultLawyer}
                    disabled={isConsulting}
                    className="w-full flex items-center justify-center gap-3 bg-amber-500 text-black py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-amber-400 transition-all font-mono shadow-[0_10px_20px_rgba(245,158,11,0.1)]"
                  >
                    {isConsulting ? (
                      <><Loader2 size={16} className="animate-spin" /> Orchestrating Neural Swarm...</>
                    ) : (
                      <><ShieldCheck size={16} /> Execute Legal Nexus Swarm</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-8 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]" />
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <ShieldCheck size={16} className="text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.3em]">Neural Nexus Verdict</p>
                      <p className="text-[8px] text-white/20 font-mono uppercase tracking-widest mt-0.5">Aggregated Persona Audit • 0xFF_L4</p>
                    </div>
                  </div>
                  <div className="space-y-4 text-xs text-white/80 leading-relaxed font-serif whitespace-pre-wrap">
                    {advice}
                  </div>

                  {reports.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Neural Audit Artifacts</span>
                        <span className="text-[10px] font-mono text-amber-500/50">{reports.length} Reports Generated</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {reports.map((report) => (
                          <motion.div 
                            key={report.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:border-amber-500/30 transition-all group"
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
                              report.type === 'Legal' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                              report.type === 'Tax' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                              "bg-amber-500/10 border-amber-500/20 text-amber-500"
                            )}>
                              <FileText size={20} />
                            </div>
                            <div className="flex-1 space-y-1 overflow-hidden">
                              <p className="text-[11px] font-bold text-white/80 group-hover:text-white transition-colors truncate">{report.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-mono uppercase text-white/20">{report.type}</span>
                                <span className="text-[8px] text-white/10">•</span>
                                <span className="text-[8px] font-mono text-white/20">{new Date(report.timestamp).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedReport(report); }}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-white/20 hover:text-white transition-all"
                                title="View Report"
                              >
                                <Eye size={12} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); alert(`Downloading ${report.name}...`); }}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-white/20 hover:text-white transition-all"
                                title="Download Report"
                              >
                                <Download size={12} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    {selectedReport && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setSelectedReport(null)}
                          className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 20 }}
                          className="relative w-full max-w-lg bg-[#050505] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
                        >
                          <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center border",
                                selectedReport.type === 'Legal' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                                selectedReport.type === 'Tax' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                "bg-amber-500/10 border-amber-500/20 text-amber-500"
                              )}>
                                <FileText size={20} />
                              </div>
                              <div className="space-y-0.5">
                                <span className={cn(
                                  "text-[8px] font-mono uppercase tracking-[0.3em] font-bold",
                                  selectedReport.type === 'Legal' ? "text-blue-500/80" :
                                  selectedReport.type === 'Tax' ? "text-emerald-500/80" :
                                  "text-amber-500/80"
                                )}>{selectedReport.type} Audit Artifact</span>
                                <h3 className="text-xl font-serif italic text-white/90">{selectedReport.name}</h3>
                              </div>
                            </div>
                            <button onClick={() => setSelectedReport(null)} className="text-white/20 hover:text-white transition-colors">
                              <X size={20} />
                            </button>
                          </div>
                          
                          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar">
                            <div className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-3 border border-white/5 font-mono text-[10px]">
                              <span className="text-white/20 uppercase tracking-widest">Generated By:</span>
                              <span className="text-amber-500/80">{selectedReport.generatedBy}</span>
                            </div>
                            
                            <div className="space-y-3">
                              <span className="text-[9px] uppercase font-bold text-white/20 tracking-[0.2em]">Audit Content</span>
                              <p className="text-xs text-white/60 leading-relaxed font-serif whitespace-pre-wrap italic opacity-80 border-l border-white/10 pl-6">
                                "{selectedReport.content}"
                              </p>
                            </div>

                            <div className="pt-6 border-t border-white/5 flex gap-4">
                              <button 
                                onClick={() => setSelectedReport(null)}
                                className="flex-1 bg-white/5 border border-white/10 text-white/50 py-3 rounded-xl font-bold uppercase tracking-widest text-[9px] hover:bg-white/10 hover:text-white transition-all"
                              >Close Artifact</button>
                              <button 
                                onClick={() => { alert(`Downloading ${selectedReport.name}...`); setSelectedReport(null);}}
                                className="flex-1 bg-white text-black py-3 rounded-xl font-bold uppercase tracking-widest text-[9px] hover:bg-amber-500 hover:text-white transition-all"
                              >Download PDF</button>
                            </div>
                          </div>

                          <div className="px-8 py-3 bg-white/[0.02] border-t border-white/5 flex justify-between items-center italic">
                            <span className="text-[8px] font-mono text-white/10 uppercase tracking-widest">Global Founder OS Audit Stream 0xFFL4</span>
                            <span className="text-[8px] font-mono text-white/10">{new Date(selectedReport.timestamp).toLocaleString()}</span>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="space-y-2">
                <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">Phase 04</span>
                <h3 className="text-3xl font-serif font-light">KYC & AML Verification</h3>
              </div>

              <div className="text-sm text-white/40 leading-relaxed font-serif italic border-l-2 border-white/10 pl-6 mb-8">
                "Identity is the base layer of the Global Founder OS. We must verify the biometric and jurisdictional alignment of the entity principals."
              </div>

              {!kycResult ? (
                <div className="space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/20">
                      <Sparkles size={32} />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-mono">Neutral Compliance Gateway Ready</p>
                    <button 
                      onClick={handlePerformKYC}
                      disabled={isVerifyingKYC}
                      className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-amber-500 hover:text-white transition-all disabled:opacity-20 flex items-center justify-center gap-3"
                    >
                      {isVerifyingKYC ? <Loader2 size={16} className="animate-spin" /> : "Initiate Verification"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className={cn(
                    "border rounded-2xl p-8 space-y-4 relative overflow-hidden",
                    kycResult.status === 'passed' ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
                  )}>
                    <div className={cn(
                      "absolute top-0 left-0 w-1 h-full",
                      kycResult.status === 'passed' ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <ShieldCheck size={20} className={kycResult.status === 'passed' ? "text-emerald-500" : "text-red-500"} />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Verification Status</p>
                          <h4 className="text-xl font-serif capitalize text-white">{kycResult.status}</h4>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-mono text-white/20 uppercase tracking-tighter">Check Identity</p>
                        <p className="text-[10px] font-mono text-white/40">{kycResult.checkId}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Provider Gateway</span>
                    <span className="text-[10px] font-mono text-white/60">VentureMind Compliance V.2</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-12 pt-8 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-white/30 hover:text-white transition-colors cursor-default">
            <MessageSquare size={12} />
            <span className="text-[10px] uppercase tracking-widest font-bold">Formation Notes</span>
          </div>
          <textarea 
            value={stepNotes[step] || ''}
            onChange={e => {
              setStepNotes({ ...stepNotes, [step]: e.target.value });
              if (errors.notes) setErrors({...errors, notes: ''});
            }}
            placeholder={`Add strategic context or requirements for ${steps.find(s => s.id === step)?.title}...`}
            className={cn(
              "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all font-mono text-[11px] text-white/60 min-h-[80px] resize-none",
              errors.notes ? "border-red-500/50" : "border-white/10 focus:border-amber-500/30"
            )}
          />
          {errors.notes && <p className="text-[10px] text-red-500 font-mono uppercase tracking-wider">{errors.notes}</p>}
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between gap-4">
          {step > 1 && (
            <button 
              onClick={() => setStep(step - 1)}
              className="flex-1 border border-white/10 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all text-white/50"
            >Back</button>
          )}
          {step < 4 ? (
            <button 
              onClick={handleNextStep}
              className="flex-[2] bg-white text-black py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-amber-500 hover:text-white transition-all shadow-[0_4px_14px_0_rgba(255,255,255,0.1)] active:scale-[0.98]"
            >Advance Stream</button>
          ) : (
            <button 
              disabled={kycResult?.status !== 'passed'}
              onClick={handleFinalize}
              className="flex-[2] bg-emerald-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-all disabled:opacity-20"
            >Finalize Vector</button>
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardView = ({ entities, credits, visas, onNewClick }: { entities: LegalEntity[], credits: number, visas: VisaStatus[], onNewClick: () => void }) => (
  <div className="space-y-12">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <MetricCard label="Active Entities" value={entities.length} sublabel="Autonomous Operations" />
      <MetricCard label="Mantra Credits" value={credits.toLocaleString()} sublabel="Available Fuel" />
      <MetricCard label="Nomad Status" value={visas.find(v => v.status === 'active')?.country || 'None'} sublabel="Current Active Residency" />
      <MetricCard label="System Integrity" value="98.2%" sublabel="Compliance Index" />
    </div>

    <section className="space-y-6">
      <div className="flex justify-between items-end border-b border-white/10 pb-4">
        <h2 className="font-serif italic text-3xl font-light">Managed Entities</h2>
        <button 
          onClick={onNewClick}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/50 hover:text-white transition-colors"
        >
          <PlusCircle size={16} className="text-amber-500" /> New Formation
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="hidden md:grid grid-cols-4 px-8 py-4 bg-white/[0.03] border-b border-white/10">
          <span className="col-header">Entity Identification</span>
          <span className="col-header">Status / Audit</span>
          <span className="col-header">Architecture</span>
          <span className="col-header text-right">Operational Status</span>
        </div>
        {entities.length === 0 ? (
          <div className="p-12 md:p-20 text-center text-white/20 italic font-serif text-sm">No autonomous entities detected in current vector.</div>
        ) : (
          entities.map(entity => (
            <div key={entity.id} className="data-row flex flex-col md:grid md:grid md:grid-cols-4 px-6 md:px-8 py-6 gap-4 md:gap-0 group border-b border-white/5 md:border-none last:border-none">
              <div className="flex flex-col">
                <span className="font-serif text-lg group-hover:text-amber-200 transition-colors uppercase tracking-tight">{entity.name}</span>
                <span className="data-value text-[10px] text-white/30 uppercase tracking-widest">{entity.jurisdiction}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg border shrink-0",
                  entity.kycStatus === 'passed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                )}>
                  <ShieldCheck size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">KYC: {entity.kycStatus}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-white/20 uppercase tracking-tighter">ID: {entity.kycCheckId?.substring(0, 12)}...</span>
                    {entity.reports && entity.reports.length > 0 && (
                      <span className="bg-amber-500/10 text-amber-500 text-[7px] px-1.5 py-0.5 rounded border border-amber-500/20 font-bold uppercase tracking-widest">
                        {entity.reports.length} Reports
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center md:items-start flex-row md:flex-col gap-2 md:gap-0">
                <span className="md:hidden text-[8px] uppercase tracking-widest text-white/20 font-bold">Type:</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{entity.type}</span>
              </div>
              <div className="flex justify-start md:justify-end items-center">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                  entity.status === 'active' 
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                )}>
                  {entity.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  </div>
);

const NomadLogisticsView = ({ visas, userProfile, onError }: { visas: VisaStatus[], userProfile: UserProfile, onError: (e: any, ctx: string) => void }) => {
  const [checkingCompliance, setCheckingCompliance] = useState(false);
  const [complianceResult, setComplianceResult] = useState<string | null>(null);
  const [targetCountry, setTargetCountry] = useState('');

  const registerDummyVisa = async () => {
    try {
      await addDoc(collection(db, 'visas'), {
        ownerId: userProfile.uid,
        country: 'Portugal',
        visaType: 'Digital Nomad (D8)',
        status: 'active',
        expiryDate: '2027-05-12',
        complianceScore: 95,
        remoteWorkAllowed: true
      }).catch(e => handleFirestoreError(e, 'create', 'visas'));
    } catch (e) {
      onError(e, 'VISA_REGISTRATION');
    }
  };

  const runComplianceCheck = async () => {
    if (!targetCountry) return;
    setCheckingCompliance(true);
    setComplianceResult(null);
    try {
      const res = await checkNomadicCompliance(targetCountry, userProfile.residency || 'Unknown');
      setComplianceResult(res);
    } catch (e) {
      onError(e, 'NOMADIC_COMPLIANCE_RUN');
    } finally {
      setCheckingCompliance(false);
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end border-b border-white/10 pb-4">
        <div className="space-y-2">
          <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">Global Mobility Tracking</span>
          <h2 className="font-serif italic text-3xl font-light text-white">Nomad Logistics</h2>
        </div>
        <button 
          onClick={registerDummyVisa}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/50 hover:text-white transition-colors"
        >
          <PlusCircle size={16} className="text-amber-500" /> Register Visa
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          <h3 className="col-header uppercase tracking-wider">Active Visa Vectors</h3>
          <div className="space-y-4">
            {visas.length === 0 ? (
              <div className="bg-white/5 border border-dashed border-white/10 p-8 rounded-2xl text-center text-white/30 italic font-serif">
                None specifically tracked. Use the registry to initiate a vector.
              </div>
            ) : (
              visas.map(visa => (
                <div key={visa.id} className="bg-white/5 border border-white/10 p-6 rounded-2xl flex justify-between items-center group hover:border-amber-500/30 transition-all">
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                      <Globe size={18} className="text-white/40" />
                    </div>
                    <div>
                      <h4 className="font-serif text-lg">{visa.country}</h4>
                      <p className="text-[10px] uppercase tracking-widest text-white/40">{visa.visaType} • Ends {visa.expiryDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={cn(
                        "block text-[9px] font-bold uppercase tracking-[0.2em] mb-1 px-2 py-0.5 rounded border",
                        visa.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      )}>{visa.status}</span>
                      <span className="text-[9px] text-white/20 font-mono">Compliance: {visa.complianceScore}%</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="col-header uppercase tracking-wider">Automated Compliance Logic</h3>
          <div className="bg-gradient-to-br from-white/[0.08] to-transparent p-8 rounded-3xl border border-white/10 space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Target Jurisdiction</label>
              <div className="flex gap-4">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Search size={16} className="text-white/20" />
                  <input 
                    type="text" 
                    value={targetCountry}
                    onChange={(e) => setTargetCountry(e.target.value)}
                    placeholder="Search country nexus..." 
                    className="bg-transparent border-none outline-none text-white font-serif flex-1"
                  />
                </div>
                <button 
                  onClick={runComplianceCheck}
                  disabled={checkingCompliance || !targetCountry}
                  className="bg-white text-black px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all disabled:opacity-20"
                >
                  {checkingCompliance ? <Loader2 size={16} className="animate-spin" /> : "Verify Compliance"}
                </button>
              </div>
            </div>

            {complianceResult && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-black/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck size={16} className="text-amber-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 text-amber-500">Nomad-C9 Verification Output</span>
                </div>
                <div className="space-y-4 text-xs text-white/70 leading-relaxed font-light">
                  {complianceResult.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ComplianceDashboardView = ({ entities, visas }: { entities: LegalEntity[], visas: VisaStatus[] }) => {
  const avgEntityScore = entities.length > 0 
    ? Math.round(entities.reduce((acc, e) => acc + (e.complianceScore || 0), 0) / entities.length) 
    : 100;
  
  const avgVisaScore = visas.length > 0 
    ? Math.round(visas.reduce((acc, v) => acc + (v.complianceScore || 0), 0) / visas.length) 
    : 100;

  const totalIntegrity = Math.round((avgEntityScore + avgVisaScore) / 2);

  const trendData = React.useMemo(() => {
    if (entities.length === 0) return [];
    
    const sortedEntities = [...entities].sort((a, b) => a.createdAt - b.createdAt);
    
    const dailyPoints: { [key: string]: number[] } = {};
    sortedEntities.forEach(e => {
        const day = new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (!dailyPoints[day]) dailyPoints[day] = [];
        dailyPoints[day].push(e.complianceScore || 0);
    });

    let cumulativeSum = 0;
    let cumulativeCount = 0;
    return Object.entries(dailyPoints).map(([date, scores]) => {
        cumulativeSum += scores.reduce((s, b) => s + b, 0);
        cumulativeCount += scores.length;
        return {
            date,
            score: Math.round(cumulativeSum / cumulativeCount)
        };
    });
  }, [entities]);

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-white/10 pb-4 gap-6">
        <div className="space-y-2">
          <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">System Health Monitoring</span>
          <h2 className="font-serif italic text-3xl font-light text-white">Compliance Dashboard</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="block text-[10px] uppercase tracking-widest text-white/30 mb-1">Global Integrity</span>
            <span className="text-2xl font-serif text-amber-500">{totalIntegrity}%</span>
          </div>
          <ShieldCheck size={32} className="text-amber-500/50" />
        </div>
      </div>

      <section className="space-y-6">
        <h3 className="col-header uppercase tracking-wider">Integrity Velocity Trend</h3>
        <div className="h-64 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="rgba(255,255,255,0.3)" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                dy={10}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.3)" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#050505', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontFamily: 'monospace'
                }}
                itemStyle={{ color: '#f59e0b' }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#f59e0b" 
                strokeWidth={2} 
                dot={{ fill: '#f59e0b', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2, fill: '#050505' }}
                animationDuration={2000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="col-header uppercase tracking-wider">Entity Compliance Vectors</h3>
            <span className="text-[10px] font-mono text-white/30">Avg: {avgEntityScore}%</span>
          </div>
          <div className="space-y-px bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            {entities.length === 0 ? (
              <div className="p-12 text-center text-white/20 italic font-serif">No entity vectors currently active.</div>
            ) : (
              entities.map(entity => (
                <div key={entity.id} className="data-row px-8 py-6 flex justify-between items-center group">
                  <div className="space-y-1">
                    <span className="font-serif text-lg group-hover:text-amber-200 transition-colors block">{entity.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-white/40">{entity.jurisdiction} • {entity.type}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${entity.complianceScore || 0}%` }}
                        className={cn(
                          "h-full rounded-full transition-all",
                          (entity.complianceScore || 0) > 90 ? "bg-emerald-500" : (entity.complianceScore || 0) > 70 ? "bg-amber-500" : "bg-red-500"
                        )}
                      />
                    </div>
                    <span className="font-mono text-xs w-8 text-right">{(entity.complianceScore || 0)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="col-header uppercase tracking-wider">Mobility Operational Health</h3>
            <span className="text-[10px] font-mono text-white/30">Avg: {avgVisaScore}%</span>
          </div>
          <div className="space-y-px bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            {visas.length === 0 ? (
              <div className="p-12 text-center text-white/20 italic font-serif">No logistics vectors defined.</div>
            ) : (
              visas.map(visa => (
                <div key={visa.id} className="data-row px-8 py-6 flex justify-between items-center group">
                  <div className="space-y-1">
                    <span className="font-serif text-lg group-hover:text-amber-200 transition-colors block">{visa.country}</span>
                    <span className="text-[10px] uppercase tracking-widest text-white/40">{visa.visaType} • Status: {visa.status}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${visa.complianceScore || 0}%` }}
                        className={cn(
                          "h-full rounded-full transition-all",
                          (visa.complianceScore || 0) > 90 ? "bg-emerald-500" : (visa.complianceScore || 0) > 70 ? "bg-amber-500" : "bg-red-500"
                        )}
                      />
                    </div>
                    <span className="font-mono text-xs w-8 text-right">{(visa.complianceScore || 0)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-8 flex items-start gap-6">
        <AlertTriangle className="text-amber-500 shrink-0" size={24} />
        <div className="space-y-2">
          <h4 className="text-sm font-bold uppercase tracking-widest text-amber-500">Anomaly Advisory</h4>
          <p className="text-xs text-white/60 leading-relaxed font-light">
            System has detected potential residency-overlap in the EU vector. Ensure your primary fiscal nexus remains aligned with the D8 protocol to avoid accidental PE (Permanent Establishment) triggers.
          </p>
        </div>
      </div>
    </div>
  );
};

const AddFundingRoundModal = ({ entities, userProfile, onComplete, onCancel, onError }: { entities: LegalEntity[], userProfile: UserProfile, onComplete: () => void, onCancel: () => void, onError: (e: any, ctx: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    entityId: entities[0]?.id || '',
    roundName: 'Seed' as FundingRound['roundName'],
    date: new Date().toISOString().split('T')[0],
    amount: '',
    postMoneyValuation: '',
    investors: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.entityId || !formData.amount || !formData.postMoneyValuation) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'fundingRounds'), {
        ownerId: userProfile.uid,
        entityId: formData.entityId,
        roundName: formData.roundName,
        date: formData.date,
        amount: Number(formData.amount),
        postMoneyValuation: Number(formData.postMoneyValuation),
        investors: formData.investors.split(',').map(i => i.trim()).filter(i => i !== ''),
        createdAt: Date.now()
      }).catch(e => handleFirestoreError(e, 'create', 'fundingRounds'));
      onComplete();
    } catch (e) {
      onError(e, 'FUNDING_REGISTRATION');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 lg:p-6 pb-24 md:pb-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 bg-black/90 lg:bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl bg-[#050505] border border-white/10 rounded-3xl lg:rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="px-6 lg:px-8 py-5 lg:py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div className="space-y-1">
            <span className="text-amber-500 text-[9px] font-mono tracking-[0.4em] uppercase">Equity Entry</span>
            <h3 className="text-xl font-serif italic font-light">Register Funding Event</h3>
          </div>
          <button onClick={onCancel} className="text-white/20 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold text-white/40 tracking-widest">Legal Entity</label>
              <select 
                value={formData.entityId}
                onChange={e => setFormData({...formData, entityId: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-amber-500/50 transition-all font-serif text-sm appearance-none"
              >
                {entities.map(e => <option key={e.id} value={e.id} className="bg-[#050505]">{e.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold text-white/40 tracking-widest">Round Tier</label>
              <select 
                value={formData.roundName}
                onChange={e => setFormData({...formData, roundName: e.target.value as any})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-amber-500/50 transition-all font-serif text-sm appearance-none"
              >
                {['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Bridge'].map(r => <option key={r} value={r} className="bg-[#050505]">{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold text-white/40 tracking-widest">Closing Date</label>
              <input 
                type="date"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-amber-500/50 transition-all font-serif text-sm color-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold text-white/40 tracking-widest">Amount Raised (USD)</label>
              <input 
                type="number"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                placeholder="250000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-amber-500/50 transition-all font-serif text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] uppercase font-bold text-white/40 tracking-widest">Post-Money Valuation (USD)</label>
            <input 
              type="number"
              value={formData.postMoneyValuation}
              onChange={e => setFormData({...formData, postMoneyValuation: e.target.value})}
              placeholder="12000000"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-amber-500/50 transition-all font-serif text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] uppercase font-bold text-white/40 tracking-widest">Investors (Comma separated)</label>
            <textarea 
              value={formData.investors}
              onChange={e => setFormData({...formData, investors: e.target.value})}
              placeholder="VentureMind Alpha, Angel Swarm, Founder Fund..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-amber-500/50 transition-all font-serif text-sm min-h-[80px]"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-amber-500 hover:text-white transition-all disabled:opacity-20 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={14} /> Register Event</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const CapitalDashboardView = ({ rounds, entities, userProfile, onError }: { rounds: FundingRound[], entities: LegalEntity[], userProfile: UserProfile, onError: (e: any, ctx: string) => void }) => {
  const [addingRound, setAddingRound] = useState(false);
  const totalRaised = rounds.reduce((acc, r) => acc + r.amount, 0);
  const latestValuation = rounds.length > 0 
    ? Math.max(...rounds.map(r => r.postMoneyValuation)) 
    : 0;

  const seedDummyData = async () => {
    if (entities.length === 0) {
      onError(new Error("Entity Required: Please create an entity first via the Wizard."), 'CAPITAL_SEEDING_PRECHECK');
      return;
    }
    try {
      const entityId = entities[0].id;
      const dummyRounds = [
        { roundName: 'Pre-Seed', amount: 250000, postMoneyValuation: 2500000, investors: ['Angel Swarm', 'VentureMind Alpha'], date: '2025-01-15' },
        { roundName: 'Seed', amount: 1500000, postMoneyValuation: 12000000, investors: ['Sequoia-Replica', 'Founder Fund Index'], date: '2025-11-20' }
      ];

      for (const r of dummyRounds) {
        await addDoc(collection(db, 'fundingRounds'), {
          ...r,
          entityId,
          ownerId: userProfile.uid,
          createdAt: Date.now()
        }).catch(e => handleFirestoreError(e, 'create', 'fundingRounds'));
      }
    } catch (e) {
      onError(e, 'CAPITAL_SEEDING_HANDSHAKE');
    }
  };

  return (
    <div className="space-y-12 pb-12 lg:pb-0">
      <AnimatePresence>
        {addingRound && (
          <AddFundingRoundModal 
            entities={entities} 
            userProfile={userProfile} 
            onComplete={() => setAddingRound(false)} 
            onCancel={() => setAddingRound(false)} 
            onError={onError}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-white/10 pb-4 gap-6">
        <div className="space-y-2">
          <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">Equity & Capitalization</span>
          <h2 className="font-serif italic text-3xl lg:text-3xl font-light text-white">Capital History</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4 lg:gap-6">
          <button 
            onClick={() => setAddingRound(true)}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500 hover:text-white transition-colors"
          >
            <Plus size={16} /> New Round
          </button>
          <button 
            onClick={seedDummyData}
            className="text-[9px] uppercase tracking-widest text-white/20 hover:text-white transition-all underline underline-offset-4"
          >Seed History</button>
          <div className="flex gap-12">
            <div className="text-right">
              <span className="block text-[10px] uppercase tracking-widest text-white/30 mb-1">Total Capital Raised</span>
              <span className="text-2xl font-serif text-white">${(totalRaised / 1000000).toFixed(1)}M</span>
            </div>
            <div className="text-right border-l border-white/10 pl-12">
              <span className="block text-[10px] uppercase tracking-widest text-white/30 mb-1">Max Valuation</span>
              <span className="text-2xl font-serif text-amber-500">${(latestValuation / 1000000).toFixed(1)}M</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12">
        <section className="space-y-6">
          <h3 className="col-header uppercase tracking-wider">Funding Rounds</h3>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="hidden md:grid grid-cols-[1fr_120px_150px_150px_200px] px-8 py-4 bg-white/[0.03] border-b border-white/10">
              <span className="col-header">Round</span>
              <span className="col-header">Date</span>
              <span className="col-header">Amount</span>
              <span className="col-header italic">Valuation</span>
              <span className="col-header">Investors</span>
            </div>
            {rounds.length === 0 ? (
              <div className="p-12 lg:p-20 text-center text-white/20 italic font-serif text-sm">Registry is empty. No funding events recorded.</div>
            ) : (
              rounds.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(round => (
                <div key={round.id} className="flex flex-col md:grid md:grid-cols-[1fr_120px_150px_150px_200px] px-6 lg:px-8 py-6 items-start md:items-center group hover:bg-white/[0.02] transition-colors border-b border-white/5 md:border-none last:border-none gap-4 md:gap-0">
                  <div className="flex flex-col">
                    <span className="font-serif text-lg group-hover:text-amber-200 transition-colors uppercase tracking-tight">{round.roundName}</span>
                    <span className="text-[10px] text-white/30 uppercase tracking-widest">
                      {entities.find(e => e.id === round.entityId)?.name || 'Unknown Entity'}
                    </span>
                  </div>
                  <div className="flex items-center md:items-start flex-row md:flex-col gap-2 md:gap-0">
                    <span className="md:hidden text-[8px] uppercase tracking-widest text-white/20 font-bold">Date:</span>
                    <span className="data-value text-xs text-white/60">{new Date(round.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center md:items-start flex-row md:flex-col gap-2 md:gap-0">
                    <span className="md:hidden text-[8px] uppercase tracking-widest text-white/20 font-bold">Amount:</span>
                    <span className="font-mono text-sm text-emerald-500">${(round.amount / 1000).toLocaleString()}K</span>
                  </div>
                  <div className="flex items-center md:items-start flex-row md:flex-col gap-2 md:gap-0">
                    <span className="md:hidden text-[8px] uppercase tracking-widest text-white/20 font-bold">Valuation:</span>
                    <span className="font-mono text-sm text-white/80">${(round.postMoneyValuation / 1000000).toFixed(1)}M</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {round.investors.map((inv, idx) => (
                      <span key={idx} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider text-white/40">
                        {inv}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="col-header uppercase tracking-wider">Valuation Velocity</h3>
          <div className="bg-white/5 border border-white/10 p-12 rounded-3xl backdrop-blur-sm h-64 flex items-end gap-4">
            {rounds.length > 0 ? (
              rounds.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((round, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${(round.postMoneyValuation / latestValuation) * 100}%` }}
                    className="w-full bg-gradient-to-t from-amber-600/20 to-amber-500 rounded-t-lg relative"
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-white/10 px-2 py-1 rounded text-[9px] font-mono whitespace-nowrap">
                      ${(round.postMoneyValuation / 1000000).toFixed(1)}M
                    </div>
                  </motion.div>
                  <span className="text-[9px] uppercase tracking-tighter text-white/20 font-bold">{round.roundName}</span>
                </div>
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/10 font-serif italic text-lg">No growth data available</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const PersonaConsultView = ({ personaName, icon: Icon, onError }: { personaName: string, icon: any, onError: (e: any, ctx: string) => void }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await consultPersona(personaName, input, history);
      
      const modelMsg: ChatMessage = {
        role: 'model',
        text: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (e) {
      onError(e, 'PERSONA_CONSULT');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[75vh] max-w-4xl mx-auto bg-white/[0.02] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl backdrop-blur-xl">
      <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Icon size={24} />
          </div>
          <div>
            <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">RPM Persona Active</span>
            <h2 className="text-xl font-serif italic text-white font-light">{personaName} Gateway</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Secure Encryption Active</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/10">
              <Icon size={28} />
            </div>
            <div className="max-w-xs space-y-3">
              <h3 className="text-xl font-serif italic text-white">Consulting {personaName}</h3>
              <p className="text-[11px] text-white/40 leading-relaxed uppercase tracking-wider">Direct neural link established for strategic wealth optimization and international tax architecture.</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex flex-col max-w-[85%]",
              m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div className={cn(
              "px-6 py-4 rounded-[20px] text-sm leading-relaxed",
              m.role === 'user' 
                ? "bg-amber-500 text-black font-medium rounded-tr-none shadow-lg shadow-amber-500/10" 
                : "bg-white/5 border border-white/10 text-white/90 rounded-tl-none"
            )}>
              {m.text}
            </div>
            <span className="text-[8px] uppercase tracking-tighter text-white/20 mt-2 font-mono ml-2">
              {new Date(m.timestamp).toLocaleTimeString()}
            </span>
          </motion.div>
        ))}
        {loading && (
          <div className="flex mr-auto items-start ml-2">
            <div className="bg-white/5 border border-white/10 p-4 rounded-[20px] rounded-tl-none">
              <Loader2 className="animate-spin text-amber-500/50" size={16} />
            </div>
          </div>
        )}
      </div>

      <div className="p-8 bg-white/[0.03] border-t border-white/5">
        <div className="relative group">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Submit query to ${personaName}...`}
            className="w-full bg-white/5 border border-white/10 rounded-[24px] px-8 py-5 pr-16 outline-none focus:border-amber-500/50 focus:bg-white/[0.08] transition-all font-serif text-sm resize-none scroll-hide min-h-[64px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all disabled:opacity-20 shadow-xl"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const NeuralChatView = ({ userProfile, onExtractPlan, onError }: { userProfile: UserProfile, onExtractPlan: (context: string) => void, onError: (e: any, ctx: string) => void }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await chatWithMantra(input, history);
      
      const modelMsg: ChatMessage = {
        role: 'model',
        text: response,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (e) {
      onError(e, 'NEURAL_INGESTION');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[75vh] max-w-4xl mx-auto bg-white/[0.02] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl backdrop-blur-xl">
      <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
            <Sparkles size={24} />
          </div>
          <div>
            <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">Mantra Intelligence</span>
            <h2 className="text-xl font-serif italic text-white font-light">Neural Ingestion Lab</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Neural Link Active</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full border border-white/5 flex items-center justify-center text-white/10">
              <MessageSquare size={40} />
            </div>
            <div className="space-y-2">
              <p className="text-white/40 font-serif italic text-lg">"The future belongs to those who see possibilities before they become obvious."</p>
              <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-white/20">Begin your neural transmission below</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex flex-col max-w-[85%]",
              m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <div className={cn(
              "px-6 py-4 rounded-[24px] text-sm leading-relaxed",
              m.role === 'user' 
                ? "bg-amber-500 text-black font-medium rounded-tr-none shadow-lg" 
                : "bg-white/5 border border-white/10 text-white/90 rounded-tl-none backdrop-blur-sm"
            )}>
              {m.text}
            </div>
            <span className="text-[8px] uppercase tracking-tighter text-white/20 mt-2 font-mono">
              {new Date(m.timestamp).toLocaleTimeString()}
            </span>
          </motion.div>
        ))}
        {loading && (
          <div className="flex mr-auto items-start">
            <div className="bg-white/5 border border-white/10 p-4 rounded-[24px] rounded-tl-none">
              <Loader2 className="animate-spin text-amber-500/50" size={16} />
            </div>
          </div>
        )}
      </div>

      <div className="p-8 bg-white/[0.03] border-t border-white/5">
        <div className="relative group">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe your vision, intent, or strategic objective..."
            className="w-full bg-white/5 border border-white/10 rounded-[28px] px-8 py-5 pr-16 outline-none focus:border-amber-500/50 focus:bg-white/[0.08] transition-all font-serif text-sm resize-none scroll-hide min-h-[72px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all disabled:opacity-20 shadow-xl"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between px-4">
          <div className="flex gap-4">
            <button 
              onClick={() => onExtractPlan(messages.filter(m => m.role === 'user').map(m => m.text).join('\n'))}
              className="text-[9px] uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors flex items-center gap-2"
            >
              <Zap size={10} /> Extract Plan
            </button>
            <button className="text-[9px] uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors flex items-center gap-2">
              <Cpu size={10} /> Define Swarm
            </button>
          </div>
          <span className="text-[8px] font-mono text-white/10 uppercase tracking-widest">Shift + Enter for new line</span>
        </div>
      </div>
    </div>
  );
};

const MantraEngineView = ({ userProfile, initialPrompt, onError }: { userProfile: UserProfile, initialPrompt?: string, onError: (e: any, ctx: string) => void }) => {
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    const qSwarms = query(
      collection(db, 'swarms'),
      where('ownerId', '==', userProfile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubSwarms = onSnapshot(qSwarms, (snapshot) => {
      setSwarms(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Swarm)));
    }, (e) => onError(e, 'SWARM_SNAPSHOT'));

    const qTasks = query(collection(db, 'tasks'));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    }, (e) => onError(e, 'TASK_SNAPSHOT'));

    // Simulation loop for task execution
    const interval = setInterval(async () => {
      const runningSwarms = swarms.filter(s => s.status === 'running');
      for (const swarm of runningSwarms) {
        const swarmTasks = tasks.filter(t => t.swarmId === swarm.id);
        const processingTask = swarmTasks.find(t => t.status === 'processing');
        const pendingTasks = swarmTasks.filter(t => t.status === 'pending');

        try {
          if (processingTask) {
            // Complete current processing task
            await updateDoc(doc(db, 'tasks', processingTask.id), {
              status: 'done',
              completedAt: Date.now()
            }).catch(e => handleFirestoreError(e, 'update', `tasks/${processingTask.id}`));

            // If this was the last task, complete the swarm
            const stillPending = pendingTasks.length > 0;
            if (!stillPending) {
              const allDoneTasks = tasks.filter(t => t.swarmId === swarm.id || t.id === processingTask.id);
              const generatedReports = allDoneTasks.map((t, idx) => ({
                id: `rep_${t.id}_${Date.now()}`,
                name: `${t.persona.split(' ').pop()} Analysis v1.0`,
                type: (t.persona.toLowerCase().includes('tax') ? 'Tax' : 
                       t.persona.toLowerCase().includes('lawyer') ? 'Legal' : 
                       t.persona.toLowerCase().includes('software') ? 'Governance' : 'Compliance') as DocumentReport['type'],
                generatedBy: t.persona,
                timestamp: Date.now() + (idx * 500),
              }));

              await updateDoc(doc(db, 'swarms', swarm.id), {
                status: 'completed',
                reports: generatedReports
              }).catch(e => handleFirestoreError(e, 'update', `swarms/${swarm.id}`));
            }
          } else if (pendingTasks.length > 0) {
            // Start processing the next pending task
            const nextTask = pendingTasks[0];
            await updateDoc(doc(db, 'tasks', nextTask.id), {
              status: 'processing'
            }).catch(e => handleFirestoreError(e, 'update', `tasks/${nextTask.id}`));
          }
        } catch (e) {
          onError(e, 'SWARM_SIMULATION_TAPE');
        }
      }
    }, 5000); // Gradual progression every 5 seconds

    return () => {
      unsubSwarms();
      unsubTasks();
      clearInterval(interval);
    };
  }, [userProfile, swarms, tasks]);

  const handleStartSwarm = async () => {
    if (!prompt.trim()) return;
    setIsDecomposing(true);
    setConfirmation(null);

    try {
      const steps = await decomposeIntent(prompt, selectedPersona || undefined);
      setPlan(steps);
      
      const swarmRef = await addDoc(collection(db, 'swarms'), {
        ownerId: userProfile.uid,
        prompt: selectedPersona ? `[${selectedPersona} Lead] ${prompt}` : prompt,
        status: 'running',
        cost: steps.length * 10,
        agentPersonas: Array.from(new Set(steps.map(s => s.persona))),
        createdAt: Date.now()
      }).catch(e => handleFirestoreError(e, 'create', 'swarms'));

      // Initialize individual agent tasks within the swarm
      for (const step of steps) {
        await addDoc(collection(db, 'tasks'), {
          swarmId: swarmRef.id,
          persona: step.persona,
          description: step.description,
          status: 'pending'
        }).catch(e => handleFirestoreError(e, 'create', 'tasks'));
      }

      setConfirmation(`Swarm initiated successfully. ${steps.length} tasks are now processing.`);
      setPrompt('');
      setSelectedPersona(null);
      setTimeout(() => setConfirmation(null), 5000);
    } catch (e) {
      onError(e, 'SWARM_ORCHESTRATION');
    } finally {
      setIsDecomposing(false);
    }
  };

  const updateSwarmStatus = async (swarmId: string, newStatus: SwarmStatus) => {
    try {
      await updateDoc(doc(db, 'swarms', swarmId), {
        status: newStatus
      }).catch(e => handleFirestoreError(e, 'update', `swarms/${swarmId}`));
    } catch (e) {
      onError(e, 'SWARM_STATUS_UPDATE');
    }
  };

  return (
    <div className="h-full flex flex-col gap-12">
      <div className="bg-gradient-to-br from-white/[0.08] to-transparent p-12 rounded-3xl border border-white/10 shadow-2xl flex flex-col gap-8">
        <div className="space-y-4">
          <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">Mantra Neural Interface</span>
          <h1 className="text-5xl font-serif font-light leading-tight">
            What should we <span className="italic">orchestrate</span> first?
          </h1>
        </div>
        
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <span className="text-[9px] uppercase font-bold text-white/30 tracking-[0.2em]">Select Primary Orchestrator (Optional)</span>
            <div className="flex flex-wrap gap-3">
              {["Entity Lawyer", "Tax Strategist", "Nomad Concierge", "Software Architect"].map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPersona(selectedPersona === p ? null : p)}
                  className={cn(
                    "px-4 py-2 rounded-full border text-[10px] font-bold tracking-widest transition-all",
                    selectedPersona === p 
                      ? "bg-amber-500 border-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]" 
                      : "bg-white/5 border-white/10 text-white/40 hover:border-white/30"
                  )}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md focus-within:border-amber-500/50 transition-all">
            <Terminal size={20} className="text-white/30 mt-2" />
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Submit your high-level intent..."
              className="flex-1 bg-transparent px-2 py-1 outline-none text-white font-serif text-xl placeholder:text-white/10 resize-none"
            />
            <button
              onClick={handleStartSwarm}
              disabled={isDecomposing}
              className="self-end bg-white text-black hover:bg-amber-500 hover:text-white disabled:bg-white/10 disabled:text-white/20 px-8 py-3 font-bold uppercase text-[10px] tracking-[0.3em] rounded-xl transition-all flex items-center gap-3"
            >
              {isDecomposing ? <Loader2 size={16} className="animate-spin" /> : "Initiate Swarm"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {confirmation && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-6 py-3 flex items-center gap-3 overflow-hidden"
            >
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-500 font-bold italic">
                {confirmation}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {plan.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4"
          >
            {plan.map((step, i) => (
              <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/10 hover:border-amber-500/30 transition-all group">
                <div className="w-8 h-8 rounded border border-white/10 flex items-center justify-center mb-6 group-hover:border-amber-500/40">
                  <span className="font-serif text-sm italic">{String.fromCharCode(65 + i)}</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2 block">{step.persona}</span>
                <h4 className="font-serif text-xl mb-3">{step.task}</h4>
                <p className="text-white/50 text-[11px] leading-relaxed line-clamp-3">{step.description}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-4 border-b border-white/10 pb-4 mb-6">
          <span className="col-header underline underline-offset-8 decoration-amber-500">Universal Log</span>
          <span className="col-header opacity-20">Network Swarms 0x{swarms.length}</span>
        </div>
        <div className="space-y-4">
          {swarms.map(swarm => {
            const swarmTasks = tasks.filter(t => t.swarmId === swarm.id);
            const doneCount = swarmTasks.filter(t => t.status === 'done').length;
            const processingCount = swarmTasks.filter(t => t.status === 'processing').length;
            const progress = swarmTasks.length > 0 ? ((doneCount + (processingCount * 0.5)) / swarmTasks.length) * 100 : 0;

            return (
              <div key={swarm.id} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:border-white/10 transition-all group relative overflow-hidden">
                {swarm.status === 'running' && (
                  <div className="absolute top-0 right-0 px-4 py-1 bg-amber-500 text-black text-[8px] font-bold uppercase tracking-widest rounded-bl-xl z-20 shadow-lg">
                    Mantra Simulation Active
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        swarm.status === 'running' ? "bg-emerald-500 animate-pulse" : 
                        swarm.status === 'paused' ? "bg-amber-500" :
                        swarm.status === 'completed' ? "bg-blue-500" : "bg-white/10"
                      )} />
                      <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">{new Date(swarm.createdAt).toLocaleString()}</span>
                    </div>
                    <h3 className="font-serif text-xl text-white/90 group-hover:text-white transition-colors">{swarm.prompt}</h3>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-white/20">Operational Progress</span>
                        <span className="text-[10px] font-mono text-emerald-500/80">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                        />
                      </div>
                    </div>

                    {/* Neural Flow Chart Visualization */}
                    <div className="pt-4 border-t border-white/5 overflow-hidden">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/30">Neural Execution Flow</span>
                        <div className="flex flex-wrap gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                            <span className="text-[8px] uppercase tracking-widest text-white/20">Pending</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[8px] uppercase tracking-widest text-white/20">Active</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[8px] uppercase tracking-widest text-white/20">Complete</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 overflow-x-auto no-scrollbar pb-6 lg:pb-4 touch-pan-x">
                        {swarmTasks.map((t, idx) => {
                          const isNextPending = idx < swarmTasks.length - 1 && (swarmTasks[idx+1].status === 'pending' || swarmTasks[idx+1].status === 'processing');
                          const isCurrentActive = t.status === 'processing';
                          
                          return (
                            <div key={t.id} className="flex items-center shrink-0">
                              <motion.div 
                                initial={false}
                                animate={{ 
                                  borderColor: t.status === 'done' ? 'rgb(16 185 129 / 0.4)' : isCurrentActive ? 'rgb(245 158 11 / 0.4)' : 'rgb(255 255 255 / 0.1)',
                                  backgroundColor: t.status === 'done' ? 'rgb(16 185 129 / 0.1)' : isCurrentActive ? 'rgb(245 158 11 / 0.1)' : 'transparent'
                                }}
                                className={cn(
                                  "flex flex-col gap-2 p-3 rounded-xl border min-w-[120px] transition-all relative overflow-hidden",
                                  isCurrentActive && "ring-1 ring-amber-500/20"
                                )}
                              >
                                {isCurrentActive && (
                                  <motion.div 
                                    className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-transparent pointer-events-none"
                                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  />
                                )}
                                <div className="flex justify-between items-center relative z-10">
                                  <span className={cn(
                                    "text-[8px] font-mono uppercase tracking-tighter whitespace-nowrap",
                                    t.status === 'done' ? "text-emerald-500/60" : isCurrentActive ? "text-amber-500/60" : "text-white/20"
                                  )}>
                                    {t.persona}
                                  </span>
                                  {t.status === 'done' ? (
                                    <CheckCircle2 size={10} className="text-emerald-500" />
                                  ) : isCurrentActive ? (
                                    <Loader2 size={10} className="text-amber-500 animate-spin" />
                                  ) : (
                                    <Clock size={10} className="text-white/10" />
                                  )}
                                </div>
                                <p className={cn(
                                  "text-[9px] leading-snug line-clamp-2 relative z-10",
                                  t.status === 'done' ? "text-white/60" : isCurrentActive ? "text-white/80" : "text-white/20"
                                )}>
                                  {t.description}
                                </p>
                              </motion.div>
                              
                              {idx < swarmTasks.length - 1 && (
                                <div className="flex flex-col items-center gap-1 mx-2">
                                  <div className="w-8 h-[1px] bg-white/5 relative">
                                    <motion.div 
                                      className="absolute inset-0 bg-amber-500"
                                      initial={{ scaleX: 0 }}
                                      animate={{ scaleX: t.status === 'done' ? 1 : 0 }}
                                      transition={{ duration: 0.5 }}
                                    />
                                  </div>
                                  <ChevronRight size={8} className={t.status === 'done' ? "text-amber-500/50" : "text-white/5"} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {swarm.reports && swarm.reports.length > 0 && (
                      <div className="pt-6 border-t border-white/5 space-y-4">
                        <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/30 block">Generated Audit Reports</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {swarm.reports.map((report) => (
                            <motion.div 
                              key={report.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:border-amber-500/30 transition-all cursor-pointer group shadow-xl"
                            >
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                                report.type === 'Legal' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                                report.type === 'Tax' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                "bg-amber-500/10 border-amber-500/20 text-amber-500"
                              )}>
                                <FileText size={20} />
                              </div>
                              <div className="space-y-1 overflow-hidden">
                                <p className="text-[11px] font-bold text-white/80 group-hover:text-white transition-colors truncate">{report.name}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] font-mono uppercase text-white/20">{report.type}</span>
                                  <span className="text-[8px] text-white/10">•</span>
                                  <span className="text-[8px] font-mono text-white/10">{report.generatedBy}</span>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Granular Activity Log */}
                    <div className="pt-4 space-y-2 border-t border-white/5">
                      <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/20 block mb-3">Live Execution Stream</span>
                      {swarmTasks.filter(t => t.status === 'done')
                        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
                        .slice(0, 3)
                        .map(t => (
                          <motion.div 
                            key={t.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3 group/log"
                          >
                            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-tighter w-24 shrink-0 font-bold">{t.persona}</span>
                            <span className="text-[10px] text-white/40 group-hover/log:text-white/60 transition-colors truncate">SUCCESS: {t.description}</span>
                            <span className="ml-auto text-[8px] font-mono text-white/10">{new Date(t.completedAt || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </motion.div>
                        ))}
                      {swarmTasks.filter(t => t.status === 'done').length === 0 && (
                        <p className="text-[10px] font-serif italic text-white/10">Awaiting agent initialization...</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 border-l border-white/5 pl-8 h-full">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">{swarm.status}</span>
                      <span className="text-[9px] font-mono text-white/20">{swarmTasks.length} NODES</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {swarm.status === 'running' ? (
                        <button 
                          onClick={() => updateSwarmStatus(swarm.id, 'paused')}
                          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-amber-500 hover:border-amber-500/30 transition-all"
                        >
                          <Pause size={14} />
                        </button>
                      ) : (swarm.status === 'paused' || swarm.status === 'queued') ? (
                        <button 
                          onClick={() => updateSwarmStatus(swarm.id, 'running')}
                          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-emerald-500 hover:border-emerald-500/30 transition-all"
                        >
                          <Play size={14} />
                        </button>
                      ) : null}
                      
                      {['queued', 'running', 'paused'].includes(swarm.status) && (
                        <button 
                          onClick={() => updateSwarmStatus(swarm.id, 'cancelled')}
                          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-red-500 hover:border-red-500/30 transition-all"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Root Component ---

const PERSONAS_DATA = [
  {
    id: 'lawyer',
    name: 'Entity Lawyer',
    code: 'RPM Persona L4',
    bio: 'Specialized in jurisdictional compliance and corporate architecture. L4 operates at the intersection of legal rigidity and nomadic flexibility.',
    skills: [
      { category: 'Architecture', items: ['Series LLC Structuring', 'Foundation Governance', 'Trust Setup'] },
      { category: 'Compliance', items: ['KYC/AML Principal Verification', 'Jurisdictional Nexus Audits', 'Corporate Records Automation'] },
      { category: 'Protection', items: ['IP Asset Isolation', 'Liability Shielding', 'Registry Privacy Protocols'] }
    ],
    icon: ShieldCheck,
    color: 'amber'
  },
  {
    id: 'tax',
    name: 'Tax Strategist',
    code: 'RPM Persona A1',
    bio: 'Algorithmic tax optimization for non-resident founders. A1 navigates the complexities of cross-border profit repatriation and DTA networks.',
    skills: [
      { category: 'Optimization', items: ['Cross-border Profit Repatriation', 'DTA Applicability Analysis', 'Personal Income Residency Arbitrage'] },
      { category: 'Indirect Tax', items: ['VAT/GST Nexus Audits', 'MOSS Compliance', 'Sales Tax Automation'] },
      { category: 'Reporting', items: ['CFC Rule Analysis', 'Beneficial Ownership Disclosure', 'Annual Fiscal Summary'] }
    ],
    icon: Landmark,
    color: 'emerald'
  },
  {
    id: 'nomad',
    name: 'Nomad Concierge',
    code: 'RPM Persona C9',
    bio: 'Orchestrating global mobility and physical nexus alignment. C9 ensures your residency status remains compliant with your fiscal and operational vectors.',
    skills: [
      { category: 'Mobility', items: ['Digital Nomad Visa Pipeline', 'Residency Permit Orchestration', 'Path-to-Passport Planning'] },
      { category: 'Nexus', items: ['Residency Overlap Analysis', 'Substantial Presence Tracking', 'Fiscal Alignment Audits'] },
      { category: 'Logistics', items: ['Global Health Nexus', 'Property Lease Compliance', 'Local Banking Integration'] }
    ],
    icon: Globe,
    color: 'blue'
  },
  {
    id: 'architect',
    name: 'Software Architect',
    code: 'RPM Persona S7',
    bio: 'Foundational cloud orchestration with a focus on data sovereignty. S7 builds the digital infrastructure required to host global operations.',
    skills: [
      { category: 'Infra', items: ['Multi-region AWS/Vercel Setup', 'Infrastructure-as-Code Audits', 'CI/CD Pipeline Security'] },
      { category: 'Sovereignty', items: ['Data Residency Compliance', 'GDPR/CCPA Locality Logic', 'Encryption-at-rest Protocols'] },
      { category: 'Scale', items: ['Global Edge Distribution', 'Serverless Compute Optimization', 'Neural API Gateway Design'] }
    ],
    icon: Cpu,
    color: 'purple'
  }
];

const PersonaCapabilitiesView = () => {
  const [search, setSearch] = useState('');

  const filteredPersonas = PERSONAS_DATA.filter(persona => {
    const query = search.toLowerCase();
    const matchesName = persona.name.toLowerCase().includes(query);
    const matchesBio = persona.bio.toLowerCase().includes(query);
    const matchesSkills = persona.skills.some(group => 
      group.category.toLowerCase().includes(query) || 
      group.items.some(skill => skill.toLowerCase().includes(query))
    );
    return matchesName || matchesBio || matchesSkills;
  });

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <span className="text-amber-500 text-[10px] font-mono tracking-[0.4em] uppercase">Neural Skill Tree</span>
          <h2 className="font-serif italic text-5xl font-light text-white">Persona Capabilities</h2>
          <p className="text-white/40 max-w-2xl text-sm leading-relaxed font-serif">
            The Global Founder OS operates through a swarm of specialized RPM personas. Each agent possesses a unique deep-domain "Skill Tree" accessible through the Mantra Neural Interface.
          </p>
        </div>
        
        <div className="relative w-full md:w-96 group">
          <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-amber-500 transition-colors" />
          <input 
            type="text"
            placeholder="Search personas & skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 outline-none focus:border-amber-500/50 transition-all font-serif text-sm text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filteredPersonas.length > 0 ? (
          filteredPersonas.map((persona) => {
            const Icon = persona.icon;
            return (
              <motion.div 
                key={persona.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all group relative overflow-hidden"
              >
                <div className={cn(
                  "absolute top-0 right-0 w-32 h-32 opacity-[0.03] -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-700",
                  persona.color === 'amber' ? "text-amber-500" : persona.color === 'emerald' ? "text-emerald-500" : persona.color === 'blue' ? "text-blue-500" : "text-purple-500"
                )}>
                  <Icon size={128} />
                </div>
                
                <div className="flex items-center gap-6 mb-8 relative z-10">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center border",
                    persona.color === 'amber' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                    persona.color === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                    persona.color === 'blue' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                    "bg-purple-500/10 border-purple-500/20 text-purple-500"
                  )}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className="font-serif text-2xl text-white">{persona.name}</h3>
                    <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">{persona.code}</p>
                  </div>
                </div>

                <p className="text-sm text-white/60 leading-relaxed font-light mb-10 border-l border-white/10 pl-6 h-12 flex items-center relative z-10 italic">
                  "{persona.bio}"
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                  {persona.skills.map((skillGroup, idx) => (
                    <div key={idx} className="space-y-4">
                      <h4 className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/20 pb-3 border-b border-white/5">{skillGroup.category}</h4>
                      <ul className="space-y-3">
                        {skillGroup.items.map((item, itemIdx) => (
                          <li key={itemIdx} className="flex items-start gap-2 group/item">
                            <ChevronRight size={10} className="mt-1 text-white/10 group-hover/item:text-amber-500/50 transition-colors" />
                            <span className="text-[11px] text-white/40 group-hover/item:text-white/70 transition-colors leading-tight font-serif italic tracking-tight">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-3xl">
            <p className="font-serif italic text-white/20 text-xl">No personas match your neural query.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [visas, setVisas] = useState<VisaStatus[]>([]);
  const [rounds, setRounds] = useState<FundingRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [mantraPrompt, setMantraPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'dash' | 'entities' | 'mantra' | 'billing' | 'nomad' | 'compliance' | 'wizard' | 'capital' | 'neural' | 'tax' | 'personas'>('neural');
  const [appError, setAppError] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleError = (error: any, context: string) => {
    logError(error, context);
    setAppError(error);
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const profRef = doc(db, 'users', user.uid);
        const snap = await getDoc(profRef);
        if (!snap.exists()) {
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email!,
            displayName: user.displayName || 'Founding User',
            credits: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await setDoc(profRef, newProfile);
          setProfile(newProfile);
        } else {
          setProfile(snap.data() as UserProfile);
        }
      } else {
        setProfile(null);
        setEntities([]);
        setVisas([]);
        setRounds([]);
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const qEntities = query(collection(db, 'entities'), where('ownerId', '==', currentUser.uid));
    const unsubEntities = onSnapshot(qEntities, (snapshot) => {
      setEntities(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LegalEntity)));
    }, (e) => handleError(e, 'ENTITY_SYNC'));

    const qVisas = query(collection(db, 'visas'), where('ownerId', '==', currentUser.uid));
    const unsubVisas = onSnapshot(qVisas, (snapshot) => {
      setVisas(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VisaStatus)));
    }, (e) => handleError(e, 'VISA_SYNC'));

    const qRounds = query(collection(db, 'fundingRounds'), where('ownerId', '==', currentUser.uid));
    const unsubRounds = onSnapshot(qRounds, (snapshot) => {
      setRounds(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FundingRound)));
    }, (e) => handleError(e, 'FUNDING_SYNC'));

    return () => {
      unsubEntities();
      unsubVisas();
      unsubRounds();
    };
  }, [currentUser]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      handleError(e, 'AUTH_HANDSHAKE');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      handleError(e, 'AUTH_TERMINATION');
    }
  };

  if (loading) return (
    <div className="h-screen w-screen grid place-items-center bg-[#050505]">
      <div className="flex flex-col items-center gap-8">
        <div className="w-16 h-16 bg-gradient-to-tr from-amber-600 to-amber-200 rounded-full animate-pulse" />
        <span className="font-mono text-[10px] uppercase tracking-[0.5em] text-white/50">Universal OS Kernal / Ingesting...</span>
      </div>
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#050505] text-white overflow-x-hidden p-4 lg:p-8">
      <div className="flex-1 relative flex flex-col justify-between p-8 lg:p-12 border border-white/10 rounded-3xl overflow-hidden min-h-[500px]">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.1)_0%,transparent_70%)]" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-amber-600 to-amber-200 rounded-full" />
          <span className="font-serif italic text-2xl tracking-tight">VentureMind</span>
        </div>

        <div className="relative z-10 space-y-8 py-12 lg:py-0">
          <span className="text-amber-500 text-[11px] font-mono tracking-[0.4em] uppercase block">Analysis Stage: Core Architecture</span>
          <h1 className="text-6xl md:text-8xl lg:text-[140px] font-serif leading-[0.8] tracking-tighter mix-blend-difference font-light">
            Global <br /> <span className="italic">Founder</span> OS
          </h1>
          <p className="text-white/40 max-w-sm text-sm leading-relaxed font-light">
            Orchestrate Vercel/AWS infrastructure with EU-data residency compliance checks baked into the autonomous runtime.
          </p>
        </div>

        <div className="relative z-10 flex justify-between items-end border-t border-white/5 pt-8">
          <div className="text-[9px] text-white/20 uppercase tracking-[0.3em] font-mono">
            Session: 0xFF14_VMA / v4.28
          </div>
          <div className="flex gap-4 opacity-30">
            <Globe size={14} />
            <ShieldCheck size={14} />
            <Terminal size={14} />
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[500px] flex flex-col justify-center items-center px-6 lg:px-16 py-12 lg:py-0">
        <div className="w-full space-y-12">
          <div className="space-y-4 text-center lg:text-left">
            <h3 className="font-serif text-4xl lg:text-5xl font-light">Join the Swarm</h3>
            <p className="text-white/40 text-sm leading-relaxed">Secure biometric or cryptographic authentication required to access the Mantra Neural Interface.</p>
          </div>
          
          <button 
            onClick={handleLogin}
            className="w-full group relative overflow-hidden bg-white text-black rounded-2xl py-6 font-bold uppercase tracking-[0.2em] text-[10px] transition-all hover:bg-amber-500 hover:text-white"
          >
            <span className="relative z-10">Authenticate via Google</span>
          </button>

          <p className="text-[10px] text-white/20 text-center uppercase tracking-widest leading-relaxed">
            By authenticating, you agree to the Global Founder Terms and dynamic compliance protocols.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#050505] p-2 lg:p-4 text-white overflow-x-hidden">
      <div className="flex-1 flex flex-col bg-[#050505] border border-white/10 rounded-[24px] lg:rounded-[32px] overflow-hidden shadow-2xl relative">
        <nav className="h-20 border-b border-white/5 px-4 lg:px-10 flex items-center justify-between backdrop-blur-md relative z-50">
          <div className="flex items-center gap-4 lg:gap-12">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white/40 hover:text-white transition-colors"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dash')}>
              <div className="w-8 h-8 bg-gradient-to-tr from-amber-600 to-amber-200 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.2)]" />
              <span className="font-serif italic text-xl lg:text-xl tracking-tight hidden sm:block">VentureMind</span>
            </div>
            <div className="hidden lg:flex gap-8 text-[10px] uppercase tracking-[0.3em] font-medium text-white/30">
              <span 
                onClick={() => setActiveTab('neural')}
                className={cn("cursor-pointer transition-colors flex items-center gap-2", activeTab === 'neural' ? "text-white" : "hover:text-white")}
              >
                <Sparkles size={10} className={activeTab === 'neural' ? "text-amber-500" : ""} />
                Neural Chat
              </span>
              <span 
                onClick={() => setActiveTab('dash')}
                className={cn("cursor-pointer transition-colors", activeTab === 'dash' ? "text-white" : "hover:text-white")}
              >Dashboard</span>
              <span 
                onClick={() => setActiveTab('mantra')}
                className={cn("cursor-pointer transition-colors", activeTab === 'mantra' ? "text-white" : "hover:text-white")}
              >Mantra Engine</span>
              <span 
                onClick={() => setActiveTab('nomad')}
                className={cn("cursor-pointer transition-colors", activeTab === 'nomad' ? "text-white" : "hover:text-white")}
              >Logistics</span>
              <span 
                onClick={() => setActiveTab('compliance')}
                className={cn("cursor-pointer transition-colors", activeTab === 'compliance' ? "text-white" : "hover:text-white")}
              >Compliance</span>
              <span 
                onClick={() => setActiveTab('capital')}
                className={cn("cursor-pointer transition-colors", activeTab === 'capital' ? "text-white" : "hover:text-white")}
              >Capital</span>
              <span 
                onClick={() => setActiveTab('personas')}
                className={cn("cursor-pointer transition-colors", activeTab === 'personas' ? "text-white" : "hover:text-white")}
              >Personas</span>
            </div>
          </div>
          <div className="flex items-center gap-4 lg:gap-8">
            <div className="hidden md:flex bg-white/5 px-6 py-2 rounded-full border border-white/10 items-center gap-3">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-mono tracking-[0.2em] text-white/80">{(profile?.credits || 0).toLocaleString()} CREDITS</span>
            </div>
            <div className="flex items-center gap-2 lg:gap-4 pl-0 lg:pl-4 border-l-0 lg:border-l border-white/10">
              <button 
                onClick={() => setShowPrivacy(true)}
                className="hidden sm:block text-white/30 hover:text-white transition-colors"
                title="Legal & Protocol Settings"
              >
                <Settings size={18} />
              </button>
              <button onClick={handleLogout} className="text-white/30 hover:text-white transition-colors"><LogOut size={18} /></button>
            </div>
          </div>
        </nav>

        <div className="flex-1 flex overflow-hidden relative">
          <AnimatePresence>
            {(mobileMenuOpen || window.innerWidth >= 1024) && (
              <motion.aside 
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                className={cn(
                  "absolute lg:relative z-40 w-72 h-full border-r border-white/5 p-8 flex flex-col gap-10 bg-[#050505]/95 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none transition-all",
                  !mobileMenuOpen && "hidden lg:flex"
                )}
              >
                <div>
                  <h3 className="text-[9px] uppercase tracking-[0.4em] text-white/20 mb-6 font-bold">Active Project</h3>
                  <div className="bg-gradient-to-br from-white/[0.08] to-transparent p-5 rounded-2xl border border-white/10 group cursor-default">
                    <p className="font-serif text-base group-hover:text-amber-200 transition-colors">Global Founder OS</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="w-1 h-1 rounded-full bg-amber-500" />
                      <p className="text-[9px] text-white/30 uppercase tracking-widest italic">Ingested via TRD.v4</p>
                    </div>
                  </div>
                </div>

                <nav className="space-y-2 -mx-2">
                  <h3 className="text-[9px] uppercase tracking-[0.4em] text-white/20 mb-4 px-4 font-bold">Persona Swarm</h3>
                  <div className="space-y-1">
                    <div className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 transition-all group cursor-pointer",
                      activeTab === 'neural' ? "border border-amber-500/20 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.05)]" : ""
                    )} onClick={() => { setActiveTab('neural'); setMobileMenuOpen(false); }}>
                      <div className={cn("w-1 h-8 rounded-full transition-all", activeTab === 'neural' ? "bg-amber-500 animate-pulse" : "bg-white/10 group-hover:bg-amber-500/50")} />
                      <div className="flex flex-col">
                        <span className={cn("text-sm font-serif", activeTab === 'neural' ? "text-amber-500" : "text-white/80")}>Neural Ingestion</span>
                        <span className="text-[9px] text-amber-500/50 uppercase tracking-widest mt-0.5">Mantra Intelligence</span>
                      </div>
                    </div>
                    {['nomad', 'tax', 'wizard'].map(tab => (
                      <div key={tab} className={cn(
                        "flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 transition-all group cursor-pointer",
                        activeTab === tab ? "border border-white/10 bg-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)]" : ""
                      )} onClick={() => { setActiveTab(tab as any); setMobileMenuOpen(false); }}>
                        <div className={cn("w-1 h-8 rounded-full transition-all", activeTab === tab ? "bg-amber-500" : "bg-white/10 group-hover:bg-amber-500/50")} />
                        <div className="flex flex-col">
                          <span className={cn("text-sm font-serif", activeTab === tab ? "text-white" : "text-white/80")}>
                            {tab === 'nomad' ? 'Nomad Concierge' : tab === 'tax' ? 'Tax Strategist' : 'Entity Lawyer'}
                          </span>
                          <span className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">
                            {tab === 'nomad' ? 'RPM Persona C9' : tab === 'tax' ? 'RPM Persona A1' : 'RPM Persona L4'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </nav>
                <div className="mt-auto pt-8 border-t border-white/5 space-y-4">
                  <div className="md:hidden">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[9px] uppercase tracking-widest text-white/20">Credits</span>
                      <span className="text-[10px] font-mono text-emerald-500">{(profile?.credits || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => { setShowPrivacy(true); setMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-[9px] uppercase tracking-[0.3em] font-bold text-white/20 hover:text-white transition-colors group text-left"
                  >
                    <ShieldCheck size={12} className="text-white/10 group-hover:text-amber-500 transition-colors" />
                    Privacy & Terms
                  </button>
                  
                  <div className="px-4">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[8px] font-mono text-white/20">SYSTEM LOG</span>
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      </div>
                      <p className="text-[7px] text-white/10 leading-relaxed uppercase tracking-tighter">
                        VentureMind Kernel v4.28 // Neural Nexus Active // Secured via End-to-End Encryption
                      </p>
                    </div>
                  </div>

                  <div className="md:hidden">
                    <button onClick={handleLogout} className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                      Secure Termination
                    </button>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_100%)] p-4 lg:p-12 scroll-smooth no-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="max-w-7xl mx-auto"
              >
                {activeTab === 'dash' && <DashboardView entities={entities} credits={profile?.credits || 0} visas={visas} onNewClick={() => setActiveTab('wizard')} />}
                {activeTab === 'mantra' && profile && <MantraEngineView userProfile={profile} initialPrompt={mantraPrompt} onError={handleError} />}
                {activeTab === 'nomad' && profile && <NomadLogisticsView visas={visas} userProfile={profile} onError={handleError} />}
                {activeTab === 'compliance' && <ComplianceDashboardView entities={entities} visas={visas} />}
                {activeTab === 'neural' && profile && (
                  <NeuralChatView 
                    userProfile={profile} 
                    onExtractPlan={(context) => {
                      setMantraPrompt(context);
                      setActiveTab('mantra');
                    }}
                    onError={handleError}
                  />
                )}
                {activeTab === 'capital' && profile && <CapitalDashboardView rounds={rounds} entities={entities} userProfile={profile} onError={handleError} />}
                {activeTab === 'personas' && <PersonaCapabilitiesView />}
                {activeTab === 'tax' && <PersonaConsultView personaName="Tax Strategist" icon={Landmark} onError={handleError} />}
                {activeTab === 'wizard' && profile && <EntityFormationWizard userProfile={profile} onComplete={() => setActiveTab('dash')} onCancel={() => setActiveTab('dash')} onError={handleError} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <footer className="h-10 border-t border-white/5 bg-white/[0.01] px-4 lg:px-10 flex items-center justify-between text-[9px] text-white/20 tracking-[0.2em] font-mono shrink-0">
          <div className="flex gap-4 lg:gap-8 uppercase overflow-x-auto no-scrollbar whitespace-nowrap">
            <span>Session: 0xFF14_VMA</span>
            <span className="hidden md:inline">Model: Mantra-70B-Turbo</span>
            <span className="hidden lg:inline">Location: Cloud-Orch-US-East</span>
            <button 
              onClick={() => setShowPrivacy(true)}
              className="hover:text-amber-500 transition-colors border-l border-white/10 pl-4 lg:pl-8 ml-4 lg:ml-8"
            >
              Privacy & Protocol Terms
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
            <span className="uppercase tracking-widest text-amber-500/60 transition-opacity">System Listening</span>
          </div>
        </footer>
      </div>
      <AnimatePresence>
        {appError && <ErrorAdvisory error={appError} onClose={() => setAppError(null)} />}
        {showPrivacy && <LegalPolicyModal onClose={() => setShowPrivacy(false)} />}
      </AnimatePresence>
    </div>
  );
}
