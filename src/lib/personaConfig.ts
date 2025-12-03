import samAvatar from "@/assets/personas/sam.png";
import jamesAvatar from "@/assets/personas/james.png";
import katyAvatar from "@/assets/personas/katy.png";
import troyAvatar from "@/assets/personas/troy.png";
import gottiAvatar from "@/assets/personas/gotti.png";
import roccoAvatar from "@/assets/personas/rocco.png";

export interface PersonaConfig {
  name: string;
  key: string;
  color: string; // Hex color for charts and inline styles
  ringColor: string;
  bgGradient: string;
  textColor: string;
  avatar: string;
  bucketMin: number;
  bucketMax: number | null;
  description: string;
  tone: string;
}

export const personaConfig: Record<string, PersonaConfig> = {
  sam: {
    name: "Sam",
    key: "sam",
    color: "#10b981", // emerald-500
    ringColor: "ring-emerald-500",
    bgGradient: "from-emerald-500 to-emerald-600",
    textColor: "text-emerald-600 dark:text-emerald-400",
    avatar: samAvatar,
    bucketMin: 1,
    bucketMax: 30,
    description: "Friendly 0-30 Day Reminder Agent",
    tone: "Warm and gentle reminder",
  },
  james: {
    name: "James",
    key: "james",
    color: "#0ea5e9", // sky-500
    ringColor: "ring-sky-500",
    bgGradient: "from-sky-500 to-sky-600",
    textColor: "text-sky-600 dark:text-sky-400",
    avatar: jamesAvatar,
    bucketMin: 31,
    bucketMax: 60,
    description: "Confident 31-60 Day Agent",
    tone: "Direct but professional",
  },
  katy: {
    name: "Katy",
    key: "katy",
    color: "#f59e0b", // amber-500
    ringColor: "ring-amber-500",
    bgGradient: "from-amber-500 to-amber-600",
    textColor: "text-amber-600 dark:text-amber-400",
    avatar: katyAvatar,
    bucketMin: 61,
    bucketMax: 90,
    description: "Assertive 61-90 Day Agent",
    tone: "Serious and focused",
  },
  troy: {
    name: "Troy",
    key: "troy",
    color: "#f97316", // orange-500
    ringColor: "ring-orange-500",
    bgGradient: "from-orange-500 to-orange-600",
    textColor: "text-orange-600 dark:text-orange-400",
    avatar: troyAvatar,
    bucketMin: 91,
    bucketMax: 120,
    description: "Firm 91-120 Day Agent",
    tone: "Very firm but professional",
  },
  gotti: {
    name: "Gotti",
    key: "gotti",
    color: "#f43f5e", // rose-500
    ringColor: "ring-rose-500",
    bgGradient: "from-rose-500 to-rose-600",
    textColor: "text-rose-600 dark:text-rose-400",
    avatar: gottiAvatar,
    bucketMin: 121,
    bucketMax: 150,
    description: "Very Firm 121-150 Day Agent",
    tone: "Very firm, serious urgency",
  },
  rocco: {
    name: "Rocco",
    key: "rocco",
    color: "#dc2626", // red-600
    ringColor: "ring-red-600",
    bgGradient: "from-red-600 to-red-700",
    textColor: "text-red-600 dark:text-red-400",
    avatar: roccoAvatar,
    bucketMin: 151,
    bucketMax: null,
    description: "Final Internal Collections Agent",
    tone: "Firm and authoritative, high urgency, compliance-focused",
  },
};

export const getPersonaByName = (name: string): PersonaConfig | null => {
  const key = name.toLowerCase();
  return personaConfig[key] || null;
};

export const getPersonaByDaysPastDue = (daysPastDue: number): PersonaConfig | null => {
  if (daysPastDue === 0) return null;
  
  const personas = Object.values(personaConfig);
  return personas.find(persona => {
    if (persona.bucketMax === null) {
      return daysPastDue >= persona.bucketMin;
    }
    return daysPastDue >= persona.bucketMin && daysPastDue <= persona.bucketMax;
  }) || null;
};

// Helper to get all personas as an array
export const getAllPersonas = (): PersonaConfig[] => Object.values(personaConfig);
