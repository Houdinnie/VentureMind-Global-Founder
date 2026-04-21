import { GoogleGenAI, Type } from "@google/genai";
import { RPMAgencyAdapter } from "./rpmAdapter";
import { handleApiError } from "../lib/errorHandler";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface PlanStep {
  persona: string;
  task: string;
  description: string;
}

export async function decomposeIntent(prompt: string, primaryPersona?: string): Promise<PlanStep[]> {
  const personaContext = primaryPersona ? `The user has selected "${primaryPersona}" as the primary agent for this objective. Ensure this agent takes a leading or initial role in the sequence if applicable.` : '';
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Act as the Mantra Engine Intent Decomposer. 
      Decompose the following founder request into a sequence of specialized agent tasks.
      Available personas: "Tax Strategist", "Entity Lawyer", "Nomad Concierge", "Software Architect", "Compliance Officer".
      
      ${personaContext}
      
      Request: "${prompt}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              persona: { type: Type.STRING, description: "The agent persona to use" },
              task: { type: Type.STRING, description: "Short title of the task" },
              description: { type: Type.STRING, description: "Detailed instruction for the agent" }
            },
            required: ["persona", "task", "description"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (e) {
    handleApiError(e, 'DECOMPOSE_INTENT');
  }
}

export async function executeAgentTask(step: PlanStep, context: string): Promise<string> {
  const systemInstruction = RPMAgencyAdapter.getPersonaSystemInstruction(step.persona);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Objective: ${step.task}
      Instruction: ${step.description}
      
      Previous Swarm Context: ${context}
      
      Provide your professional response:`,
      config: {
        systemInstruction: systemInstruction + "\n\nYou are part of the Global Founder OS swarm. Be precise, professional, and action-oriented."
      }
    });

    return response.text || "No response generated.";
  } catch (e) {
    handleApiError(e, `EXECUTE_AGENT[${step.persona}]`);
  }
}

export async function chatWithMantra(message: string, history: { role: string; parts: { text: string }[] }[] = []): Promise<string> {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are the VentureMind Mantra Engine, the core intelligence of the Global Founder OS. 
        Your goal is to help founders refine their high-level intents into actionable startup blueprints.
        Be visionary, precision-focused, and highly analytical. 
        If a founder has a raw idea, help them structure it into "Autonomous Swarm" tasks using our personas: "Entity Lawyer", "Tax Strategist", "Nomad Concierge", etc.
        Keep responses concise but dense with insight.`
      },
      history: history as any
    });

    const response = await chat.sendMessage({
      message: message
    });

    return response.text || "Neural connection interrupted.";
  } catch (e) {
    handleApiError(e, 'CHAT_WITH_MANTRA');
  }
}

export async function consultPersona(personaName: string, message: string, history: { role: string; parts: { text: string }[] }[] = []): Promise<string> {
  const systemInstruction = RPMAgencyAdapter.getPersonaSystemInstruction(personaName);
  
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: systemInstruction + "\n\nYou are providing a direct consultation to a global founder. Be precise, strategic, and concise."
      },
      history: history as any
    });

    const response = await chat.sendMessage({
      message: message
    });

    return response.text || "Consultation link severed.";
  } catch (e) {
    handleApiError(e, `CONSULT_PERSONA[${personaName}]`);
  }
}

export async function checkNomadicCompliance(country: string, residencyStatus: string): Promise<string> {
  const systemInstruction = RPMAgencyAdapter.getPersonaSystemInstruction("Nomad Concierge");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `FOUNDER REQUEST: Evaluate remote work compliance for my stay in ${country}.
      CURRENT STATUS: ${residencyStatus}
      
      Task: Run a multi-vector compliance check covering visa duration, tax residency triggers, and local remote work legality.`,
      config: {
        systemInstruction: systemInstruction + "\n\nProvide a concise, high-integrity compliance verdict with identified risks. Be authoritative."
      }
    });

    return response.text || "Compliance check failed to yield a response.";
  } catch (e) {
    handleApiError(e, 'NOMADIC_COMPLIANCE_CHECK');
  }
}
