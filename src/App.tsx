import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import "./App.css";

const supabase = createClient(
  "https://kulqmojwdswwsycmndmx.supabase.co",
  "sb_publishable_dUWNjDBBxD083DUc8UdRyQ_J5AzxtGM"
);

const ADMIN_EMAILS = [
  "foucatdidier@gmail.com",
];


const SESSION_TYPES = [
  "Trail",
  "Course à pied",
  "Piste",
  "Vélo",
  "Apéro",
  "Autre",
  "Ski",
  "Ski de randonnée",
];

const WEEK_DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

type AppTab = "calendar" | "mySessions" | "chronos" | "profile" | "notifications" | "admin" | "importPlan";
type ParticipationStatus = "present" | "interested";
type WorkoutMode = "" | "vma" | "fc" | "seuil" | "10km" | "allure";

type Session = {
  id: string;
  title: string;
  type?: string | null;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  description?: string | null;
  image_url?: string | null;
  gpx_url?: string | null;
  created_by?: string | null;
  workout_mode?: WorkoutMode | null;
  fraction_distance?: number | null;
  intensity_percent?: number | null;
};

type Participant = {
  id: string;
  session_id: string;
  user_id: string;
  status: ParticipationStatus;
  firstname?: string;
  lastname?: string;
};

type MemberProfile = {
  id: string;
  firstname?: string | null;
  lastname?: string | null;
  pseudo?: string | null;
  email?: string | null;
  approved?: boolean | null;
  active?: boolean | null;
  is_admin?: boolean | null;
  privacy_accepted?: boolean | null;
  privacy_accepted_at?: string | null;
};


type AccountDeletionRequest = {
  id: string;
  user_id: string;
  email?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  reason?: string | null;
  status?: string | null;
  created_at?: string | null;
  processed_at?: string | null;
};


type PersonalChrono = {
  id: string;
  distance: string;
  race: string;
  chrono: string;
  previousChrono?: string;
  date: string;
  elevationGain?: string;
  theoreticalChrono?: string;
  theoreticalGainSeconds?: number;
  suggestedVma?: string;
  vmaAtEntry?: string;
  vmaUpdated?: boolean;
};

type PersonalGoal =
  | {
      type: "vma";
      repetitions?: number;
      distance: number;
      percent: number;
      vma: number;
      pace: number;
      timeSeconds: number;
      recoverySeconds?: number;
      isTimeBased?: boolean;
    }
  | {
      type: "fc";
      percent: number;
      fcMax: number;
      targetFc: number;
    }
  | {
      type: "seuil" | "10km";
      surface: "trail" | "route";
      repetitions?: number;
      distance?: number;
      durationMin?: number;
      percent: number;
      vma: number;
      pace: number;
      timeSeconds?: number;
    }
  | {
      type: "effort";
      title: string;
      detail: string;
      fcLabel?: string;
      surface: "trail" | "route";
    }
  | {
      type: "allure";
      pace: number;
    };



type ImportedPlanSession = {
  id: string;
  date: string;
  dayLabel: string;
  title: string;
  description: string;
  type: string;
  start_time: string;
  end_time: string;
  location: string;
  confidence: "auto" | "manual";
  notes: string[];
};

type AsmDictionaryEntry = {
  keyword: string;
  label: string;
  explanation: string;
  sportHint?: string;
  intensity?: string;
};

const ASM_TRAINING_DICTIONARY: AsmDictionaryEntry[] = [
  {
    keyword: "EF",
    label: "Endurance fondamentale",
    explanation: "Footing très facile, conversation possible, objectif de volume et de récupération.",
    intensity: "≤ 75 % FC max",
  },
  {
    keyword: "RC",
    label: "Retour au calme",
    explanation: "Fin de séance très souple pour faire redescendre l’intensité.",
  },
  {
    keyword: "SV1",
    label: "Seuil ventilatoire 1",
    explanation: "Endurance active contrôlée, effort confortable mais soutenu.",
    intensity: "75-82 % VMA environ",
  },
  {
    keyword: "SV2",
    label: "Seuil ventilatoire 2",
    explanation: "Seuil haut, effort difficile mais maîtrisé, proche de l’allure soutenue.",
    intensity: "88-92 % VMA environ",
  },
  {
    keyword: "Seuil",
    label: "Travail au seuil",
    explanation: "Effort soutenu mais maîtrisé. En côte ou en trail, on privilégie la sensation et la fréquence cardiaque plutôt que l’allure route.",
    intensity: "85-90 % FC max / proche SV2",
  },
  {
    keyword: "Tempo",
    label: "Tempo / allure course",
    explanation: "Allure soutenue liée à l’objectif préparé. Sur trail, elle dépend du terrain et du dénivelé.",
  },
  {
    keyword: "VMA",
    label: "VMA",
    explanation: "Travail court et intense pour développer la vitesse maximale aérobie.",
  },
  {
    keyword: "Fartlek",
    label: "Fartlek",
    explanation: "Variations d’allure sur terrain naturel, avec relances, bosses ou changements de rythme.",
    sportHint: "Trail",
  },
  {
    keyword: "Côtes",
    label: "Côtes",
    explanation: "Travail de puissance, d’appuis et d’intensité en montée.",
    sportHint: "Trail",
  },
  {
    keyword: "Descente active",
    label: "Descente active",
    explanation: "Récupération dynamique en descente : on reste relâché, propre techniquement, sans se laisser complètement aller.",
    sportHint: "Trail",
  },
  {
    keyword: "Descente rapide",
    label: "Descente rapide trail",
    explanation: "Travail technique de descente : vitesse de pied, trajectoires, relance, engagement maîtrisé et résistance musculaire des quadriceps.",
    sportHint: "Trail",
  },
  {
    keyword: "JERK",
    label: "JERK trail",
    explanation: "Circuit musculaire spécifique trail : chaise, sauts, bosse, descente et relance. Objectif : force, explosivité et résistance sous fatigue.",
    sportHint: "Trail",
  },
  {
    keyword: "Préfatigue",
    label: "Préfatigue",
    explanation: "Séance qui prépare à produire un effort spécifique avec de la fatigue déjà présente.",
    sportHint: "Trail",
  },
  {
    keyword: "Déblocage",
    label: "Déblocage",
    explanation: "Petite activation légère avant compétition pour réveiller les jambes sans fatiguer.",
  },
  {
    keyword: "Très facile",
    label: "Très facile",
    explanation: "Allure volontairement confortable. Le but est de récupérer ou d’ajouter du volume sans fatigue excessive.",
  },
  {
    keyword: "Actif",
    label: "Actif",
    explanation: "Effort plus engagé qu’un footing facile, mais qui doit rester contrôlé.",
  },
];

function normalizeImportedText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function addDaysToDate(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseFrenchDateToKey(value: string, fallbackYear: number) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : fallbackYear;
  if (!day || !month || !year) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function isTrackDistanceSession(text: string) {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  // Détection des fractions courtes typiques piste : 100 m à 1000 m.
  // Exemples reconnus : 6x200, 10 x 400 m, 5*1000m, 8 × 800.
  return /(?:^|[^0-9])(?:\d+\s*[x*×]\s*)?(?:1000|[1-8]00)\s*m/.test(normalized);
}

function inferPlanSport(text: string, defaultSport: string) {
  const lower = text.toLowerCase();
  // Chaque séance est analysée indépendamment : le sport du plan sert seulement de valeur par défaut.
  if (isTrackDistanceSession(text) || /\bpiste\b/.test(lower)) return "Piste";
  if (/vélo|velo/.test(lower)) return "Vélo";
  if (/trail|côte|cotes|bosse|descente|d\+|montan|parcours technique|relances/.test(lower)) return "Trail";
  if (/footing|route|10\s*km|semi|marathon|vma|seuil|tempo|fartlek|endurance/.test(lower)) return "Course à pied";
  return defaultSport || "Course à pied";
}

function defaultLocationForImportedSession(description: string) {
  return isTrackDistanceSession(description) ? "Stade André-Lavie, Pau" : "À votre convenance";
}

function buildImportedSessionTitle(description: string) {
  const cleaned = description.trim();
  const label = cleaned.split(":")[0]?.trim();
  if (label && label.length <= 28 && /[a-zA-ZÀ-ÿ]/.test(label)) return label.charAt(0).toUpperCase() + label.slice(1);
  if (/footing/i.test(cleaned)) return "Footing";
  if (/sortie trail/i.test(cleaned)) return "Sortie trail";
  if (/seuil/i.test(cleaned)) return "Seuil";
  if (/vma|30\"\s*\/\s*30\"|1'\s*\/\s*1'/i.test(cleaned)) return "VMA";
  if (/fartlek/i.test(cleaned)) return "Fartlek";
  if (/côte|cotes|bosse/i.test(cleaned)) return "Côtes";
  if (/tempo/i.test(cleaned)) return "Tempo";
  if (/jerk/i.test(cleaned)) return "JERK";
  return "Séance";
}

function dictionaryNotesForSession(description: string) {
  const lower = description.toLowerCase();
  return ASM_TRAINING_DICTIONARY
    .filter((entry) => lower.includes(entry.keyword.toLowerCase()))
    .map((entry) => `${entry.label} : ${entry.explanation}`);
}

function parseImportedPlanText(rawText: string, defaultSport: string, fallbackYear: number) {
  const text = normalizeImportedText(rawText);
  if (!text) return [] as ImportedPlanSession[];

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(semaines|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)$/i.test(line))
    .filter((line) => !/^(developpement|développement|assimilation|specifique|spécifique|affûtage|affutage|course)$/i.test(line));

  const dayOffsets: Record<string, number> = {
    lundi: 0,
    mardi: 1,
    mercredi: 2,
    jeudi: 3,
    vendredi: 4,
    samedi: 5,
    dimanche: 6,
  };

  let currentWeekStart: string | null = null;
  let rollingIndex = 0;
  const results: ImportedPlanSession[] = [];
  const seen = new Set<string>();

  const pushSession = (description: string, date: string, dayLabel: string) => {
    const cleaned = description.replace(/\s+/g, " ").trim();
    if (!cleaned || /^repos$/i.test(cleaned)) return;
    const key = `${date}-${cleaned.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    const sport = inferPlanSport(cleaned, defaultSport);
    const title = buildImportedSessionTitle(cleaned);
    results.push({
      id: `${Date.now()}-${results.length}-${Math.random().toString(16).slice(2)}`,
      date,
      dayLabel,
      title,
      description: cleaned,
      type: sport,
      start_time: sport === "Trail" ? "09:00" : "18:30",
      end_time: "",
      location: defaultLocationForImportedSession(cleaned),
      confidence: sport === defaultSport ? "manual" : "auto",
      notes: dictionaryNotesForSession(cleaned),
    });
  };

  for (const line of lines) {
    const weekMatch = line.match(/DU\s+(\d{1,2}\/\d{1,2})(?:\s+AU\s+\d{1,2}\/\d{1,2})?/i);
    if (weekMatch) {
      currentWeekStart = parseFrenchDateToKey(weekMatch[1], fallbackYear);
      rollingIndex = 0;
      continue;
    }

    const explicitDate = parseFrenchDateToKey(line, fallbackYear);
    const dayMatch = line.match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*[:\-]?\s*(.+)$/i);
    if (dayMatch && currentWeekStart) {
      const day = dayMatch[1].toLowerCase();
      pushSession(dayMatch[2], addDaysToDate(currentWeekStart, dayOffsets[day] ?? 0), day);
      continue;
    }

    const looksLikeSession = /(:|\d+\s*[x*]\s*\d+|\d+'|\d+\"|footing|sortie|trail|seuil|vma|tempo|fartlek|jerk|préfatigue|prefatigue|côte|cotes|déblocage|deblocage|endurance)/i.test(line);
    const ignored = /^montan'aspe|^moins de|^37km|^au\s+\d/i.test(line.toLowerCase());
    if (!looksLikeSession || ignored || /^repos$/i.test(line)) continue;

    let date = explicitDate;
    let dayLabel = "à vérifier";
    if (!date && currentWeekStart) {
      const preferredOffsets = [1, 2, 3, 5, 6];
      const offset = preferredOffsets[Math.min(rollingIndex, preferredOffsets.length - 1)] ?? rollingIndex;
      date = addDaysToDate(currentWeekStart, offset);
      dayLabel = Object.keys(dayOffsets).find((key) => dayOffsets[key] === offset) || "à vérifier";
      rollingIndex += 1;
    }

    if (!date) {
      date = new Date().toISOString().slice(0, 10);
      dayLabel = "date à vérifier";
    }

    pushSession(line, date, dayLabel);
  }

  return results;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateKey(date: Date, day: number) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(day)}`;
}

function formatDisplayDate(dateKey?: string | null) {
  if (!dateKey) return "";
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatPace(paceMinKm: number) {
  if (!Number.isFinite(paceMinKm) || paceMinKm <= 0) return "-";
  const minutes = Math.floor(paceMinKm);
  const seconds = Math.round((paceMinKm - minutes) * 60);
  return `${minutes}'${pad(seconds)}/km`;
}

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";

  const roundedSeconds = Math.round(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const secs = roundedSeconds % 60;

  if (hours > 0) return `${hours}h${pad(minutes)}'${pad(secs)}"`;
  if (minutes > 0) return secs > 0 ? `${minutes}'${pad(secs)}"` : `${minutes}'`;
  return `${secs}"`;
};


function parseIntervalDurationToSeconds(value?: string | null) {
  if (!value) return null;

  const cleaned = value
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/min/g, "'")
    .replace(/secondes?/g, '"')
    .replace(/sec/g, '"')
    .replace(/\s+/g, "")
    .replace(/[”]/g, '"')
    .replace(/s$/g, "");

  const minuteSecondMatch = cleaned.match(/^(\d+)'(\d{1,2})?"?$/);
  if (minuteSecondMatch) {
    return Number(minuteSecondMatch[1]) * 60 + Number(minuteSecondMatch[2] || 0);
  }

  const secondMatch = cleaned.match(/^(\d+)"?$/);
  if (secondMatch) return Number(secondMatch[1]);

  return null;
}

function parseChronoToSeconds(value: string) {
  const parts = value
    .trim()
    .replace("h", ":")
    .replace("'", ":")
    .replace("’", ":")
    .split(":")
    .map((part) => Number(part));

  if (parts.some((part) => !Number.isFinite(part))) return null;

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

function formatChronoFromSeconds(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "-";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

function chronoProgress(currentChrono: string, previousChrono?: string) {
  const currentSeconds = parseChronoToSeconds(currentChrono);
  const previousSeconds = previousChrono ? parseChronoToSeconds(previousChrono) : null;

  if (!currentSeconds || !previousSeconds) {
    return { gainSeconds: 0, progressPercent: null as string | null };
  }

  const gainSeconds = previousSeconds - currentSeconds;
  const progressPercent = gainSeconds > 0 ? ((gainSeconds / previousSeconds) * 100).toFixed(1) : null;

  return { gainSeconds, progressPercent };
}

function distanceBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const earthRadiusKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function estimateVmaFromRace(distanceKm: number, totalMinutes: number) {
  const speed = distanceKm / (totalMinutes / 60);
  let percent = 0.9;

  if (distanceKm <= 5.5) percent = 0.95;
  else if (distanceKm <= 11) percent = 0.9;
  else if (distanceKm <= 23) percent = 0.85;
  else percent = 0.8;

  return (speed / percent).toFixed(1);
}

function chronoDistanceSettings(distance: string) {
  if (distance === "5 km") return { km: 5, percent: 0.95 };
  if (distance === "10 km") return { km: 10, percent: 0.9 };
  if (distance === "Semi-marathon") return { km: 21.1, percent: 0.85 };
  if (distance === "Marathon") return { km: 42.195, percent: 0.8 };
  return null;
}

function theoreticalChronoFromVma(distance: string, vmaValue: string) {
  const settings = chronoDistanceSettings(distance);
  const vma = Number(vmaValue || 0);
  if (!settings || !vma) return null;

  const seconds = (settings.km / (vma * settings.percent)) * 3600;
  return { seconds, label: formatChronoFromSeconds(seconds) };
}

function estimateVmaFromChronoDistance(distance: string, chronoSeconds: number) {
  const settings = chronoDistanceSettings(distance);
  if (!settings || !chronoSeconds) return null;

  const speed = settings.km / (chronoSeconds / 3600);
  return (speed / settings.percent).toFixed(1);
}

function chronoMotivationMessages(options: {
  isPersonalRecord: boolean;
  isTheoreticalRecord: boolean;
  hasElevation: boolean;
  chronosCount: number;
  progressPercent: string | null;
  vmaUpdated: boolean;
}) {
  const messages: string[] = [];

  if (options.isPersonalRecord) {
    messages.push("🏆 Bravo ! Nouveau record personnel enregistré.");
    messages.push("🔥 Tu viens de franchir un vrai palier sur cette distance.");
  }

  if (options.isTheoreticalRecord) {
    messages.push("⚡ Ton chrono est meilleur que ta performance théorique : ton niveau actuel progresse.");
    messages.push("🎯 Ce résultat donne un nouveau repère pour ajuster tes allures d’entraînement.");
  }

  if (options.vmaUpdated) {
    messages.push("🧠 Ta VMA a été ajustée dans ton profil à partir de ce nouveau repère de course.");
  }

  if (options.progressPercent && Number(options.progressPercent) >= 10) {
    messages.push("📈 Depuis ton arrivée à l’ASM, ta progression est énorme. Le travail paie vraiment.");
  } else if (options.progressPercent && Number(options.progressPercent) >= 5) {
    messages.push("📈 Depuis ton arrivée à l’ASM, tu as déjà beaucoup progressé. C’est concret et ça se voit.");
  }

  if (options.chronosCount <= 1) {
    messages.push("👏 Premier chrono enregistré : c’est ton point de départ pour suivre ta progression ASM.");
    messages.push("🖤💛 Déjà un repère posé : maintenant, chaque course pourra montrer ton évolution.");
  } else if (options.chronosCount <= 3) {
    messages.push("🔥 Tu commences à construire ton historique : c’est comme ça qu’on voit les vrais progrès.");
    messages.push("🚀 Continue, tes chronos donnent de plus en plus d’informations utiles pour t’entraîner juste.");
  } else {
    messages.push("💪 Ton suivi devient solide : chaque course aide à mieux ajuster tes entraînements.");
    messages.push("📊 Ton historique ASM permet maintenant de voir une vraie tendance de progression.");
  }

  if (options.hasElevation) {
    messages.push("⛰️ En trail, le D+ change tout : ce chrono doit être lu avec le profil du parcours.");
  }

  messages.push("🚀 Continue comme ça, tu es sur une très belle dynamique.");

  return messages.slice(0, 6);
}



function formatFcRangeLabel(
  profileFcMax: string,
  minPercent: number | null,
  maxPercent: number,
  context: "endurance" | "sv1" | "seuil" | "custom" = "custom"
): string {
  const fcMax = Number(profileFcMax || 0);

  const labelByContext =
    context === "endurance"
      ? `Repère cardio : rester sous ${maxPercent}% FC max`
      : minPercent === null
        ? `Repère cardio : rester sous ${maxPercent}% FC max`
        : `Repère cardio : environ ${minPercent}–${maxPercent}% FC max`;

  if (!fcMax) {
    return `${labelByContext}. Ajoute ta FC max dans ton profil pour obtenir la cible personnalisée en bpm.`;
  }

  if (minPercent === null || context === "endurance") {
    const maxBpm = Math.round((fcMax * maxPercent) / 100);
    return `${labelByContext} ≈ moins de ${maxBpm} bpm.`;
  }

  const minBpm = Math.round((fcMax * minPercent) / 100);
  const maxBpm = Math.round((fcMax * maxPercent) / 100);
  return `${labelByContext} ≈ ${minBpm} à ${maxBpm} bpm.`;
}

function formatCombinedFcLabel(profileFcMax: string): string {
  const fcMax = Number(profileFcMax || 0);
  if (!fcMax) {
    return "Repères cardio : SV2 ≈ 85–90% FC max / SV1 ≈ 75–85% FC max. Ajoute ta FC max dans ton profil pour obtenir les cibles en bpm.";
  }

  const sv2Min = Math.round(fcMax * 0.85);
  const sv2Max = Math.round(fcMax * 0.9);
  const sv1Min = Math.round(fcMax * 0.75);
  const sv1Max = Math.round(fcMax * 0.85);

  return `Repères cardio : SV2 ≈ 85–90% FC max (${sv2Min} à ${sv2Max} bpm) / SV1 ≈ 75–85% FC max (${sv1Min} à ${sv1Max} bpm). Adapter l’effort à la pente et au terrain.`;
}

function calculateTargetFromStructuredSession(
  session: Session,
  profileVma: string,
  profileFcMax: string
): PersonalGoal | null {
  const mode = session.workout_mode || "";
  const distance = Number(session.fraction_distance || 0);
  const percent = Number(session.intensity_percent || 0);
  const vma = Number(profileVma || 0);
  const fcMax = Number(profileFcMax || 0);

  if (mode === "vma" && distance > 0 && percent > 0 && vma > 0) {
    const speed = (vma * percent) / 100;
    const pace = 60 / speed;
    const timeSeconds = (distance / 1000) * pace * 60;
    return { type: "vma", distance, percent, vma, pace, timeSeconds };
  }

  if (mode === "fc" && percent > 0 && fcMax > 0) {
    return { type: "fc", percent, fcMax, targetFc: Math.round((fcMax * percent) / 100) };
  }

  if ((mode === "seuil" || mode === "10km") && percent > 0 && vma > 0) {
    const speed = (vma * percent) / 100;
    const pace = 60 / speed;
    const timeSeconds = distance > 0 ? (distance / 1000) * pace * 60 : undefined;

    return {
      type: mode,
      surface: session.type?.toLowerCase().includes("trail") ? "trail" : "route",
      distance: distance || undefined,
      percent,
      vma,
      pace,
      timeSeconds,
    };
  }

  return null;
}

function calculateTargetFromText(
  session: Session,
  profileVma: string,
  profileFcMax: string
): PersonalGoal | null {
  const text = `${session.title || ""} ${session.description || ""}`.toLowerCase();
  const vma = Number(profileVma || 0);
  const fcMax = Number(profileFcMax || 0);

  const isTrailSession =
    session.type?.toLowerCase().includes("trail") ||
    text.includes("côte") ||
    text.includes("cote") ||
    text.includes("montée") ||
    text.includes("montee") ||
    text.includes("d+") ||
    text.includes("dénivelé");

  const vmaMatch = text.match(/(\d+)\s*[x×]\s*(\d+)\s*(m|km)?\s*.*?(\d+)\s*%\s*(de\s*)?vma/);
  const fcMatch = text.match(/(\d+)\s*%\s*(de\s*)?(fc\s*max|fc|max)/);
  const seuilMatch = text.match(/(\d+)\s*[x×]\s*(\d+)'?\s*(au\s*)?seuil/);
  const seuilHillMatch = text.match(/(\d+)\s*[x×]\s*(\d+)\s*['’]?\s*(?:au\s*)?seuil.*?(côte|cote|montée|montee)/);
  const svHillMatch = text.match(/(\d+)\s*[x×]\s*\(?\s*(\d+)\s*['’]\s*sv2\s*\+\s*(\d+)\s*['’]\s*sv1\s*\)?/);
  const efMatch = text.match(/(^|\s|-)ef(\s|$)|endurance\s+fondamentale|footing/);
  const km10Match = text.match(/(\d+)\s*[x×]\s*(\d+)\s*(m|km)?\s*.*?(allure\s*)?(10\s?km)/);
  const allureMatch = text.match(/allure\s*(\d+)'(\d{1,2})"?/);
  const seuilIntervalMatch = text.match(/(\d+)\s*[x×]\s*((?:\d+\s*['’]\s*)?\d+)\s*["”]?\s*\/\s*((?:\d+\s*['’]\s*)?\d+)\s*["”]?\s*.*?seuil/);
  const vmaTimeIntervalMatch = text.match(/(\d+)\s*[x×]\s*((?:\d+\s*['’]\s*)?\d+)\s*(?:["”]|sec|s|secondes?)?\s*\/\s*((?:\d+\s*['’]\s*)?\d+)\s*(?:["”]|sec|s|secondes?)?\s*.*?(vma|vite)/);

  if (efMatch) {
    return {
      type: "effort",
      title: isTrailSession ? "Endurance fondamentale trail" : "Endurance fondamentale",
      detail: isTrailSession
        ? "Footing trail en aisance respiratoire : effort facile, régulier, sans chercher l’allure route."
        : "Footing en endurance fondamentale : effort facile, tu dois pouvoir parler en courant.",
      fcLabel: isTrailSession
        ? formatFcRangeLabel(profileFcMax, null, 75, "endurance") + " À adapter au terrain."
        : formatFcRangeLabel(profileFcMax, null, 75, "endurance"),
      surface: isTrailSession ? "trail" : "route",
    };
  }

  if (svHillMatch) {
    const repetitions = Number(svHillMatch[1]);
    const sv2Minutes = Number(svHillMatch[2]);
    const sv1Minutes = Number(svHillMatch[3]);

    return {
      type: "effort",
      title: `${repetitions} × (${sv2Minutes}' SV2 + ${sv1Minutes}' SV1) en côte`,
      detail: "Alternance en côte : 4 minutes proches SV2 puis 2 minutes proches SV1. L’objectif est de rester maîtrisé, sans exploser sur les fractions SV2.",
      fcLabel: formatCombinedFcLabel(profileFcMax),
      surface: "trail",
    };
  }

  if (seuilHillMatch) {
    const repetitions = Number(seuilHillMatch[1]);
    const durationMin = Number(seuilHillMatch[2]);
    const hasActiveDownhill = text.includes("descente active") || text.includes("recup active") || text.includes("récup active");

    return {
      type: "effort",
      title: `${repetitions} × ${durationMin}' au seuil en côte`,
      detail: hasActiveDownhill
        ? "Travail au seuil en côte avec descente active : monter à effort contrôlé, puis redescendre en récupération active sans se mettre dans le rouge."
        : "Travail au seuil en côte/trail : garder un effort contrôlé, sans chercher l’allure route.",
      fcLabel: formatFcRangeLabel(profileFcMax, 85, 90, "seuil") + " Proche SV2. La pente prime sur l’allure.",
      surface: "trail",
    };
  }

  if (vmaTimeIntervalMatch && vma > 0) {
    const repetitions = Number(vmaTimeIntervalMatch[1]);
    const workSeconds = parseIntervalDurationToSeconds(vmaTimeIntervalMatch[2]);
    const recoverySeconds = parseIntervalDurationToSeconds(vmaTimeIntervalMatch[3]);

    if (!workSeconds) return null;

    const percent = 100;
    const speed = (vma * percent) / 100;
    const pace = 60 / speed;
    const distance = Math.round((speed * 1000 * workSeconds) / 3600);

    return {
      type: "vma",
      repetitions,
      distance,
      percent,
      vma,
      pace,
      timeSeconds: workSeconds,
      recoverySeconds: recoverySeconds || undefined,
      isTimeBased: true,
    };
  }

  if (vmaMatch && vma > 0) {
    const repetitions = Number(vmaMatch[1]);
    const distance = vmaMatch[3] === "km" ? Number(vmaMatch[2]) * 1000 : Number(vmaMatch[2]);
    const percent = Number(vmaMatch[4]);
    const speed = (vma * percent) / 100;
    const pace = 60 / speed;
    const timeSeconds = (distance / 1000) * pace * 60;
    return { type: "vma", repetitions, distance, percent, vma, pace, timeSeconds };
  }

  if (seuilIntervalMatch) {
    const repetitions = Number(seuilIntervalMatch[1]);
    const workSeconds = parseIntervalDurationToSeconds(seuilIntervalMatch[2]) || 0;
    const recoverySeconds = parseIntervalDurationToSeconds(seuilIntervalMatch[3]) || 0;

    return {
      type: "effort",
      title: `${repetitions} × ${formatDuration(workSeconds)}/${formatDuration(recoverySeconds)} au seuil`,
      detail: isTrailSession
        ? "Travail au seuil en terrain variable : privilégier l’effort et la respiration, sans chercher une allure fixe."
        : "Travail au seuil court : rester contrôlé, régulier, sans partir trop vite.",
      fcLabel: isTrailSession ? formatFcRangeLabel(profileFcMax, 85, 90, "seuil") + " Zone SV2." : "Repère : environ 85–90% VMA ou zone SV2",
      surface: isTrailSession ? "trail" : "route",
    };
  }

  if (seuilMatch && vma > 0) {
    const repetitions = Number(seuilMatch[1]);
    const durationMin = Number(seuilMatch[2]);
    const percent = isTrailSession ? 80 : 83;
    const speed = (vma * percent) / 100;
    const pace = 60 / speed;

    return {
      type: "seuil",
      surface: isTrailSession ? "trail" : "route",
      repetitions,
      durationMin,
      percent,
      vma,
      pace,
      timeSeconds: durationMin * 60,
    };
  }

  if (km10Match && vma > 0) {
    const repetitions = Number(km10Match[1]);
    const distance = km10Match[3] === "km" ? Number(km10Match[2]) * 1000 : Number(km10Match[2]);
    const percent = isTrailSession ? 85 : 88;
    const speed = (vma * percent) / 100;
    const pace = 60 / speed;
    const timeSeconds = (distance / 1000) * pace * 60;

    return {
      type: "10km",
      surface: isTrailSession ? "trail" : "route",
      repetitions,
      distance,
      percent,
      vma,
      pace,
      timeSeconds,
    };
  }

  if (fcMatch && fcMax > 0) {
    const percent = Number(fcMatch[1]);
    return { type: "fc", percent, fcMax, targetFc: Math.round((fcMax * percent) / 100) };
  }

  if (allureMatch) {
    const minutes = Number(allureMatch[1]);
    const seconds = Number(allureMatch[2]);
    return { type: "allure", pace: minutes + seconds / 60 };
  }

  return null;
}

function calculateTargetsFromText(
  session: Session,
  profileVma: string,
  profileFcMax: string
): PersonalGoal[] {
  const rawText = `${session.title || ""}\n${session.description || ""}`;
  const lines = rawText
    .split(/\n+/)
    .map((line) => line.trim().replace(/^[-•]+\s*/, ""))
    .filter((line) => line.length > 0)
    .filter((line) => !/^plusieurs\s+options?\s*:?$/i.test(line))
    .filter((line) => !/^rdv\b/i.test(line));

  const goals: PersonalGoal[] = [];

  for (const line of lines) {
    const lineSession: Session = {
      ...session,
      title: line,
      description: line,
    };

    const goal = calculateTargetFromText(lineSession, profileVma, profileFcMax);

    if (goal) {
      goals.push(goal);
      continue;
    }

    const lower = line.toLowerCase();
    const isTrailOrHill =
      session.type?.toLowerCase().includes("trail") ||
      lower.includes("côte") ||
      lower.includes("cote") ||
      lower.includes("montée") ||
      lower.includes("montee") ||
      lower.includes("d+") ||
      lower.includes("dénivelé");

    if (lower.includes("seuil")) {
      goals.push({
        type: "effort",
        title: line,
        detail: isTrailOrHill
          ? "Travail au seuil en côte/trail : garder un effort contrôlé, sans chercher l’allure route."
          : "Travail au seuil : effort difficile mais maîtrisé, proche SV2.",
        fcLabel: isTrailOrHill ? formatFcRangeLabel(profileFcMax, 85, 90, "seuil") : "Repère : environ 85–90% VMA ou zone SV2",
        surface: isTrailOrHill ? "trail" : "route",
      });
    }
  }

  const uniqueGoals = goals.filter((goal, index) => {
    const key = JSON.stringify(goal);
    return goals.findIndex((item) => JSON.stringify(item) === key) === index;
  });

  return uniqueGoals;
}


const PRIVACY_VERSION = "2026-05-10";

const PRIVACY_TEXT = `Politique de confidentialité — Application ASM Course à Pied

L’application ASM Course à Pied est destinée aux adhérents du club afin de consulter les séances, s’inscrire aux entraînements et faciliter l’organisation de la vie sportive du club.

Les données collectées peuvent être : nom, prénom, adresse email, participation aux séances, statut de présence, chronos, VMA ou informations sportives utiles à la personnalisation des objectifs d’entraînement.

Ces données sont utilisées uniquement pour le fonctionnement interne du club : gestion des séances, organisation des présences, suivi des entraînements et personnalisation des allures.

Les données sont accessibles uniquement aux administrateurs autorisés du club et, si nécessaire, aux entraîneurs habilités.

Les données sont hébergées par Supabase et l’application est déployée via Vercel.

Aucune donnée n’est vendue, cédée ou utilisée à des fins commerciales.

Chaque adhérent peut demander l’accès, la modification ou la suppression de ses données en contactant le club à l’adresse suivante : contact@asmpau-courseapied.org.

Les données sont conservées pendant la durée d’adhésion au club, puis peuvent être supprimées sur demande ou après départ du club.

L’ASM Course à Pied s’engage à protéger les données personnelles de ses adhérents et à limiter la collecte aux informations strictement utiles au fonctionnement de l’application.`;

function PrivacyPolicyBlock() {
  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 18,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(214,232,59,0.22)",
        textAlign: "left",
        maxHeight: 280,
        overflow: "auto",
        whiteSpace: "pre-line",
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      {PRIVACY_TEXT}
    </div>
  );
}

export default function CalendarApp() {
  const [activeTab, setActiveTab] = useState<AppTab>("calendar");
  const [showMenu, setShowMenu] = useState(false);
  const [showAdminActions, setShowAdminActions] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [pendingProfiles, setPendingProfiles] = useState<MemberProfile[]>([]);
  const [approvedProfiles, setApprovedProfiles] = useState<MemberProfile[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<AccountDeletionRequest[]>([]);
  const [deletionRequestSent, setDeletionRequestSent] = useState(false);
  const [sendingDeletionRequest, setSendingDeletionRequest] = useState(false);
  const [approvingProfileId, setApprovingProfileId] = useState<string | null>(null);
  const [approvingAdminProfileId, setApprovingAdminProfileId] = useState<string | null>(null);
  const [deactivatingProfileId, setDeactivatingProfileId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyAcceptedAt, setPrivacyAcceptedAt] = useState<string | null>(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const [profileSexe, setProfileSexe] = useState("");
  const [profileVma, setProfileVma] = useState("");
  const [profileFcMax, setProfileFcMax] = useState("");
  const [profileFcRest, setProfileFcRest] = useState("");
  const [personalChronos, setPersonalChronos] = useState<PersonalChrono[]>([]);
  const [showChronoForm, setShowChronoForm] = useState(false);
  const [showChronoGraph, setShowChronoGraph] = useState(false);
  const [selectedChronoId, setSelectedChronoId] = useState<string | null>(null);
  const [chronoDistance, setChronoDistance] = useState("10 km");
  const [chronoRace, setChronoRace] = useState("");
  const [chronoTime, setChronoTime] = useState("");
  const [chronoDate, setChronoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [chronoElevationGain, setChronoElevationGain] = useState("");

  const [raceDistance, setRaceDistance] = useState("");
  const [raceTime, setRaceTime] = useState("");

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showParticipantList, setShowParticipantList] = useState<ParticipationStatus | null>(null);
  const [selectedGoalIndex, setSelectedGoalIndex] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return window.localStorage.getItem("asm-notifications") === "true";
  });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(
  window.location.pathname === "/reset-password"
);
const [newPassword, setNewPassword] = useState("");
  const [showGpxMap, setShowGpxMap] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [gpxStats, setGpxStats] = useState<{ distance: string; elevationGain: number } | null>(null);
  const [importPlanText, setImportPlanText] = useState("");
  const [importPlanSport, setImportPlanSport] = useState("Trail");
  const [importPlanYear, setImportPlanYear] = useState(String(new Date().getFullYear()));
  const [importedSessions, setImportedSessions] = useState<ImportedPlanSession[]>([]);
  const [importingPlan, setImportingPlan] = useState(false);

  const chronoStorageKey = user?.id ? `asm-personal-chronos-${user.id}` : "asm-personal-chronos-demo";

  useEffect(() => {
    const storedChronos = window.localStorage.getItem(chronoStorageKey);
    setPersonalChronos(storedChronos ? JSON.parse(storedChronos) : []);
  }, [chronoStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(chronoStorageKey, JSON.stringify(personalChronos));
  }, [chronoStorageKey, personalChronos]);

  const chronoEvolutionGroups = useMemo(() => {
    type ChronoEvolutionItem = {
      id: string;
      date: string;
      chrono: string;
      seconds: number;
      theoreticalSeconds?: number;
      theoreticalChrono?: string;
    };

    const grouped = personalChronos.reduce<Record<string, ChronoEvolutionItem[]>>(
      (acc, chrono) => {
        const seconds = parseChronoToSeconds(chrono.chrono);
        if (!seconds) return acc;

        const theoretical = theoreticalChronoFromVma(chrono.distance, chrono.vmaAtEntry || profileVma);

        acc[chrono.distance] = acc[chrono.distance] || [];
        acc[chrono.distance].push({
          id: chrono.id,
          date: chrono.date,
          chrono: chrono.chrono,
          seconds,
          theoreticalSeconds: theoretical?.seconds,
          theoreticalChrono: theoretical?.label,
        });
        return acc;
      },
      {}
    );

    return Object.entries(grouped)
      .map(([distance, items]) => {
        const sorted = items.slice().sort((a, b) => a.date.localeCompare(b.date));

        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const gainSeconds = first.seconds - last.seconds;
        const progressPercent = gainSeconds > 0 ? ((gainSeconds / first.seconds) * 100).toFixed(1) : null;
        const theoreticalValues = sorted
          .map((item) => item.theoreticalSeconds)
          .filter((value): value is number => Boolean(value));
        const allValues = [...sorted.map((item) => item.seconds), ...theoreticalValues];
        const minSeconds = Math.min(...allValues);
        const maxSeconds = Math.max(...allValues);
        const range = Math.max(maxSeconds - minSeconds, 1);
        const toPoint = (seconds: number, index: number) => {
          const x = sorted.length === 1 ? 12 : 12 + (index / (sorted.length - 1)) * 276;
          const y = 18 + ((seconds - minSeconds) / range) * 84;
          return `${x},${y}`;
        };
        const points = sorted.map((item, index) => toPoint(item.seconds, index)).join(" ");
        const theoreticalPoints = sorted
          .map((item, index) => (item.theoreticalSeconds ? toPoint(item.theoreticalSeconds, index) : null))
          .filter(Boolean)
          .join(" ");
        const lastTheoretical = [...sorted].reverse().find((item) => item.theoreticalSeconds);
        const isBetterThanTheoretical = Boolean(
          lastTheoretical?.theoreticalSeconds && last.seconds < lastTheoretical.theoreticalSeconds
        );
        const theoreticalGapSeconds =
          lastTheoretical?.theoreticalSeconds && last.seconds < lastTheoretical.theoreticalSeconds
            ? Math.round(lastTheoretical.theoreticalSeconds - last.seconds)
            : null;

        return {
          distance,
          sorted,
          first,
          last,
          gainSeconds,
          progressPercent,
          points,
          theoreticalPoints,
          lastTheoretical,
          isBetterThanTheoretical,
          theoreticalGapSeconds,
          minSeconds,
          maxSeconds,
        };
      })
      .filter(Boolean) as {
      distance: string;
      sorted: ChronoEvolutionItem[];
      first: ChronoEvolutionItem;
      last: ChronoEvolutionItem;
      gainSeconds: number;
      progressPercent: string | null;
      points: string;
      theoreticalPoints: string;
      lastTheoretical?: ChronoEvolutionItem;
      isBetterThanTheoretical: boolean;
      theoreticalGapSeconds: number | null;
      minSeconds: number;
      maxSeconds: number;
    }[];
  }, [personalChronos, profileVma]);


  async function addPersonalChrono() {
    const cleanedTime = chronoTime.trim();
    const currentSeconds = parseChronoToSeconds(cleanedTime);

    if (!chronoDistance || !cleanedTime || !chronoDate) {
      alert("Merci de renseigner au minimum la distance, le chrono et la date.");
      return;
    }

    if (!currentSeconds) {
      alert("Format de chrono incorrect. Exemple : 42:00 ou 1:32:15.");
      return;
    }

    const previousBest = personalChronos
      .filter((chrono) => chrono.distance === chronoDistance)
      .map((chrono) => ({ ...chrono, seconds: parseChronoToSeconds(chrono.chrono) || Infinity }))
      .sort((a, b) => a.seconds - b.seconds)[0];

    const previousChrono = previousBest && currentSeconds < previousBest.seconds ? previousBest.chrono : undefined;
    const theoretical = theoreticalChronoFromVma(chronoDistance, profileVma);
    const theoreticalGainSeconds = theoretical && currentSeconds < theoretical.seconds ? Math.round(theoretical.seconds - currentSeconds) : undefined;
    const suggestedVma = estimateVmaFromChronoDistance(chronoDistance, currentSeconds);
    const currentVma = Number(profileVma || 0);
    const suggestedVmaNumber = Number(suggestedVma || 0);
    const shouldUpdateVma = Boolean(suggestedVma && (!currentVma || suggestedVmaNumber > currentVma + 0.2));

    const newChrono: PersonalChrono = {
      id: `${Date.now()}`,
      distance: chronoDistance,
      race: chronoRace.trim() || "Course enregistrée",
      chrono: formatChronoFromSeconds(currentSeconds),
      previousChrono,
      date: chronoDate,
      elevationGain: chronoDistance.toLowerCase().includes("trail") ? chronoElevationGain.trim() : undefined,
      theoreticalChrono: theoretical?.label,
      theoreticalGainSeconds,
      suggestedVma: suggestedVma || undefined,
      vmaAtEntry: profileVma || undefined,
      vmaUpdated: false,
    };

    setPersonalChronos((current) => [newChrono, ...current]);
    setChronoRace("");
    setChronoTime("");
    setChronoDate(new Date().toISOString().slice(0, 10));
    setChronoElevationGain("");
    setShowChronoForm(false);

    if (shouldUpdateVma && suggestedVma) {
      alert(
        "🏆 Super chrono ! Tu viens de poser un nouveau repère fort.\n\n" +
          "⚡ VMA actuelle : " +
          (profileVma || "non renseignée") +
          " km/h • VMA estimée avec ce chrono : " +
          suggestedVma +
          " km/h.\n\n" +
          "🖤💛 Cela montre une belle progression depuis l’ASM. Tu peux mettre à jour ta VMA avec le bouton dans l’analyse pour adapter tes prochaines allures."
      );
    } else if (previousChrono || theoreticalGainSeconds) {
      alert("🏆 Bravo ! Nouveau chrono validé. Tu continues à construire ta progression ASM 💪");
    }
  }

  function deletePersonalChrono(chronoId: string) {
    if (!window.confirm("Supprimer ce chrono ?")) return;
    setPersonalChronos((current) => current.filter((chrono) => chrono.id !== chronoId));
    setSelectedChronoId((current) => (current === chronoId ? null : current));
  }

  async function applySuggestedVmaFromChrono(suggestedVma: string, chronoId?: string) {
    setProfileVma(suggestedVma);
    if (chronoId) {
      setPersonalChronos((current) =>
        current.map((chrono) =>
          chrono.id === chronoId ? { ...chrono, vmaUpdated: true } : chrono
        )
      );
    }

    if (!user) {
      alert(`✅ VMA mise à jour à ${suggestedVma} km/h dans ton profil.`);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ vma: Number(suggestedVma) })
      .eq("id", user.id);

    if (error) {
      alert("La VMA a été modifiée dans l'application, mais pas sauvegardée dans Supabase : " + error.message);
      return;
    }

    alert(`✅ VMA mise à jour à ${suggestedVma} km/h. Tes prochaines allures seront mieux adaptées à ton niveau actuel.`);
  }

  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("Trail");
  const [formStartTime, setFormStartTime] = useState("18:30");
  const [formEndTime, setFormEndTime] = useState("20:00");
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formWorkoutMode, setFormWorkoutMode] = useState<WorkoutMode>("");
  const [formFractionDistance, setFormFractionDistance] = useState("");
  const [formIntensityPercent, setFormIntensityPercent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [gpxFile, setGpxFile] = useState<File | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const mondayBasedOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const presentParticipants = participants.filter((p) => p.status === "present");
  const interestedParticipants = participants.filter((p) => p.status === "interested");
  const myParticipation = participants.find((p) => p.user_id === user?.id)?.status;
  const canEditSelectedSession = isAdmin || selectedSession?.created_by === user?.id;
  const displayName = firstname || lastname ? `${firstname} ${lastname}`.trim() : user?.email || "Adhérent";

  const sessionsByDate = useMemo(() => {
    return sessions.reduce((acc, session) => {
      acc[session.date] = true;
      return acc;
    }, {} as Record<string, boolean>);
  }, [sessions]);

  const sessionsForSelectedDate = selectedDate
    ? sessions.filter((session) => session.date === selectedDate)
    : [];

  const displayedParticipantList =
    showParticipantList === "present" ? presentParticipants : interestedParticipants;

  const personalGoals = selectedSession && myParticipation === "present"
    ? (() => {
        const textGoals = calculateTargetsFromText(selectedSession, profileVma, profileFcMax);
        const structuredGoal = calculateTargetFromStructuredSession(selectedSession, profileVma, profileFcMax);
        return textGoals.length > 0 ? textGoals : structuredGoal ? [structuredGoal] : [];
      })()
    : [];

  useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setUser(data.user);
    if (!data.user) setProfileLoaded(true);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
    if (!session?.user) setProfileLoaded(true);
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);

  useEffect(() => {
    if (!user) return;
    fetchSessions();
    fetchMyProfile();
  }, [user]);

  useEffect(() => {
    if (!selectedSession) {
      setParticipants([]);
      setShowAdminActions(false);
      return;
    }

    setSelectedGoalIndex(0);
    fetchParticipants(selectedSession.id);
  }, [selectedSession]);

 async function fetchMyProfile() {
  if (!user) return;

  setProfileLoaded(false);

  const userEmail = (user.email || "").trim().toLowerCase();
  const isBootstrapAdmin = ADMIN_EMAILS.includes(userEmail);

  let { data, error } = await supabase
    .from("profiles")
    .select("id, firstname, lastname, pseudo, sexe, vma, fc_max, fc_rest, is_admin, approved, active, email")
    .eq("id", user.id)
    .maybeSingle();

  // Sécurité : certains anciens comptes peuvent avoir été créés avec l'email
  // mais pas avec le bon id Supabase. On tente donc aussi une recherche email.
  if (!data && userEmail) {
    const result = await supabase
      .from("profiles")
      .select("id, firstname, lastname, pseudo, sexe, vma, fc_max, fc_rest, is_admin, approved, active, email")
      .ilike("email", userEmail)
      .maybeSingle();

    data = result.data;
    error = result.error;
  }

  // Point important : si aucun profil n'existe, on ne bloque plus l'utilisateur
  // sur "Profil introuvable". On crée automatiquement une demande en attente,
  // visible ensuite dans l'espace admin.
  if (!data) {
    const meta = (user.user_metadata || {}) as Record<string, string>;
    const fallbackFirstname = meta.firstname || meta.first_name || userEmail.split("@")[0] || "";
    const fallbackLastname = meta.lastname || meta.last_name || "";
    const fallbackPseudo = fallbackLastname
      ? `${fallbackFirstname} ${fallbackLastname.charAt(0).toUpperCase()}.`
      : fallbackFirstname;

    const { data: createdProfile, error: createProfileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          firstname: fallbackFirstname,
          lastname: fallbackLastname,
          pseudo: fallbackPseudo,
          email: userEmail,
          is_admin: isBootstrapAdmin,
          approved: isBootstrapAdmin ? true : false,
          active: true,
        },
        { onConflict: "id" }
      )
      .select("id, firstname, lastname, pseudo, sexe, vma, fc_max, fc_rest, is_admin, approved, active, email")
      .maybeSingle();

    if (createProfileError || !createdProfile) {
      alert("Ton compte existe, mais la demande d'accès n'a pas pu être créée : " + (createProfileError?.message || "aucune donnée"));
      setIsAdmin(false);
      setIsApproved(false);
      setIsActive(true);
      setProfileLoaded(true);
      return;
    }

    data = createdProfile;
    error = null;
  }

  if (error || !data) {
    alert("Erreur chargement profil : " + (error?.message || "aucune donnée"));
    setIsAdmin(false);
    setIsApproved(false);
    setIsActive(true);
    setProfileLoaded(true);
    return;
  }

  // Si le compte retrouvé par email n'a pas le bon id, on crée aussi une ligne
  // propre pour l'id Auth courant. Cela évite les comptes invisibles côté admin.
  if (data.id !== user.id) {
    const { data: fixedProfile, error: fixProfileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          firstname: data.firstname || userEmail.split("@")[0] || "",
          lastname: data.lastname || "",
          pseudo: data.pseudo || data.firstname || userEmail.split("@")[0] || "",
          email: userEmail,
          is_admin: isBootstrapAdmin ? true : false,
          approved: isBootstrapAdmin ? true : false,
          active: true,
        },
        { onConflict: "id" }
      )
      .select("id, firstname, lastname, pseudo, sexe, vma, fc_max, fc_rest, is_admin, approved, active, email")
      .maybeSingle();

    if (!fixProfileError && fixedProfile) {
      data = fixedProfile;
    }
  }

  if (isBootstrapAdmin && (data.is_admin !== true || data.approved !== true || data.active === false)) {
    const { data: updatedAdminProfile, error: updateAdminError } = await supabase
      .from("profiles")
      .update({
        email: userEmail,
        approved: true,
        active: true,
        is_admin: true,
      })
      .eq("id", data.id)
      .select("id, firstname, lastname, pseudo, sexe, vma, fc_max, fc_rest, is_admin, approved, active, email")
      .maybeSingle();

    if (!updateAdminError && updatedAdminProfile) {
      data = updatedAdminProfile;
    }
  }

  setFirstname(data.firstname || "");
  setLastname(data.lastname || "");
  setProfileSexe(data.sexe || "");
  setProfileVma(data.vma ? String(data.vma) : "");
  setProfileFcMax(data.fc_max ? String(data.fc_max) : "");
  setProfileFcRest(data.fc_rest ? String(data.fc_rest) : "");
  setIsAdmin(data.is_admin === true);
  setIsApproved(data.approved === true);
  setIsActive(data.active !== false);

  const { data: privacyData } = await supabase
    .from("profiles")
    .select("privacy_accepted, privacy_accepted_at")
    .eq("id", data.id)
    .maybeSingle();

  setPrivacyAccepted(privacyData?.privacy_accepted === true);
  setPrivacyAcceptedAt(privacyData?.privacy_accepted_at || null);

  const { data: existingDeletionRequest } = await supabase
    .from("account_deletion_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  setDeletionRequestSent(Boolean(existingDeletionRequest));

  if (data.is_admin === true) {
    await fetchPendingProfiles();
    await fetchApprovedProfiles();
    await fetchDeletionRequests(true);
  }

  setProfileLoaded(true);
}
  async function fetchPendingProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, firstname, lastname, pseudo, email, is_admin, approved, active")
      // Important : un profil créé par Supabase peut avoir approved à null.
      // Pour éviter qu'une demande reste invisible, on récupère false OU null.
      .or("approved.is.false,approved.is.null")
      // On exclut uniquement les comptes explicitement désactivés.
      .or("active.is.true,active.is.null");

    if (error) {
      // On ne bloque plus l'application avec une fenêtre d'alerte.
      // Cela évite les popups à l'ouverture si Supabase refuse une colonne ou un tri.
      console.error("Erreur chargement demandes :", error.message);
      setPendingProfiles([]);
      return;
    }

    const sortedProfiles = [...(data || [])].sort((a, b) =>
      `${a.firstname || ""} ${a.lastname || ""} ${a.email || ""}`.localeCompare(
        `${b.firstname || ""} ${b.lastname || ""} ${b.email || ""}`
      )
    );

    setPendingProfiles(sortedProfiles as MemberProfile[]);
  }

  async function fetchApprovedProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, firstname, lastname, pseudo, email, is_admin, approved, active")
      .eq("approved", true)
      .eq("active", true);

    if (error) {
      // Même logique : pas d'alerte bloquante au démarrage.
      console.error("Erreur chargement membres :", error.message);
      setApprovedProfiles([]);
      return;
    }

    const sortedProfiles = [...(data || [])].sort((a, b) =>
      `${a.firstname || ""} ${a.lastname || ""} ${a.email || ""}`.localeCompare(
        `${b.firstname || ""} ${b.lastname || ""} ${b.email || ""}`
      )
    );

    setApprovedProfiles(sortedProfiles as MemberProfile[]);
  }

  async function fetchDeletionRequests(forceAdmin = false) {
    if (!forceAdmin && !isAdmin) return;

    const { data, error } = await supabase
      .from("account_deletion_requests")
      .select("id, user_id, email, firstname, lastname, reason, status, created_at, processed_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement suppressions :", error.message);
      setDeletionRequests([]);
      return;
    }

    setDeletionRequests((data || []) as AccountDeletionRequest[]);
  }

  async function refreshAdminLists() {
    await fetchPendingProfiles();
    await fetchApprovedProfiles();
    await fetchDeletionRequests();
  }

  async function approveProfile(profileId: string) {
    if (!user || !isAdmin) return;

    setApprovingProfileId(profileId);

    const { error } = await supabase
      .from("profiles")
      .update({
        approved: true,
        active: true,
        is_admin: false,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq("id", profileId);

    if (error) {
      alert("Erreur validation : " + error.message);
      setApprovingProfileId(null);
      return;
    }

    await refreshAdminLists();
    setApprovingProfileId(null);
  }

  async function approveAdminProfile(profileId: string) {
    if (!user || !isAdmin) return;

    setApprovingAdminProfileId(profileId);

    const { error } = await supabase
      .from("profiles")
      .update({
        approved: true,
        active: true,
        is_admin: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq("id", profileId);

    if (error) {
      alert("Erreur validation admin : " + error.message);
      setApprovingAdminProfileId(null);
      return;
    }

    await refreshAdminLists();
    setApprovingAdminProfileId(null);
  }
async function toggleAdminProfile(profileId: string, makeAdmin: boolean) {
  if (!user || !isAdmin) return;

  const confirmMessage = makeAdmin
    ? "Nommer cette personne administrateur ?"
    : "Retirer les droits administrateur à cette personne ?";

  if (!window.confirm(confirmMessage)) return;

  const { error } = await supabase
    .from("profiles")
    .update({
      is_admin: makeAdmin,
    })
    .eq("id", profileId);

  if (error) {
    alert("Erreur modification admin : " + error.message);
    return;
  }

  await refreshAdminLists();
}
  async function deactivateProfile(profileId: string) {
    if (!isAdmin) return;

    const confirmDelete = window.confirm("Retirer l'accès de cette personne ?");
    if (!confirmDelete) return;

    setDeactivatingProfileId(profileId);

    const { error } = await supabase
      .from("profiles")
      .update({
        active: false,
        approved: false,
        is_admin: false,
      })
      .eq("id", profileId);

    if (error) {
      alert("Erreur suppression : " + error.message);
      setDeactivatingProfileId(null);
      return;
    }

    await refreshAdminLists();
    setDeactivatingProfileId(null);
  }

  async function saveMyProfile() {
    if (!user) return;

    const pseudo = `${firstname} ${lastname.charAt(0).toUpperCase()}.`;

    const privacyDate = privacyAcceptedAt || (privacyAccepted ? new Date().toISOString() : null);

    const { error } = await supabase
      .from("profiles")
      .update({
        firstname,
        lastname,
        pseudo,
        sexe: profileSexe,
        vma: profileVma ? Number(profileVma) : null,
        fc_max: profileFcMax ? Number(profileFcMax) : null,
        fc_rest: profileFcRest ? Number(profileFcRest) : null,
        privacy_accepted: privacyAccepted,
        privacy_accepted_at: privacyDate,
        privacy_version: privacyAccepted ? PRIVACY_VERSION : null,
      })
      .eq("id", user.id);

    if (error) {
      const { error: fallbackError } = await supabase
        .from("profiles")
        .update({
          firstname,
          lastname,
          pseudo,
          sexe: profileSexe,
          vma: profileVma ? Number(profileVma) : null,
          fc_max: profileFcMax ? Number(profileFcMax) : null,
          fc_rest: profileFcRest ? Number(profileFcRest) : null,
        })
        .eq("id", user.id);

      if (fallbackError) {
        alert("Erreur sauvegarde profil : " + fallbackError.message);
        return;
      }
    }

    setPrivacyAcceptedAt(privacyDate);

    alert("Profil enregistré");
  }

  async function requestAccountDeletion() {
    if (!user || sendingDeletionRequest || deletionRequestSent) return;

    const confirmRequest = window.confirm(
      "Confirmer la demande de suppression de ton compte ? Un administrateur du club traitera ensuite la demande."
    );

    if (!confirmRequest) return;

    setSendingDeletionRequest(true);

    const { error } = await supabase
      .from("account_deletion_requests")
      .insert({
        user_id: user.id,
        email: user.email || email || null,
        firstname: firstname || null,
        lastname: lastname || null,
        reason: "Demande envoyée depuis l’application",
        status: "pending",
      });

    setSendingDeletionRequest(false);

    if (error) {
      alert("La demande n’a pas pu être envoyée : " + error.message);
      return;
    }

    setDeletionRequestSent(true);
    alert("Ta demande de suppression a bien été envoyée au club.");
  }

  async function markDeletionRequestProcessed(requestId: string) {
    if (!isAdmin) return;

    const confirmDone = window.confirm(
      "Marquer cette demande comme traitée ? À faire seulement après avoir supprimé ou anonymisé le compte concerné dans Supabase."
    );

    if (!confirmDone) return;

    const { error } = await supabase
      .from("account_deletion_requests")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      alert("Erreur mise à jour demande : " + error.message);
      return;
    }

    await fetchDeletionRequests();
  }

  async function fetchSessions() {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      alert("Erreur chargement séances : " + error.message);
      return;
    }

    setSessions((data || []) as Session[]);
  }

  async function fetchParticipants(sessionId: string) {
    const { data: rows, error } = await supabase
      .from("participants")
      .select("id, session_id, user_id, status")
      .eq("session_id", sessionId);

    if (error) {
      alert("Erreur chargement participants : " + error.message);
      return;
    }

    const userIds = [...new Set((rows || []).map((row) => row.user_id))];

    if (userIds.length === 0) {
      setParticipants([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, firstname, lastname, pseudo")
      .in("id", userIds);

    const enriched = (rows || []).map((row) => {
      const profile = (profiles || []).find((p) => p.id === row.user_id);
      return {
        ...row,
        firstname: profile?.pseudo || profile?.firstname || "Adhérent",
        lastname: profile?.pseudo ? "" : profile?.lastname || "",
      };
    });

    setParticipants(enriched as Participant[]);
  }

  async function handleForgotPassword() {
    if (!email) {
      alert("Renseigne d'abord ton adresse email.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      alert("Erreur : " + error.message);
      return;
    }

    alert("Un email de réinitialisation vient d'être envoyé.");
  }

  async function handleLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert("Erreur de connexion : " + error.message);
      return;
    }

    setProfileLoaded(false);
    setUser(data.user);
  }
async function handleUpdatePassword() {
  if (!newPassword || newPassword.length < 6) {
    alert("Le mot de passe doit contenir au moins 6 caractères.");
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    alert("Erreur modification mot de passe : " + error.message);
    return;
  }

  alert("Mot de passe modifié. Tu peux maintenant te reconnecter.");
setIsPasswordRecovery(false);
setNewPassword("");
setUser(null);
setIsAdmin(false);
setIsApproved(false);
setIsActive(true);
setProfileLoaded(true);
window.history.replaceState({}, "", "/");
await supabase.auth.signOut();
}
  async function handleSignup() {
    if (!firstname || !lastname || !email || !password) {
      alert("Merci de remplir prénom, nom, email et mot de passe.");
      return;
    }

    if (!privacyAccepted) {
      alert("Merci d’accepter la politique de confidentialité pour créer un compte.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          firstname,
          lastname,
          pseudo: `${firstname} ${lastname.charAt(0).toUpperCase()}.`,
        },
      },
    });

    if (error) {
      alert("Erreur inscription : " + error.message);
      return;
    }

    const newUser = data.user;
    if (!newUser) return;

    const pseudo = `${firstname} ${lastname.charAt(0).toUpperCase()}.`;
    const acceptedAt = new Date().toISOString();

    // Upsert au lieu de insert : si un trigger Supabase a déjà créé le profil,
    // on le complète et on force le statut "en attente".
    const { error: profileUpsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: newUser.id,
          firstname,
          lastname,
          pseudo,
          email: cleanEmail,
          is_admin: false,
          approved: false,
          active: true,
          privacy_accepted: true,
          privacy_accepted_at: acceptedAt,
          privacy_version: PRIVACY_VERSION,
        },
        { onConflict: "id" }
      );

    if (profileUpsertError) {
      alert("Ton compte a été créé, mais le profil n’a pas pu être préparé : " + profileUpsertError.message);
      return;
    }

    setEmail(cleanEmail);
    setPrivacyAcceptedAt(acceptedAt);
    setIsAdmin(false);
    setIsApproved(false);
    setIsActive(true);
    setProfileLoaded(true);
    setUser(newUser);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setSelectedSession(null);
    setShowMenu(false);
    setIsApproved(false);
    setIsActive(true);
    setDeletionRequestSent(false);
    setProfileLoaded(true);
  }

  function resetForm() {
    setFormTitle("");
    setFormType("Trail");
    setFormStartTime("18:30");
    setFormEndTime("20:00");
    setFormLocation("");
    setFormDescription("");
    setFormWorkoutMode("");
    setFormFractionDistance("");
    setFormIntensityPercent("");
    setImageFile(null);
    setGpxFile(null);
    setIsEditing(false);
    setEditingSession(null);
  }

  function openCreateForm() {
    if (!selectedDate) {
      alert("Choisis d'abord une journée dans le calendrier.");
      return;
    }

    resetForm();
    setSelectedSession(null);
    setActiveTab("calendar");
    setShowCreateForm(true);
  }

  function openEditForm() {
    if (!selectedSession) return;

    setEditingSession(selectedSession);

    setFormTitle(selectedSession.title || "");
    setFormType(selectedSession.type || "Trail");
    setFormStartTime(selectedSession.start_time || "18:30");
    setFormEndTime(selectedSession.end_time || "20:00");
    setFormLocation(selectedSession.location || "");
    setFormDescription(selectedSession.description || "");
    setFormWorkoutMode((selectedSession.workout_mode || "") as WorkoutMode);
    setFormFractionDistance(selectedSession.fraction_distance ? String(selectedSession.fraction_distance) : "");
    setFormIntensityPercent(selectedSession.intensity_percent ? String(selectedSession.intensity_percent) : "");
    setImageFile(null);
    setGpxFile(null);

    setIsEditing(true);
    setShowCreateForm(true);
    setShowAdminActions(false);
    setSelectedSession(null);
  }

  async function uploadFile(file: File, bucketName: string) {
    const filePath = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucketName).upload(filePath, file);

    if (error) {
      alert("Erreur upload fichier : " + error.message);
      return null;
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return data.publicUrl;
  }


  function handlePlanFileChange(file?: File | null) {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      alert("Pour cette première version sans dépendance supplémentaire, exporte le fichier Excel en CSV ou copie-colle le tableau dans la zone d’import. Le bouton est prêt pour intégrer ensuite une lecture XLSX complète.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImportPlanText(String(reader.result || ""));
    reader.readAsText(file);
  }

  function analyseImportedPlan() {
    const year = Number(importPlanYear) || new Date().getFullYear();
    const parsed = parseImportedPlanText(importPlanText, importPlanSport, year);
    setImportedSessions(parsed);
    if (parsed.length === 0) {
      alert("Aucune séance détectée. Copie-colle le contenu du tableau ou utilise un fichier CSV/TXT exporté depuis Excel.");
    }
  }

  function updateImportedSession(id: string, patch: Partial<ImportedPlanSession>) {
    setImportedSessions((current) => current.map((session) => session.id === id ? { ...session, ...patch } : session));
  }

  function removeImportedSession(id: string) {
    setImportedSessions((current) => current.filter((session) => session.id !== id));
  }

  async function createImportedSessions() {
    if (!user || !isAdmin) return;
    if (importedSessions.length === 0) {
      alert("Analyse d’abord un plan avant de l’importer.");
      return;
    }

    setImportingPlan(true);

    const payload = importedSessions.map((session) => ({
      title: session.title || "Séance",
      type: session.type || importPlanSport || "Course à pied",
      date: session.date,
      start_time: session.start_time || "18:30",
      end_time: session.end_time || null,
      location: session.location || "À votre convenance",
      description: session.description,
      image_url: null,
      gpx_url: null,
      created_by: user.id,
      workout_mode: null,
      fraction_distance: null,
      intensity_percent: null,
    }));

    const { data, error } = await supabase.from("sessions").insert(payload).select();
    setImportingPlan(false);

    if (error) {
      alert("Erreur import du plan : " + error.message);
      return;
    }

    setSessions((current) => [...current, ...((data || []) as Session[])]);
    setImportedSessions([]);
    setImportPlanText("");
    setActiveTab("calendar");
    alert(`${payload.length} séance(s) importée(s) dans le calendrier.`);
  }

  async function handleSaveSession() {
    if (!selectedDate && !editingSession?.date) {
      alert("Choisis d'abord une date.");
      return;
    }

    if (!formTitle.trim()) {
      alert("Merci d'ajouter un titre à la séance.");
      return;
    }

    const imageUrl = imageFile
      ? await uploadFile(imageFile, "images")
      : editingSession?.image_url || null;

    const gpxUrl = gpxFile
      ? await uploadFile(gpxFile, "gpx")
      : editingSession?.gpx_url || null;

    const payload = {
      title: formTitle.trim().charAt(0).toUpperCase() + formTitle.trim().slice(1),
      type: formType,
      date: editingSession?.date || selectedDate,
      start_time: formStartTime,
      end_time: formEndTime,
      location: formLocation.trim(),
      description: formDescription,
      image_url: imageUrl,
      gpx_url: gpxUrl,
      created_by: user.id,
      workout_mode: formWorkoutMode || null,
      fraction_distance: formFractionDistance ? Number(formFractionDistance) : null,
      intensity_percent: formIntensityPercent ? Number(formIntensityPercent) : null,
    };

    if (isEditing && editingSession) {
      const { data, error } = await supabase
        .from("sessions")
        .update(payload)
        .eq("id", editingSession.id)
        .select();

      if (error) {
        alert("Erreur modification séance : " + error.message);
        return;
      }

      const updatedSession = data?.[0] as Session | undefined;
      if (updatedSession) {
        setSessions((current) => current.map((session) => session.id === updatedSession.id ? updatedSession : session));
        setSelectedSession(updatedSession);
      }
    } else {
      const { data, error } = await supabase.from("sessions").insert(payload).select();

      if (error) {
        alert("Erreur création séance : " + error.message);
        return;
      }

      if (data?.[0]) setSessions((current) => [...current, data[0] as Session]);
    }

    setEditingSession(null);
    resetForm();
    setShowCreateForm(false);
  }

  async function handleDuplicateSession() {
    if (!selectedSession || !user || !isAdmin) return;

    const newDate = window.prompt("Date de la nouvelle séance au format AAAA-MM-JJ", selectedSession.date);
    if (!newDate) return;

    const payload = {
      title: `${selectedSession.title} - copie`,
      type: selectedSession.type,
      date: newDate,
      start_time: selectedSession.start_time,
      end_time: selectedSession.end_time,
      location: selectedSession.location,
      description: selectedSession.description,
      image_url: selectedSession.image_url,
      gpx_url: selectedSession.gpx_url,
      created_by: user.id,
      workout_mode: selectedSession.workout_mode,
      fraction_distance: selectedSession.fraction_distance,
      intensity_percent: selectedSession.intensity_percent,
    };

    const { data, error } = await supabase.from("sessions").insert(payload).select();

    if (error) {
      alert("Erreur duplication séance : " + error.message);
      return;
    }

    if (data?.[0]) {
      setSessions((current) => [...current, data[0] as Session]);
      alert("Séance dupliquée");
      setShowAdminActions(false);
    }
  }

  async function handleDeleteSession() {
    if (!selectedSession) return;

    if (!window.confirm("Supprimer cette séance ?")) return;

    const { error } = await supabase.from("sessions").delete().eq("id", selectedSession.id);

    if (error) {
      alert("Erreur suppression séance : " + error.message);
      return;
    }

    setSessions((current) => current.filter((session) => session.id !== selectedSession.id));
    setSelectedSession(null);
    setShowAdminActions(false);
  }

  async function handleParticipation(status: ParticipationStatus) {
    if (!selectedSession || !user) return;

    const currentStatus = participants.find((p) => p.user_id === user.id)?.status;

    const { error: deleteError } = await supabase
      .from("participants")
      .delete()
      .eq("session_id", selectedSession.id)
      .eq("user_id", user.id);

    if (deleteError) {
      alert("Erreur modification participation : " + deleteError.message);
      return;
    }

    if (currentStatus === status) {
      fetchParticipants(selectedSession.id);
      setShowAdminActions(false);
      return;
    }

    const { error } = await supabase.from("participants").insert({
      session_id: selectedSession.id,
      user_id: user.id,
      status,
    });

    if (error) {
      alert("Erreur participation : " + error.message);
      return;
    }

    fetchParticipants(selectedSession.id);
    setShowAdminActions(false);
  }

  function toggleNotifications() {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    window.localStorage.setItem("asm-notifications", String(next));
  }

  async function openGpxMap() {
    if (!selectedSession?.gpx_url) return;

    setShowGpxMap(true);
    setMapLoaded(false);
    setGpxStats(null);

    setTimeout(async () => {
      try {
        const response = await fetch(selectedSession.gpx_url || "");
        const gpxText = await response.text();
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxText, "application/xml");

        const points = Array.from(gpxDoc.querySelectorAll("trkpt, rtept"))
          .map((pt) => ({
            lat: Number(pt.getAttribute("lat")),
            lon: Number(pt.getAttribute("lon")),
            ele: Number(pt.querySelector("ele")?.textContent || 0),
          }))
          .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lon));

        if (points.length < 2) {
          alert("Le fichier GPX ne contient pas assez de points.");
          return;
        }

        let distance = 0;
        let elevationGain = 0;
        const elevationThreshold = 5;

        for (let i = 1; i < points.length; i++) {
          distance += distanceBetween(points[i - 1], points[i]);
          const diff = points[i].ele - points[i - 1].ele;
          if (diff > elevationThreshold) elevationGain += diff;
        }

        setGpxStats({ distance: distance.toFixed(1), elevationGain: Math.round(elevationGain) });

        const mapElement = document.querySelector("#gpx-map") as HTMLElement | null;
        if (!mapElement) return;
        mapElement.innerHTML = "";

        const map = L.map("gpx-map", { zoomControl: true }).setView([points[0].lat, points[0].lon], 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
        }).addTo(map);

        const latLngs = points.map((p) => [p.lat, p.lon]) as [number, number][];
        const track = L.polyline(latLngs, { color: "#d4e157", weight: 5, opacity: 0.95 }).addTo(map);
        const start = latLngs[0];
        const end = latLngs[latLngs.length - 1];
        const isLoop = map.distance(start, end) < 30;

        L.circleMarker(start, {
          radius: 10,
          color: "#22c55e",
          fillColor: "#22c55e",
          fillOpacity: 1,
          weight: 3,
        }).addTo(map).bindPopup(isLoop ? "Départ / Arrivée" : "Départ");

        if (!isLoop) {
          L.circleMarker(end, {
            radius: 10,
            color: "#ef4444",
            fillColor: "#ef4444",
            fillOpacity: 1,
            weight: 3,
          }).addTo(map).bindPopup("Arrivée");
        }

        map.fitBounds(track.getBounds(), { padding: [30, 30] });
        setMapLoaded(true);
      } catch {
        alert("Erreur lecture GPX.");
      }
    }, 150);
  }

  function renderSessionCard(session: Session & { participationStatus?: ParticipationStatus }, compact = false) {
    return (
      <button
        key={session.id}
        onClick={() => {
          setSelectedSession(session);
          setActiveTab("calendar");
        }}
        className={`session-card ${compact ? "compact" : ""}`}
      >
        {session.image_url && <img className="session-thumb" src={session.image_url} alt="" />}
        <div className="session-card-content">
          <strong>{session.title}</strong>
          <span>{formatDisplayDate(session.date)} • {session.start_time} - {session.end_time}</span>
          <small>🏷️ {session.type || "Séance"}</small>
          {session.location && <small>📍 {session.location}</small>}
          {session.gpx_url && <small>🗺️ GPX disponible</small>}
          {session.participationStatus && (
            <small className="status-badge">{session.participationStatus === "present" ? "✓ Participant" : "☆ Intéressé"}</small>
          )}
        </div>
      </button>
    );
  }

  if (!profileLoaded) {
    return (
      <div className="app-screen auth-screen">
        <div className="auth-card">
          <img src="/logo-asm.png" alt="ASM Pau" className="auth-logo" />
          <h1>ASM Pau</h1>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }
if (isPasswordRecovery) {
  return (
    <div className="app-screen auth-screen">
      <div className="auth-card">
        <img src="/logo-asm.png" alt="ASM Pau" className="auth-logo" />
        <h1>Nouveau mot de passe</h1>
        <p>Choisis ton nouveau mot de passe.</p>

        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <button className="primary-btn" onClick={handleUpdatePassword}>
          Modifier le mot de passe
        </button>
      </div>
    </div>
  );
}
  if (!user) {
    return (
      <div className="app-screen auth-screen">
        <div className="auth-card">
          <img src="/logo-asm.png" alt="ASM Pau" className="auth-logo" />
          <h1>ASM Pau</h1>
          <p>Course à pied</p>

          <input placeholder="Prénom" value={firstname} onChange={(e) => setFirstname(e.target.value)} />
          <input placeholder="Nom" value={lastname} onChange={(e) => setLastname(e.target.value)} />
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              marginTop: 10,
              padding: 12,
              borderRadius: 16,
              background: "rgba(255,255,255,0.05)",
              fontSize: 13,
              textAlign: "left",
            }}
          >
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2 }}
            />
            <span>
              J’accepte que mes données soient utilisées par l’ASM Course à Pied dans le cadre du fonctionnement de l’application du club.
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPrivacyPolicy((value) => !value);
                }}
                style={{
                  display: "block",
                  marginTop: 6,
                  padding: 0,
                  border: 0,
                  background: "transparent",
                  color: "#d6e83b",
                  fontWeight: 800,
                  textDecoration: "underline",
                }}
              >
                {showPrivacyPolicy ? "Masquer la politique de confidentialité" : "Lire la politique de confidentialité"}
              </button>
            </span>
          </label>

          {showPrivacyPolicy && <PrivacyPolicyBlock />}

          <button className="primary-btn" onClick={handleLogin}>Connexion</button>
          <button className="secondary-btn" onClick={handleForgotPassword}>Mot de passe oublié ?</button>
          <button className="secondary-btn" onClick={handleSignup}>Créer un compte</button>
        </div>
      </div>
    );
  }

  if (
  user &&
  profileLoaded &&
  !isPasswordRecovery &&
  (!isApproved || !isActive) &&
  !isAdmin
) {
    return (
      <div className="app-screen auth-screen">
        <div className="auth-card">
          <img src="/logo-asm.png" alt="ASM Pau" className="auth-logo" />
          <h1>Compte en attente</h1>
          <p>
            Ton inscription a bien été enregistrée.
            <br />
            Un administrateur du club doit maintenant valider ton accès.
          </p>

          <button className="secondary-btn" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen" onClick={() => showMenu && setShowMenu(false)}>
      {showMenu && <div className="menu-backdrop" />}

      <aside className={`side-menu ${showMenu ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="side-menu-top">
          <img className="side-logo" src="/logo-asm.png" alt="ASM Pau" />
          <div>
            <p>Bienvenue</p>
            <h2>{displayName}</h2>
          </div>
        </div>

        <nav className="side-nav">
          <button className={activeTab === "calendar" ? "active" : ""} onClick={() => { setActiveTab("calendar"); setShowMenu(false); }}>📅 Calendrier</button>
          <button className={activeTab === "mySessions" ? "active" : ""} onClick={() => { setActiveTab("mySessions"); setShowMenu(false); }}>🎯 Mes zones cibles</button>
          <button className={activeTab === "chronos" ? "active" : ""} onClick={() => { setActiveTab("chronos"); setShowMenu(false); }}>🏆 Mes chronos</button>
          {isAdmin && (
            <button className={activeTab === "importPlan" ? "active" : ""} onClick={() => { setActiveTab("importPlan"); setShowMenu(false); }}>📥 Importer un plan</button>
          )}
          <button className={activeTab === "profile" ? "active" : ""} onClick={() => { setActiveTab("profile"); setShowMenu(false); }}>⚙️ Profil</button>
          <button className={activeTab === "notifications" ? "active" : ""} onClick={() => { setActiveTab("notifications"); setShowMenu(false); }}>🔔 Notifications</button>

          {isAdmin && (
            <button
              className={activeTab === "admin" ? "active" : ""}
              onClick={() => {
                setActiveTab("admin");
                setShowMenu(false);
                refreshAdminLists();
              }}
            >
              ✅ Demandes d’accès{pendingProfiles.length + deletionRequests.length > 0 ? ` (${pendingProfiles.length + deletionRequests.length})` : ""}
            </button>
          )}

          <button onClick={handleLogout}>↪ Déconnexion</button>
        </nav>

        <div className="side-club-card">
          <span>Club</span>
          <strong>ASM Pau</strong>
          <small>Version moderne</small>
        </div>
      </aside>

      <div className="app-container" onClick={(e) => e.stopPropagation()}>
        <header className="calendar-header">
          <button className="menu-btn" onClick={() => setShowMenu((current) => !current)}>☰</button>
          <button onClick={() => setCurrentDate(new Date(year, month - 1))}>◀</button>
          <div>
            <h1>{currentDate.toLocaleString("fr-FR", { month: "long" })} {year}</h1>
            <p>
              {activeTab === "calendar"
                ? "ASM Pau"
                : activeTab === "mySessions"
                ? "Mes zones cibles"
                : activeTab === "chronos"
                ? "Mes chronos"
                : activeTab === "profile"
                ? "Profil"
                : activeTab === "importPlan"
                ? "Importer un plan"
                : activeTab === "admin"
                ? "Demandes d’accès"
                : "Notifications"}
            </p>
          </div>
          <button onClick={() => setCurrentDate(new Date(year, month + 1))}>▶</button>
        </header>

        {activeTab === "calendar" && (
          <>
            <section className="calendar-card">
              <div className="calendar-grid calendar-days">
                {WEEK_DAYS.map((dayName) => <div key={dayName}>{dayName}</div>)}
              </div>

              <div className="calendar-grid">
                {Array.from({ length: mondayBasedOffset }, (_, index) => <div key={`empty-${index}`} className="calendar-empty" />)}
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1;
                  const dateKey = formatDateKey(currentDate, day);
                  const hasSession = sessionsByDate[dateKey];
                  const isSelected = selectedDate === dateKey;

                  return (
                    <motion.button
                      key={day}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        setSelectedDate(dateKey);
                        setSelectedSession(null);
                      }}
                      className={`calendar-day ${hasSession ? "has-session" : ""} ${isSelected ? "selected" : ""}`}
                    >
                      {day}
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {selectedDate && !selectedSession && (
              <section className="session-section">
                <div className="section-title-row">
                  <h2>Séances du {formatDisplayDate(selectedDate)}</h2>
                  <button className="floating-add-btn" onClick={openCreateForm}>+</button>
                </div>

                {sessionsForSelectedDate.length > 0
                  ? sessionsForSelectedDate.map((session) => renderSessionCard(session))
                  : <p className="empty-message">Aucune séance</p>}
              </section>
            )}
          </>
        )}

        {activeTab === "mySessions" && (
          <section className="performance-screen">
            <h2>Mes zones cibles</h2>

            <div className="performance-card">
              <h3>⚡ Zones d’allure</h3>

              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>% VMA</th>
                    <th>Allure</th>
                  </tr>
                </thead>
                <tbody>
                  {[70, 75, 80, 85, 90, 95, 100, 105, 110].map((percent) => (
                    <tr key={percent}>
                      <td>{percent}%</td>
                      <td>{percent}%</td>
                      <td>
                        {profileVma
                          ? formatPace(60 / (Number(profileVma) * (percent / 100)))
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


            <div className="performance-card">
              <h3>❤️ Zones cardiaques Karvonen</h3>

              <table className="performance-table compact-table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>% réserve</th>
                    <th>FC cible</th>
                  </tr>
                </thead>

                <tbody>
                  {[
                    ["🟢 Endurance", "60–70%", 0.65],
                    ["🔵 Active", "70–78%", 0.75],
                    ["🟡 Tempo", "78–85%", 0.8],
                    ["🟠 Seuil", "85–90%", 0.88],
                    ["🔴 Intense", "90–95%", 0.92],
                  ].map(([label, percentText, percent]) => {
                    const fcMax = Number(profileFcMax);
                    const fcRest = Number(profileFcRest);
                    const fc = fcMax && fcRest
                      ? Math.round((fcMax - fcRest) * Number(percent) + fcRest)
                      : null;

                    return (
                      <tr key={String(label)}>
                        <td>{label}</td>
                        <td>{percentText}</td>
                        <td>{fc ? `${fc} bpm` : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="zone-info-box">
                <p><strong>SV1</strong> ≈ 75–80% VMA • 70–78% FC réserve</p>
                <p><strong>SV2 / seuil</strong> ≈ 85–90% VMA • 85–90% FC réserve</p>
              </div>
            </div>


          </section>
        )}

        {activeTab === "chronos" && (
          <section className="performance-screen">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h2>Mes chronos</h2>
                <p className="empty-message" style={{ marginTop: 4 }}>
                  Enregistre tes résultats et visualise ta progression réelle.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowChronoForm((value) => !value)}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  border: "1px solid rgba(214,232,59,0.45)",
                  background: showChronoForm ? "#d6e83b" : "rgba(214,232,59,0.12)",
                  color: showChronoForm ? "#10140d" : "#d6e83b",
                  fontSize: 28,
                  fontWeight: 900,
                  lineHeight: 1,
                }}
                aria-label="Ajouter un chrono"
              >
                +
              </button>
            </div>

            <div className="performance-card" style={{ marginTop: 16 }}>
              <h3>📊 Mes performances théoriques</h3>
              <p>Repères de potentiel calculés avec ta VMA actuelle. Ils servent de comparaison avec tes chronos réels.</p>

              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Distance</th>
                    <th>% VMA</th>
                    <th>Temps</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>10 km</td>
                    <td>90%</td>
                    <td>{profileVma ? formatDuration((10 / (Number(profileVma) * 0.9)) * 3600) : "-"}</td>
                  </tr>
                  <tr>
                    <td>Semi</td>
                    <td>85%</td>
                    <td>{profileVma ? formatDuration((21.1 / (Number(profileVma) * 0.85)) * 3600) : "-"}</td>
                  </tr>
                  <tr>
                    <td>Marathon</td>
                    <td>80%</td>
                    <td>{profileVma ? formatDuration((42.195 / (Number(profileVma) * 0.8)) * 3600) : "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {showChronoForm && (
              <div className="performance-card" style={{ marginTop: 16 }}>
                <h3>➕ Ajouter un résultat</h3>
                <p>Renseigne ton chrono réel. L’application détecte automatiquement tes records et tes progrès.</p>

                <label>
                  Distance
                  <select value={chronoDistance} onChange={(event) => setChronoDistance(event.target.value)}>
                    <option>5 km</option>
                    <option>10 km</option>
                    <option>Semi-marathon</option>
                    <option>Marathon</option>
                    <option>Trail court</option>
                    <option>Trail long</option>
                  </select>
                </label>

                <label>
                  Course / lieu
                  <input
                    value={chronoRace}
                    onChange={(event) => setChronoRace(event.target.value)}
                    placeholder="Ex : Courir à Pau"
                  />
                </label>

                <label>
                  Chrono
                  <input
                    value={chronoTime}
                    onChange={(event) => setChronoTime(event.target.value)}
                    placeholder="Ex : 42:00 ou 1:32:15"
                  />
                </label>



                {chronoDistance.toLowerCase().includes("trail") && (
                  <label>
                    Dénivelé positif
                    <input
                      type="number"
                      min="0"
                      value={chronoElevationGain}
                      onChange={(event) => setChronoElevationGain(event.target.value)}
                      placeholder="Ex : 850"
                    />
                    <span style={{ opacity: 0.65, fontSize: 13, marginTop: 6, display: "block" }}>
                      En mètres de D+ — important pour comparer correctement les courses trail.
                    </span>
                  </label>
                )}

                <label>
                  Date
                  <input
                    type="date"
                    value={chronoDate}
                    onChange={(event) => setChronoDate(event.target.value)}
                  />
                </label>

                <button type="button" className="primary-btn" onClick={addPersonalChrono}>
                  Enregistrer mon chrono
                </button>
              </div>
            )}

            {personalChronos.length > 0 && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowChronoGraph((value) => !value)}
                style={{ width: "100%", marginTop: 16 }}
              >
                {showChronoGraph ? "📈 Masquer mon évolution ASM" : "📈 Voir mon évolution ASM"}
              </button>
            )}

            {personalChronos.length > 0 && showChronoGraph && (
              <div className="performance-card" style={{ marginTop: 16 }}>
                <h3>📈 Mon évolution depuis l’ASM</h3>
                <p>
                  Visualise tes chronos dans le temps. Plus la courbe descend, plus tu vas vite.
                </p>
                <div style={{ marginTop: 12, padding: 14, borderRadius: 16, background: "rgba(214,232,59,0.08)", border: "1px solid rgba(214,232,59,0.18)" }}>
                  <p style={{ fontWeight: 900 }}>🖤💛 Ton évolution ASM</p>
                  <p style={{ marginTop: 6, opacity: 0.86 }}>
                    Chaque chrono ajouté construit ton histoire au club. L’objectif est simple : voir concrètement le chemin parcouru depuis ton arrivée à l’ASM.
                  </p>
                </div>

                {chronoEvolutionGroups.map((group) => (
                  <div
                    key={group.distance}
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <strong>{group.distance}</strong>
                        <p style={{ opacity: 0.7, marginTop: 4 }}>
                          {formatDisplayDate(group.first.date)} → {formatDisplayDate(group.last.date)}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ color: "#ffd400" }}>{group.first.chrono} → {group.last.chrono}</strong>
                        {group.gainSeconds > 0 && group.progressPercent && (
                          <p style={{ color: "#d6e83b", fontWeight: 900, marginTop: 4 }}>
                            -{formatChronoFromSeconds(group.gainSeconds)} • +{group.progressPercent}%
                          </p>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      <span style={{ color: "#ffd400" }}>● Chronos réalisés</span>
                      {group.theoreticalPoints && <span style={{ color: "rgba(255,255,255,0.72)" }}>● Chronos théoriques VMA</span>}
                    </div>

                    <svg viewBox="0 0 300 120" width="100%" height="120" style={{ marginTop: 12, overflow: "visible" }}>
                      <line x1="12" y1="102" x2="288" y2="102" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
                      <line x1="12" y1="18" x2="12" y2="102" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />

                      {group.theoreticalPoints && (
                        <polyline
                          points={group.theoreticalPoints}
                          fill="none"
                          stroke="rgba(255,255,255,0.55)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="8 7"
                        />
                      )}

                      <polyline
                        points={group.points}
                        fill="none"
                        stroke="#ffd400"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {group.sorted.map((item, index) => {
                        const range = Math.max(group.maxSeconds - group.minSeconds, 1);
                        const x = group.sorted.length === 1 ? 12 : 12 + (index / (group.sorted.length - 1)) * 276;
                        const y = 18 + ((item.seconds - group.minSeconds) / range) * 84;
                        const theoreticalY = item.theoreticalSeconds
                          ? 18 + ((item.theoreticalSeconds - group.minSeconds) / range) * 84
                          : null;

                        return (
                          <g key={item.id}>
                            {theoreticalY !== null && <circle cx={x} cy={theoreticalY} r="4" fill="rgba(255,255,255,0.75)" />}
                            <circle cx={x} cy={y} r="5" fill="#ffd400" />
                          </g>
                        );
                      })}
                    </svg>

                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 14,
                        background: "rgba(214,232,59,0.08)",
                      }}
                    >
                      {group.gainSeconds > 0 && group.progressPercent ? (
                        <p>
                          🖤💛 Depuis que tu es à l’ASM, tu as gagné {formatChronoFromSeconds(group.gainSeconds)} sur {group.distance}. Ce n’est pas donné à tout le monde : cette progression montre que ton travail paie vraiment. Continue, tu construis quelque chose de solide.
                        </p>
                      ) : (
                        <p>
                          👏 Premier repère posé. À partir de maintenant, chaque course va te permettre de mesurer ton évolution depuis ton arrivée à l’ASM.
                        </p>
                      )}

                      {group.isBetterThanTheoretical && group.lastTheoretical?.theoreticalChrono && group.theoreticalGapSeconds && (
                        <p style={{ marginTop: 8, color: "#ffd400", fontWeight: 900 }}>
                          🏆 Ton dernier chrono est meilleur que le repère théorique VMA : {group.lastTheoretical.theoreticalChrono} théorique → {group.last.chrono} réalisé, soit {formatChronoFromSeconds(group.theoreticalGapSeconds)} de mieux.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="performance-card" style={{ marginTop: 16 }}>
              <h3>🏆 Mes records et ma progression</h3>

              {personalChronos.length === 0 ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 18,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px dashed rgba(255,255,255,0.14)",
                  }}
                >
                  <p style={{ fontWeight: 800 }}>Aucun chrono enregistré pour le moment.</p>
                  <p style={{ marginTop: 8, opacity: 0.72 }}>
                    Appuie sur le bouton + pour ajouter ton premier résultat de course.
                  </p>
                </div>
              ) : (
                personalChronos
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((chrono) => {
                    const { gainSeconds, progressPercent } = chronoProgress(chrono.chrono, chrono.previousChrono);
                    const currentChronoSeconds = parseChronoToSeconds(chrono.chrono);
                    const liveTheoretical = theoreticalChronoFromVma(chrono.distance, chrono.vmaAtEntry || profileVma);
                    const liveTheoreticalGainSeconds =
                      liveTheoretical && currentChronoSeconds && currentChronoSeconds < liveTheoretical.seconds
                        ? Math.round(liveTheoretical.seconds - currentChronoSeconds)
                        : undefined;
                    const displayedTheoreticalChrono = chrono.theoreticalChrono || liveTheoretical?.label;
                    const displayedTheoreticalGainSeconds = chrono.theoreticalGainSeconds || liveTheoreticalGainSeconds;
                    const displayedSuggestedVma = chrono.suggestedVma || (currentChronoSeconds ? estimateVmaFromChronoDistance(chrono.distance, currentChronoSeconds) || undefined : undefined);
                    const isPersonalRecord = Boolean(chrono.previousChrono && gainSeconds > 0);
                    const isTheoreticalRecord = Boolean(displayedTheoreticalGainSeconds && displayedTheoreticalGainSeconds > 0);
                    const isRecord = isPersonalRecord || isTheoreticalRecord;
                    const isSelected = selectedChronoId === chrono.id;
                    const bestForDistance = personalChronos
                      .filter((item) => item.distance === chrono.distance)
                      .map((item) => ({ ...item, seconds: parseChronoToSeconds(item.chrono) || Infinity }))
                      .sort((a, b) => a.seconds - b.seconds)[0];

                    return (
                      <div
                        key={chrono.id}
                        style={{
                          marginTop: 12,
                          background: "#111",
                          borderRadius: 18,
                          overflow: "hidden",
                          border: isSelected
                            ? "1px solid rgba(214,232,59,0.75)"
                            : isRecord
                            ? "1px solid rgba(214,232,59,0.32)"
                            : "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedChronoId((current) => current === chrono.id ? null : chrono.id)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            background: "transparent",
                            borderRadius: 0,
                            padding: 16,
                            border: "none",
                            borderBottom: isSelected ? "1px solid rgba(214,232,59,0.25)" : "none",
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div>
                              <strong style={{ fontSize: 18 }}>{chrono.distance}</strong>
                              <p style={{ opacity: 0.7, marginTop: 4 }}>{chrono.race}</p>
                              {chrono.elevationGain && (
                                <p style={{ opacity: 0.78, marginTop: 4 }}>⛰️ D+ {chrono.elevationGain} m</p>
                              )}
                              {bestForDistance?.id === chrono.id && (
                                <p style={{ marginTop: 8, color: "#d6e83b", fontWeight: 800 }}>🏅 Meilleur chrono</p>
                              )}
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <strong style={{ fontSize: 22, color: "#ffd400" }}>{chrono.chrono}</strong>
                              <p style={{ opacity: 0.7 }}>{formatDisplayDate(chrono.date)}</p>
                              <p style={{ marginTop: 8, color: "#d6e83b", fontWeight: 800, fontSize: 13 }}>
                                {isSelected ? "Détail ouvert" : "Voir le détail"}
                              </p>
                            </div>
                          </div>
                        </button>

                        {isSelected && (
                          <div
                            style={{
                              background: "rgba(255,255,255,0.025)",
                              padding: 16,
                              borderTop: "1px solid rgba(214,232,59,0.16)",
                            }}
                          >
                            {bestForDistance?.id === chrono.id && (
                              <div style={{ marginBottom: 12, color: "#d6e83b", fontWeight: 800 }}>
                                🏅 Meilleur chrono enregistré sur {chrono.distance}
                              </div>
                            )}

                            {isRecord ? (
                              <div
                                style={{
                                  padding: 14,
                                  borderRadius: 14,
                                  background: "rgba(255,212,0,0.08)",
                                }}
                              >
                                <p style={{ fontWeight: 800 }}>🏆 Bravo ! Performance validée sur {chrono.distance} !</p>
                                {isPersonalRecord && (
                                  <p style={{ marginTop: 6 }}>Tu as battu ton ancien record personnel enregistré.</p>
                                )}
                                {isTheoreticalRecord && (
                                  <p style={{ marginTop: 6, color: "#ffd400", fontWeight: 800 }}>
                                    🏆 Ton chrono est meilleur que ta performance théorique calculée avec ta VMA actuelle.
                                  </p>
                                )}
                                {chrono.elevationGain && (
                                  <p style={{ marginTop: 6, opacity: 0.82 }}>⛰️ Performance réalisée avec {chrono.elevationGain} m de D+.</p>
                                )}
                                {isPersonalRecord && (
                                  <>
                                    <p style={{ marginTop: 8 }}>Depuis ton ancienne référence ASM :</p>
                                    <p style={{ marginTop: 6 }}>{chrono.previousChrono} → {chrono.chrono}</p>
                                    <p style={{ marginTop: 6, color: "#ffd400", fontWeight: 800 }}>
                                      📈 Gain : {formatChronoFromSeconds(gainSeconds)} • +{progressPercent}%
                                    </p>
                                  </>
                                )}
                                {isTheoreticalRecord && displayedTheoreticalChrono && displayedTheoreticalGainSeconds && (
                                  <>
                                    <p style={{ marginTop: 8 }}>Comparaison avec ta performance théorique :</p>
                                    <p style={{ marginTop: 6 }}>{displayedTheoreticalChrono} théorique → {chrono.chrono} réalisé</p>
                                    <p style={{ marginTop: 6, color: "#ffd400", fontWeight: 800 }}>
                                      ⚡ Mieux que prévu de {formatChronoFromSeconds(displayedTheoreticalGainSeconds)}
                                    </p>
                                  </>
                                )}

                                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                  {chronoMotivationMessages({
                                    isPersonalRecord,
                                    isTheoreticalRecord,
                                    hasElevation: Boolean(chrono.elevationGain),
                                    chronosCount: personalChronos.length,
                                    progressPercent,
                                    vmaUpdated: Boolean(chrono.vmaUpdated),
                                  }).map((message) => (
                                    <div key={message}>{message}</div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{
                                  padding: 12,
                                  borderRadius: 12,
                                  background: "rgba(255,255,255,0.04)",
                                  opacity: 0.9,
                                }}
                              >
                                👏 Résultat enregistré. Chaque chrono construit ton historique de progression.
                              </div>
                            )}

                            {profileVma && isRecord && (
                              <div
                                style={{
                                  marginTop: 14,
                                  padding: 12,
                                  borderRadius: 12,
                                  background: "rgba(255,255,255,0.05)",
                                }}
                              >
                                <p style={{ fontWeight: 800 }}>🧠 Analyse ASM</p>
                                <p style={{ marginTop: 8 }}>
                                  Ce chrono donne un nouveau repère pour ajuster tes allures d’entraînement. Si tu valides cette estimation, ta VMA sera mise à jour dans ton profil.
                                </p>
                                {displayedSuggestedVma ? (
                                  <>
                                    <p style={{ marginTop: 8, color: "#ffd400", fontWeight: 800 }}>
                                      ⚡ VMA actuelle : {chrono.vmaAtEntry || profileVma} km/h • VMA estimée avec ce chrono : {displayedSuggestedVma} km/h
                                    </p>
                                    {chrono.vmaUpdated ? (
                                      <p style={{ marginTop: 10, color: "#d6e83b", fontWeight: 900 }}>
                                        ✅ VMA mise à jour dans ton profil.
                                      </p>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => applySuggestedVmaFromChrono(displayedSuggestedVma, chrono.id)}
                                        className="secondary-btn"
                                        style={{ marginTop: 10 }}
                                      >
                                        ✅ Mettre ma VMA à jour à {displayedSuggestedVma} km/h
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <p style={{ marginTop: 8, color: "#ffd400" }}>
                                    ⚡ Pense à réévaluer ta VMA ou à en parler à un entraîneur pour garder des allures adaptées.
                                  </p>
                                )}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => deletePersonalChrono(chrono.id)}
                              style={{
                                marginTop: 12,
                                border: "1px solid rgba(255,80,80,0.25)",
                                background: "rgba(255,80,80,0.08)",
                                color: "rgba(255,255,255,0.78)",
                                borderRadius: 12,
                                padding: "10px 12px",
                                width: "100%",
                                fontWeight: 800,
                              }}
                            >
                              🗑️ Supprimer ce chrono
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })              )}
            </div>
          </section>
        )}


        {activeTab === "importPlan" && isAdmin && (
          <section className="admin-screen">
            <h2>📥 Importer un plan d’entraînement</h2>
            <p className="empty-message">
              Colle le contenu du tableau ou importe un fichier CSV/TXT exporté depuis Excel. L’application analyse chaque séance indépendamment : le sport du plan sert seulement de valeur par défaut, puis tu valides avant création dans le calendrier.
            </p>

            <div className="performance-card">
              <h3>1. Paramètres du plan</h3>
              <div className="form-grid">
                <label>
                  Sport du plan / valeur par défaut
                  <select value={importPlanSport} onChange={(event) => setImportPlanSport(event.target.value)}>
                    {SESSION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label>
                  Année du plan
                  <input value={importPlanYear} onChange={(event) => setImportPlanYear(event.target.value)} placeholder="2026" />
                </label>
              </div>

              <label>
                Fichier CSV/TXT exporté depuis Excel
                <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" onChange={(event) => handlePlanFileChange(event.target.files?.[0])} />
              </label>

              <label>
                Contenu du plan
                <textarea
                  value={importPlanText}
                  onChange={(event) => setImportPlanText(event.target.value)}
                  placeholder={"Exemple :\nDU 06/04 AU 12/04\nMardi : Côtes : 30' échauffement + 2x7x30'' VMA r=descente + 10' RC\nJeudi : Footing 40 à 60' très facile\nSamedi : Sortie trail 2h 75% FC"}
                  rows={10}
                />
              </label>

              <button className="primary-btn" onClick={analyseImportedPlan}>Analyser le plan</button>
            </div>

            <div className="performance-card">
              <h3>📚 Dictionnaire ASM utilisé</h3>
              <p className="empty-message">
                Ces mots sont reconnus pour rendre les objectifs plus cohérents : EF, RC, SV1, SV2, Seuil, Tempo, VMA, Fartlek, Côtes, Descente active, Descente rapide, JERK, Préfatigue, Déblocage, Très facile, Actif.
              </p>
              <div className="admin-list">
                {ASM_TRAINING_DICTIONARY.map((entry) => (
                  <div key={entry.keyword} className="admin-card">
                    <div>
                      <strong>{entry.keyword} — {entry.label}</strong>
                      <p>{entry.explanation}</p>
                      {entry.intensity && <p>Repère : {entry.intensity}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {importedSessions.length > 0 && (
              <div className="performance-card">
                <h3>2. Validation avant import</h3>
                <p className="empty-message">
                  Vérifie le sport, la date, le titre et le lieu. Le sport est détecté séance par séance. Les fractions courtes de 100 m à 1000 m sont placées automatiquement au Stade André-Lavie, les autres restent “À votre convenance”.
                </p>

                <div className="admin-list">
                  {importedSessions.map((session) => (
                    <div key={session.id} className="admin-card" style={{ alignItems: "stretch" }}>
                      <div style={{ width: "100%" }}>
                        <div className="form-grid">
                          <label>
                            Date
                            <input value={session.date} onChange={(event) => updateImportedSession(session.id, { date: event.target.value })} />
                          </label>
                          <label>
                            Sport
                            <select value={session.type} onChange={(event) => updateImportedSession(session.id, { type: event.target.value, confidence: "manual" })}>
                              {SESSION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                            </select>
                          </label>
                          <label>
                            Heure
                            <input value={session.start_time} onChange={(event) => updateImportedSession(session.id, { start_time: event.target.value })} />
                          </label>
                          <label>
                            Lieu
                            <input value={session.location} onChange={(event) => updateImportedSession(session.id, { location: event.target.value })} />
                          </label>
                        </div>

                        <label>
                          Titre
                          <input value={session.title} onChange={(event) => updateImportedSession(session.id, { title: event.target.value })} />
                        </label>

                        <label>
                          Séance
                          <textarea value={session.description} onChange={(event) => updateImportedSession(session.id, { description: event.target.value, notes: dictionaryNotesForSession(event.target.value) })} rows={3} />
                        </label>

                        {session.notes.length > 0 && (
                          <div className="chrono-analysis-card">
                            {session.notes.slice(0, 4).map((note) => <p key={note}>🎯 {note}</p>)}
                          </div>
                        )}
                      </div>

                      <button className="danger-btn" onClick={() => removeImportedSession(session.id)}>Supprimer cette ligne</button>
                    </div>
                  ))}
                </div>

                <button className="primary-btn" onClick={createImportedSessions} disabled={importingPlan}>
                  {importingPlan ? "Import en cours..." : `Créer ${importedSessions.length} séance(s) dans le calendrier`}
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === "admin" && isAdmin && (
          <section className="admin-screen">
            <h2>Demandes d’accès</h2>
            <button className="admin-choice-btn selected" onClick={() => setActiveTab("importPlan")} style={{ marginBottom: 16 }}>
              📥 Importer un plan d’entraînement
            </button>

            {pendingProfiles.length === 0 ? (
              <p className="empty-message">Aucune demande en attente</p>
            ) : (
              <div className="admin-list">
                {pendingProfiles.map((profile) => (
                  <div key={profile.id} className="admin-card">
                    <div>
                      <strong>{profile.firstname} {profile.lastname}</strong>
                      <p>{profile.email || profile.pseudo || "Nouvel adhérent"}</p>
                    </div>

                    <div className="admin-actions">
                      <button
                        className={`admin-choice-btn ${approvingProfileId === profile.id ? "selected" : ""}`}
                        onClick={() => approveProfile(profile.id)}
                      >
                        Approuver
                      </button>

                      <button
                        className={`admin-choice-btn ${approvingAdminProfileId === profile.id ? "selected" : ""}`}
                        onClick={() => approveAdminProfile(profile.id)}
                      >
                        Nommer admin
                      </button>

                      <button
                        className="danger-btn"
                        onClick={() => deactivateProfile(profile.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

           <h2 className="admin-section-title">
  Demandes de suppression de compte
</h2>

            {deletionRequests.length === 0 ? (
              <p className="empty-message">Aucune demande de suppression en attente</p>
            ) : (
              <div className="admin-list">
                {deletionRequests.map((request) => (
                  <div key={request.id} className="admin-card">
                    <div>
                      <strong>{request.firstname || ""} {request.lastname || ""}</strong>
                      <p>
                        {request.email || "Compte sans email"}
                        {request.created_at ? ` • demandé le ${new Date(request.created_at).toLocaleDateString("fr-FR")}` : ""}
                      </p>
                    </div>

                    <div className="admin-actions">
                      <button
                        className="danger-btn"
                        onClick={() => markDeletionRequestProcessed(request.id)}
                      >
                        Marquer traité
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

           <h2 className="admin-section-title">
  Membres admis
</h2>

<p className="empty-message">
  Admins : {approvedProfiles.filter((profile) => profile.is_admin).length}
</p>

            {approvedProfiles.length === 0 ? (
              <p className="empty-message">Aucun membre admis</p>
            ) : (
              <div className="admin-list">
                {approvedProfiles.map((profile) => (
                  <div key={profile.id} className="admin-card">
                    <div>
                      <strong>{profile.firstname} {profile.lastname}</strong>
                      <p>
                        {profile.email || profile.pseudo || "Membre"}
                        {profile.is_admin ? " • Admin" : ""}
                      </p>
                    </div>

                    <div className="admin-actions">
                      {profile.is_admin ? (
  <button
    className="secondary-btn"
    onClick={() => toggleAdminProfile(profile.id, false)}
  >
    Retirer admin
  </button>
) : (
  <button
    className="admin-choice-btn"
    onClick={() => toggleAdminProfile(profile.id, true)}
  >
    Nommer admin
  </button>
)}

<button
  className={`danger-btn ${deactivatingProfileId === profile.id ? "selected" : ""}`}
  onClick={() => deactivateProfile(profile.id)}
>
  Retirer l’accès
</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "notifications" && (
          <section className="panel-screen">
            <h2>Notifications</h2>
            <div className="profile-card">
              <div className="notification-settings-row">
                <div>
                  <strong>Notifications de l’application</strong>
                  <p>Préférence globale. Les vraies notifications push seront finalisées avec la PWA.</p>
                </div>
                <button className={`notification-toggle ${notificationsEnabled ? "enabled" : ""}`} onClick={toggleNotifications}>
                  <span />
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === "profile" && (
          <section className="profile-screen">
            <h2>Profil</h2>
            <div className="profile-card">
              <div className="form-row">
                <label>Pseudo</label>
                <input value={`${firstname} ${lastname.charAt(0).toUpperCase()}.`} disabled />
              </div>

              <div className="form-row">
                <label>Sexe</label>
                <select value={profileSexe} onChange={(e) => setProfileSexe(e.target.value)}>
                  <option value="">Non renseigné</option>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                </select>
              </div>

              <div className="form-row">
                <label>VMA actuelle</label>
                <input type="number" step="0.1" value={profileVma} onChange={(e) => setProfileVma(e.target.value)} placeholder="Ex : 15" />
              </div>

              <div className="form-row">
                <label>FC max</label>
                <input type="number" value={profileFcMax} onChange={(e) => setProfileFcMax(e.target.value)} placeholder="Ex : 190" />
              </div>

              <div className="form-row">
                <label>FC au repos</label>
                <input
                  type="number"
                  value={profileFcRest}
                  onChange={(e) => setProfileFcRest(e.target.value)}
                  placeholder="Ex : 48"
                />
              </div>

              <div className="personal-goal-card">
                <h3>Estimer ma VMA</h3>
                <p>Renseigne une course récente pour obtenir une estimation.</p>
                <div className="form-row">
                  <label>Distance</label>
                  <input type="number" placeholder="Ex : 10" value={raceDistance} onChange={(e) => setRaceDistance(e.target.value)} />
                </div>
                <div className="form-row">
                  <label>Temps en minutes</label>
                  <input type="number" placeholder="Ex : 45" value={raceTime} onChange={(e) => setRaceTime(e.target.value)} />
                </div>
                <button
                  className="secondary-btn"
                  onClick={() => {
                    if (!raceDistance || !raceTime) return;
                    setProfileVma(estimateVmaFromRace(Number(raceDistance), Number(raceTime)));
                  }}
                >
                  Calculer la VMA
                </button>
              </div>

              <div className="personal-goal-card">
                <h3>Confidentialité</h3>
                <p>
                  Données utilisées uniquement pour le fonctionnement interne du club.
                  {privacyAcceptedAt ? ` Accepté le ${new Date(privacyAcceptedAt).toLocaleDateString("fr-FR")}.` : ""}
                </p>
                <label
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => {
                      setPrivacyAccepted(e.target.checked);
                      setPrivacyAcceptedAt(e.target.checked ? new Date().toISOString() : null);
                    }}
                    style={{ width: 18, height: 18, marginTop: 2 }}
                  />
                  <span>J’ai lu et j’accepte la politique de confidentialité de l’application ASM Course à Pied.</span>
                </label>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowPrivacyPolicy((value) => !value)}
                  style={{ marginTop: 12 }}
                >
                  {showPrivacyPolicy ? "Masquer la politique" : "Lire la politique de confidentialité"}
                </button>
                {showPrivacyPolicy && <PrivacyPolicyBlock />}
              </div>

              <div className="personal-goal-card">
                <h3>Suppression du compte</h3>
                <p>
                  Tu peux demander la suppression de ton compte et des données associées.
                  Un administrateur du club traitera la demande.
                </p>
                {deletionRequestSent ? (
                  <p className="empty-message">Demande de suppression envoyée. Elle est en attente de traitement.</p>
                ) : (
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={requestAccountDeletion}
                    disabled={sendingDeletionRequest}
                  >
                    {sendingDeletionRequest ? "Envoi en cours..." : "Demander la suppression de mon compte"}
                  </button>
                )}
              </div>

              <button className="primary-btn" onClick={saveMyProfile}>Enregistrer le profil</button>
            </div>
          </section>
        )}

        {showCreateForm && (
          <div className="create-modal">
            <div className="create-header">
              <button onClick={() => setShowCreateForm(false)}>←</button>
              <h2>{isEditing ? "Modifier la séance" : "Ajouter une séance"}</h2>
            </div>

            <div className="create-card">
              <div className="form-row">
                <label>Titre</label>
                <input placeholder={'Ex : 8 x 400 m à 95% VMA ou 10 x 30"/30" à VMA'} value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              </div>

              <div className="form-row">
                <label>Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)}>
                  {SESSION_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label>Lieu</label>
                <input placeholder="Ville ou point de rendez-vous" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
              </div>

              <div className="form-row description-row">
                <label>Description</label>
                <textarea placeholder="Description, consignes, lien éventuel..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
              </div>

              <div className="form-row">
                <label>Début</label>
                <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
              </div>

              <div className="form-row">
                <label>Fin</label>
                <input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
              </div>

              <div className="form-row file-row">
                <label>Image</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>

              <div className="form-row file-row">
                <label>Fichier GPX</label>
                <input type="file" accept=".gpx" onChange={(e) => setGpxFile(e.target.files?.[0] || null)} />
              </div>

              <button className="primary-btn" onClick={handleSaveSession}>{isEditing ? "Modifier la séance" : "Créer la séance"}</button>
              <button className="close-floating-btn" onClick={() => setShowCreateForm(false)}>×</button>
            </div>
          </div>
        )}

        {selectedSession && (
          <div className="session-detail">
            <div className="detail-container">
              <button className="back-btn" onClick={() => setSelectedSession(null)}>⬅ Retour</button>

              <h2>{selectedSession.title}</h2>
              <p className="detail-date">{formatDisplayDate(selectedSession.date)} • {selectedSession.start_time} - {selectedSession.end_time}</p>

              {selectedSession.image_url && <img src={selectedSession.image_url} alt={selectedSession.title} />}

              <div className="detail-box">
                <p>🏷️ {selectedSession.type || "Type non renseigné"}</p>
                <p>📍 {selectedSession.location || "Lieu non renseigné"}</p>
                <p className="session-description">{selectedSession.description || "Aucune description"}</p>

                {selectedSession.gpx_url && (
                  <div className="gpx-actions">
                    <button className="primary-btn" onClick={openGpxMap}>Voir la carte GPX</button>
                    <a className="gpx-link" href={selectedSession.gpx_url} target="_blank" rel="noreferrer" download>Télécharger le GPX</a>
                  </div>
                )}
              </div>

              <div className="participation-grid">
                <div className="participation-column">
                  <button
                    className={`participant-count ${
                      myParticipation === "interested" ? "active-choice" : ""
                    }`}
                    onClick={() => handleParticipation("interested")}
                  >
                    <strong>{interestedParticipants.length}</strong>
                    <span>Intéressés</span>
                  </button>

                  <button
                    className="secondary-btn small-btn"
                    onClick={() => setShowParticipantList("interested")}
                  >
                    Voir les intéressés
                  </button>
                </div>

                <div className="participation-column">
                  <button
                    className={`participant-count ${
                      myParticipation === "present" ? "active-choice" : ""
                    }`}
                    onClick={() => handleParticipation("present")}
                  >
                    <strong>{presentParticipants.length}</strong>
                    <span>Participants</span>
                  </button>

                  <button
                    className="secondary-btn small-btn"
                    onClick={() => setShowParticipantList("present")}
                  >
                    Voir les participants
                  </button>
                </div>
              </div>

              {personalGoals.length > 0 && (
                <div className="personal-goals-wrapper">
                  {personalGoals.map((personalGoal, goalIndex) => (
                    <div
                      key={`${personalGoal.type}-${goalIndex}`}
                      className={`personal-goal-card ${
                        selectedGoalIndex === goalIndex ? "selected-goal" : ""
                      }`}
                    >
                      <h3>🎯 Objectif {goalIndex + 1}</h3>

                      {personalGoal.type === "vma" && (
                        <>
                          {personalGoal.isTimeBased ? (
                            <>
                              <p>
                                Séance : {personalGoal.repetitions || ""} × {formatDuration(personalGoal.timeSeconds)}
                                {personalGoal.recoverySeconds
                                  ? ` / ${formatDuration(personalGoal.recoverySeconds)} récup.`
                                  : ""}
                              </p>
                              <p>Objectif : tenir l’allure correspondant à ta VMA sur chaque fraction rapide.</p>
                              <p>VMA utilisée : {personalGoal.vma} km/h</p>
                              <p className="goal-highlight">Allure cible : {formatPace(personalGoal.pace)}</p>
                              <p className="goal-muted">Repère indicatif : environ {personalGoal.distance} m sur {formatDuration(personalGoal.timeSeconds)}.</p>
                            </>
                          ) : (
                            <>
                              <p>
                                Séance :{" "}
                                {personalGoal.repetitions
                                  ? `${personalGoal.repetitions} × `
                                  : ""}
                                {personalGoal.distance} m
                              </p>
                              <p>VMA utilisée : {personalGoal.vma} km/h</p>
                              <p>Intensité : {personalGoal.percent}% VMA</p>
                              <p>Allure cible : {formatPace(personalGoal.pace)}</p>
                              <p>
                                Temps cible : {formatDuration(personalGoal.timeSeconds)} par
                                fraction
                              </p>
                            </>
                          )}
                        </>
                      )}

                      {personalGoal.type === "fc" && (
                        <>
                          <p>FC max utilisée : {personalGoal.fcMax} bpm</p>
                          <p>Intensité : {personalGoal.percent}% FC max</p>
                          <p>Fréquence cible : {personalGoal.targetFc} bpm</p>
                        </>
                      )}

                      {(personalGoal.type === "seuil" ||
                        personalGoal.type === "10km") && (
                        <>
                          {personalGoal.distance && (
                            <p>Distance : {personalGoal.distance} m</p>
                          )}

                          {personalGoal.durationMin && (
                            <>
                              <p>
                                Séance : {personalGoal.repetitions ? `${personalGoal.repetitions} × ` : ""}
                                {personalGoal.durationMin}'
                                {personalGoal.type === "seuil" ? " au seuil" : ""}
                              </p>
                              {personalGoal.repetitions && personalGoal.repetitions > 1 && (
                                <p>Répétitions : {personalGoal.repetitions} fractions de {personalGoal.durationMin}'</p>
                              )}
                            </>
                          )}

                          <p>
                            Terrain :{" "}
                            {personalGoal.surface === "trail"
                              ? "Trail / côte"
                              : "Route"}
                          </p>

                          {personalGoal.type === "seuil" &&
                          personalGoal.surface === "trail" ? (
                            <>
                              <p>
                                Objectif : effort seuil contrôlé en côte, sans
                                chercher l’allure route.
                              </p>

                              <p>{formatFcRangeLabel(profileFcMax, 85, 90, "seuil")}</p>

                              <p>
                                Repère sensation : effort difficile mais maîtrisé,
                                proche SV2, à adapter à la pente et au terrain.
                              </p>
                            </>
                          ) : (
                            <>
                              <p>VMA utilisée : {personalGoal.vma} km/h</p>
                              <p>Intensité : {personalGoal.percent}% VMA</p>
                              <p>Allure cible : {formatPace(personalGoal.pace)}</p>

                              {personalGoal.timeSeconds && (
                                <p>
                                  Temps cible : {formatDuration(personalGoal.timeSeconds)} par fraction
                                </p>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {personalGoal.type === "effort" && (
                        <>
                          <p>Séance : {personalGoal.title}</p>
                          <p>{personalGoal.detail}</p>
                          {personalGoal.fcLabel && <p>{personalGoal.fcLabel}</p>}
                        </>
                      )}

                      {personalGoal.type === "allure" && (
                        <p>Allure cible : {formatPace(personalGoal.pace)}</p>
                      )}

                      {personalGoals.length > 1 && (
                        <button
                          className={
                            selectedGoalIndex === goalIndex
                              ? "goal-selected-btn"
                              : "goal-unselected-btn"
                          }
                          onClick={() => setSelectedGoalIndex(goalIndex)}
                        >
                          {selectedGoalIndex === goalIndex
                            ? "Objectif sélectionné"
                            : "Choisir cet objectif"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="floating-admin-menu">
                {showAdminActions && (
                  <div className="floating-admin-actions">
                    {isAdmin && (
                      <button onClick={handleDuplicateSession} title="Dupliquer">
                        📋
                      </button>
                    )}

                    {canEditSelectedSession && (
                      <>
                        <button onClick={openEditForm} title="Modifier">
                          ✏️
                        </button>
                        <button onClick={handleDeleteSession} title="Supprimer">
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                )}

                <button
                  className={`floating-admin-main ${
                    showAdminActions ? "open" : ""
                  }`}
                  onClick={() => setShowAdminActions((current) => !current)}
                >
                  {showAdminActions ? "×" : "‹"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showParticipantList && (
          <div className="participant-modal">
            <div className="participant-modal-card">
              <div className="participant-list-header">
                <h3>
                  {showParticipantList === "present"
                    ? "Participants"
                    : "Intéressés"}
                </h3>
                <button onClick={() => setShowParticipantList(null)}>×</button>
              </div>

              {displayedParticipantList.length > 0 ? (
                displayedParticipantList.map((participant) => (
                  <div key={participant.id} className="participant-row">
                    {participant.firstname} {participant.lastname}
                  </div>
                ))
              ) : (
                <p className="empty-message">Aucun adhérent</p>
              )}
            </div>
          </div>
        )}

        {showGpxMap && (
          <div className="gpx-map-modal">
            <div className="gpx-map-header">
              <button
                onClick={() => {
                  setShowGpxMap(false);
                  setMapLoaded(false);
                  setGpxStats(null);
                }}
              >
                ←
              </button>
              <h2>Parcours</h2>
            </div>

            <div id="gpx-map"></div>

            {gpxStats && (
              <div className="gpx-stats-panel">
                <div>
                  <strong>{gpxStats.distance} km</strong>
                  <span>Distance</span>
                </div>
                <div>
                  <strong>+{gpxStats.elevationGain} m</strong>
                  <span>Dénivelé +</span>
                </div>
              </div>
            )}

            {!mapLoaded && (
              <p className="map-loading">Chargement du parcours...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
