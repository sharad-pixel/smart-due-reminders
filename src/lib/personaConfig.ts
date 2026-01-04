import samAvatar from "@/assets/personas/sam.png";
import jamesAvatar from "@/assets/personas/james.png";
import katyAvatar from "@/assets/personas/katy.png";
import troyAvatar from "@/assets/personas/troy.png";
import jimmyAvatar from "@/assets/personas/jimmy.png";
import roccoAvatar from "@/assets/personas/rocco.png";

export interface PersonaConfig {
  name: string;
  color: string;
  bgColor: string;
  avatar: string;
  bucketMin: number;
  bucketMax: number | null;
  description: string;
  tone: string;
}

export const personaConfig: Record<string, PersonaConfig> = {
  sam: {
    name: "Sam",
    color: "#69B7FF",
    bgColor: "bg-green-500",
    avatar: samAvatar,
    bucketMin: 1,
    bucketMax: 30,
    description: "Friendly 0-30 Day Reminder Agent",
    tone: "Warm and gentle reminder",
  },
  james: {
    name: "James",
    color: "#14B5B0",
    bgColor: "bg-yellow-500",
    avatar: jamesAvatar,
    bucketMin: 31,
    bucketMax: 60,
    description: "Confident 31-60 Day Agent",
    tone: "Direct but professional",
  },
  katy: {
    name: "Katy",
    color: "#FF914D",
    bgColor: "bg-orange-500",
    avatar: katyAvatar,
    bucketMin: 61,
    bucketMax: 90,
    description: "Assertive 61-90 Day Agent",
    tone: "Serious and focused",
  },
  troy: {
    name: "Troy",
    color: "#FF5C5C",
    bgColor: "bg-red-500",
    avatar: troyAvatar,
    bucketMin: 91,
    bucketMax: 120,
    description: "Firm 91-120 Day Agent",
    tone: "Very firm but professional",
  },
  jimmy: {
    name: "Jimmy",
    color: "#9A0000",
    bgColor: "bg-purple-500",
    avatar: jimmyAvatar,
    bucketMin: 121,
    bucketMax: 150,
    description: "Very Firm 121-150 Day Agent",
    tone: "Very firm, serious urgency",
  },
  rocco: {
    name: "Rocco",
    color: "#DC2626",
    bgColor: "bg-red-600",
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
  // Handle 0 or negative DPD - assign to Sam (friendly reminder agent)
  if (daysPastDue <= 0) return personaConfig.sam;
  
  const personas = Object.values(personaConfig);
  return personas.find(persona => {
    if (persona.bucketMax === null) {
      return daysPastDue >= persona.bucketMin;
    }
    return daysPastDue >= persona.bucketMin && daysPastDue <= persona.bucketMax;
  }) || null;
};
