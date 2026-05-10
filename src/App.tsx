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

type AppTab = "calendar" | "mySessions" | "chronos" | "profile" | "notifications" | "admin";
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
};


type PersonalChrono = {
  id: string;
  distance: string;
  race: string;
  chrono: string;
  previousChrono?: string;
  date: string;
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

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  const paddedMinutes = minutes.toString().padStart(2, "0");
  const paddedSeconds = secs.toString().padStart(2, "0");

  if (hours > 0) return `${hours}h${paddedMinutes}'${paddedSeconds}`;
  return `${minutes}'${paddedSeconds}`;
};

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
  const km10Match = text.match(/(\d+)\s*[x×]\s*(\d+)\s*(m|km)?\s*.*?(allure\s*)?(10\s?km)/);
  const allureMatch = text.match(/allure\s*(\d+)'(\d{1,2})"?/);
  const seuilIntervalMatch = text.match(/(\d+)\s*[x×]\s*(\d+)\s*["”]?\s*\/\s*(\d+)\s*["”]?\s*.*?seuil/);

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
    const workSeconds = Number(seuilIntervalMatch[2]);

    return {
      type: "effort",
      title: `${repetitions} × ${workSeconds}"/${seuilIntervalMatch[3]}" au seuil`,
      detail: isTrailSession
        ? "Travail au seuil en terrain variable : privilégier l’effort et la respiration, sans chercher une allure fixe."
        : "Travail au seuil court : rester contrôlé, régulier, sans partir trop vite.",
      fcLabel: isTrailSession ? "Repère : zone SV2 / environ 85–90% FC max" : "Repère : environ 85–90% VMA ou zone SV2",
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
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

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
        fcLabel: isTrailOrHill ? "Repère : environ 85–90% FC max" : "Repère : environ 85–90% VMA ou zone SV2",
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
  const [approvingProfileId, setApprovingProfileId] = useState<string | null>(null);
  const [approvingAdminProfileId, setApprovingAdminProfileId] = useState<string | null>(null);
  const [deactivatingProfileId, setDeactivatingProfileId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");

  const [profileSexe, setProfileSexe] = useState("");
  const [profileVma, setProfileVma] = useState("");
  const [profileFcMax, setProfileFcMax] = useState("");
  const [profileFcRest, setProfileFcRest] = useState("");
  const [personalChronos, setPersonalChronos] = useState<PersonalChrono[]>([
    {
      id: "1",
      distance: "10 km",
      race: "Courir à Pau",
      chrono: "42:00",
      previousChrono: "47:00",
      date: "2026-04-10",
    },
  ]);


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

  const userEmail = user.email || "";

  let { data, error } = await supabase
    .from("profiles")
    .select("id, firstname, lastname, pseudo, sexe, vma, fc_max, fc_rest, is_admin, approved, active, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!data && userEmail) {
    const result = await supabase
      .from("profiles")
      .select("id, firstname, lastname, pseudo, sexe, vma, fc_max, fc_rest, is_admin, approved, active, email")
      .ilike("email", userEmail)
      .maybeSingle();

    data = result.data;
    error = result.error;
  }

  if (!data && userEmail.toLowerCase() === "foucatdidier@gmail.com") {
    const { data: insertedProfile, error: insertError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        firstname: "Didier",
        lastname: "Foucat",
        pseudo: "Didier F.",
        email: userEmail,
        approved: true,
        active: true,
        is_admin: true,
      })
      .select("id, firstname, lastname, pseudo, sexe, vma, fc_max, fc_rest, is_admin, approved, active, email")
      .single();

    data = insertedProfile;
    error = insertError;
  }

  if (error || !data) {
    alert("Profil introuvable pour : " + userEmail + " / " + (error?.message || "aucune donnée"));
    setIsAdmin(false);
    setIsApproved(false);
    setIsActive(false);
    setProfileLoaded(true);
    return;
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

  if (data.is_admin === true) {
    await fetchPendingProfiles();
    await fetchApprovedProfiles();
  }

  setProfileLoaded(true);
}
  async function fetchPendingProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, firstname, lastname, pseudo, email, is_admin, approved, active")
      .eq("approved", false)
      .eq("active", true)
      .order("firstname", { ascending: true });

    if (error) {
      alert("Erreur chargement demandes : " + error.message);
      return;
    }

    setPendingProfiles((data || []) as MemberProfile[]);
  }

  async function fetchApprovedProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, firstname, lastname, pseudo, email, is_admin, approved, active")
      .eq("approved", true)
      .eq("active", true)
      .order("firstname", { ascending: true });

    if (error) {
      alert("Erreur chargement membres : " + error.message);
      return;
    }

    setApprovedProfiles((data || []) as MemberProfile[]);
  }

  async function refreshAdminLists() {
    await fetchPendingProfiles();
    await fetchApprovedProfiles();
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
      })
      .eq("id", user.id);

    if (error) {
      alert("Erreur sauvegarde profil : " + error.message);
      return;
    }

    alert("Profil enregistré");
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

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      alert("Erreur inscription : " + error.message);
      return;
    }

    const newUser = data.user;
    if (!newUser) return;

    const pseudo = `${firstname} ${lastname.charAt(0).toUpperCase()}.`;

    await supabase.from("profiles").insert({
      id: newUser.id,
      firstname,
      lastname,
      pseudo,
      email,
      is_admin: false,
      approved: false,
      active: true,
    });

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
          <button className={activeTab === "mySessions" ? "active" : ""} onClick={() => { setActiveTab("mySessions"); setShowMenu(false); }}>👤 Mes performances</button>
          <button className={activeTab === "chronos" ? "active" : ""} onClick={() => { setActiveTab("chronos"); setShowMenu(false); }}>🏆 Mes chronos</button>
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
              ✅ Demandes d’accès{pendingProfiles.length > 0 ? ` (${pendingProfiles.length})` : ""}
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
                ? "Mes performances"
                : activeTab === "chronos"
                ? "Mes chronos"
                : activeTab === "profile"
                ? "Profil"
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
            <h2>Mes performances</h2>

            <div className="performance-card">
              <h3>🏆 Performances théoriques</h3>
              <p>Estimations basées sur ta VMA.</p>

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
            <h2>Mes chronos</h2>
<div className="performance-card">
              <h3>📊 Mes chronos</h3>
              <p>Visualise ta progression et tes records personnels.</p>

              {personalChronos.map((chrono) => {
                const currentSeconds =
                  Number(chrono.chrono.split(":")[0]) * 60 +
                  Number(chrono.chrono.split(":")[1]);

                const previousSeconds = chrono.previousChrono
                  ? Number(chrono.previousChrono.split(":")[0]) * 60 +
                    Number(chrono.previousChrono.split(":")[1])
                  : null;

                const gain = previousSeconds
                  ? previousSeconds - currentSeconds
                  : 0;

                const progressPercent =
                  previousSeconds && gain > 0
                    ? ((gain / previousSeconds) * 100).toFixed(1)
                    : null;

                return (
                  <div
                    key={chrono.id}
                    style={{
                      background: "#111",
                      borderRadius: 18,
                      padding: 16,
                      marginTop: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ fontSize: 18 }}>{chrono.distance}</strong>
                        <p style={{ opacity: 0.7, marginTop: 4 }}>{chrono.race}</p>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <strong style={{ fontSize: 22, color: "#ffd400" }}>
                          {chrono.chrono}
                        </strong>
                        <p style={{ opacity: 0.7 }}>{formatDisplayDate(chrono.date)}</p>
                      </div>
                    </div>

                    {chrono.previousChrono && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: 14,
                          borderRadius: 14,
                          background: "rgba(255,212,0,0.08)",
                        }}
                      >
                        <p style={{ fontWeight: 700 }}>
                          🏆 Bravo ! Tu progresses !
                        </p>

                        <p style={{ marginTop: 8 }}>
                          Depuis ton arrivée à l’ASM :
                        </p>

                        <p style={{ marginTop: 6 }}>
                          {chrono.previousChrono} → {chrono.chrono}
                        </p>

                        <p style={{ marginTop: 6, color: "#ffd400", fontWeight: 700 }}>
                          📈 Gain : {Math.floor(gain / 60)}’{pad(gain % 60)} • +{progressPercent}%
                        </p>

                        <div
                          style={{
                            marginTop: 14,
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          <div>🔥 Ton travail commence vraiment à payer.</div>
                          <div>🚀 Tes performances montrent un vrai cap franchi.</div>
                          <div>💪 Continue comme ça, tu es sur une très belle dynamique.</div>
                        </div>
                      </div>
                    )}

                    {profileVma && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: 12,
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.05)",
                        }}
                      >
                        <p style={{ fontWeight: 700 }}>
                          🧠 Analyse ASM
                        </p>

                        <p style={{ marginTop: 8 }}>
                          Tes dernières performances semblent supérieures aux estimations de ta VMA actuelle.
                        </p>

                        <p style={{ marginTop: 8, color: "#ffd400" }}>
                          ⚡ Pense à réévaluer ta VMA afin d’ajuster encore plus précisément tes allures d’entraînement.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "admin" && isAdmin && (
          <section className="admin-screen">
            <h2>Demandes d’accès</h2>

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
                <input placeholder="Ex : 8 x 400 m à 95% VMA" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
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
                            <p>Durée : {personalGoal.durationMin}'</p>
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

                              {profileFcMax ? (
                                <p>
                                  Repère cardio : environ{" "}
                                  {Math.round(Number(profileFcMax) * 0.85)} à{" "}
                                  {Math.round(Number(profileFcMax) * 0.9)} bpm
                                  {" "}({`85–90% FC max`})
                                </p>
                              ) : (
                                <p>Repère cardio : environ 85–90% FC max</p>
                              )}

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
                                  Temps cible :{" "}
                                  {formatDuration(personalGoal.timeSeconds)}
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
