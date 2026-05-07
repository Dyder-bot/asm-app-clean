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

type AppTab = "calendar" | "mySessions" | "profile" | "notifications";
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

type MyParticipation = {
  session_id: string;
  status: ParticipationStatus;
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

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}'${pad(remainingSeconds)}`;
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

  if (vmaMatch && vma > 0) {
    const repetitions = Number(vmaMatch[1]);
    const distance = vmaMatch[3] === "km" ? Number(vmaMatch[2]) * 1000 : Number(vmaMatch[2]);
    const percent = Number(vmaMatch[4]);
    const speed = (vma * percent) / 100;
    const pace = 60 / speed;
    const timeSeconds = (distance / 1000) * pace * 60;
    return { type: "vma", repetitions, distance, percent, vma, pace, timeSeconds };
  }

  if (fcMatch && fcMax > 0) {
    const percent = Number(fcMatch[1]);
    return { type: "fc", percent, fcMax, targetFc: Math.round((fcMax * percent) / 100) };
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

  if (allureMatch) {
    const minutes = Number(allureMatch[1]);
    const seconds = Number(allureMatch[2]);
    return { type: "allure", pace: minutes + seconds / 60 };
  }

  return null;
}

export default function CalendarApp() {
  const [activeTab, setActiveTab] = useState<AppTab>("calendar");
  const [showMenu, setShowMenu] = useState(false);
  const [showAdminActions, setShowAdminActions] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");

  const [profileSexe, setProfileSexe] = useState("");
  const [profileVma, setProfileVma] = useState("");
  const [profileFcMax, setProfileFcMax] = useState("");
  const [raceDistance, setRaceDistance] = useState("");
  const [raceTime, setRaceTime] = useState("");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [myParticipations, setMyParticipations] = useState<MyParticipation[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showParticipantList, setShowParticipantList] = useState<ParticipationStatus | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return window.localStorage.getItem("asm-notifications") === "true";
  });

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

  const mySessions = useMemo(() => {
    const bySessionId = new Map(myParticipations.map((row) => [row.session_id, row.status]));

    return sessions
      .filter((session) => bySessionId.has(session.id))
      .map((session) => ({ ...session, participationStatus: bySessionId.get(session.id) }))
      .sort((a, b) => `${a.date} ${a.start_time || ""}`.localeCompare(`${b.date} ${b.start_time || ""}`));
  }, [myParticipations, sessions]);

  const displayedParticipantList =
    showParticipantList === "present" ? presentParticipants : interestedParticipants;

  const personalGoal = selectedSession && myParticipation === "present"
    ? calculateTargetFromStructuredSession(selectedSession, profileVma, profileFcMax) ||
      calculateTargetFromText(selectedSession, profileVma, profileFcMax)
    : null;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchSessions();
    fetchMyProfile();
    fetchMyParticipations();
  }, [user]);

  useEffect(() => {
    if (!selectedSession) {
      setParticipants([]);
      setShowAdminActions(false);
      return;
    }

    fetchParticipants(selectedSession.id);
  }, [selectedSession]);

  async function fetchMyProfile() {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("firstname, lastname, pseudo, sexe, vma, fc_max, is_admin")
      .eq("id", user.id)
      .single();

    if (error) return;

    setFirstname(data?.firstname || "");
    setLastname(data?.lastname || "");
    setProfileSexe(data?.sexe || "");
    setProfileVma(data?.vma ? String(data.vma) : "");
    setProfileFcMax(data?.fc_max ? String(data.fc_max) : "");
    setIsAdmin(data?.is_admin === true);
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

  async function fetchMyParticipations() {
    if (!user) return;

    const { data, error } = await supabase
      .from("participants")
      .select("session_id, status")
      .eq("user_id", user.id);

    if (error) return;
    setMyParticipations((data || []) as MyParticipation[]);
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

  async function handleLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert("Erreur de connexion : " + error.message);
      return;
    }

    setUser(data.user);
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
      is_admin: false,
    });

    setUser(newUser);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setSelectedSession(null);
    setShowMenu(false);
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
    if (!selectedDate && !selectedSession?.date) {
      alert("Choisis d'abord une date.");
      return;
    }

    if (!formTitle.trim()) {
      alert("Merci d'ajouter un titre à la séance.");
      return;
    }

    const imageUrl = imageFile
      ? await uploadFile(imageFile, "images")
      : selectedSession?.image_url || null;

    const gpxUrl = gpxFile
      ? await uploadFile(gpxFile, "gpx")
      : selectedSession?.gpx_url || null;

    const payload = {
      title: formTitle.trim().charAt(0).toUpperCase() + formTitle.trim().slice(1),
      type: formType,
      date: selectedSession?.date || selectedDate,
      start_time: formStartTime,
      end_time: formEndTime,
      location: formLocation.trim(),
      description: formDescription.trim(),
      image_url: imageUrl,
      gpx_url: gpxUrl,
      created_by: user.id,
      workout_mode: formWorkoutMode || null,
      fraction_distance: formFractionDistance ? Number(formFractionDistance) : null,
      intensity_percent: formIntensityPercent ? Number(formIntensityPercent) : null,
    };

    if (isEditing && selectedSession) {
      const { data, error } = await supabase
        .from("sessions")
        .update(payload)
        .eq("id", selectedSession.id)
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
      fetchMyParticipations();
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
    fetchMyParticipations();
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
      <button key={session.id} onClick={() => { setSelectedSession(session); setActiveTab("calendar"); }} className={`session-card ${compact ? "compact" : ""}`}>
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

  if (!user) {
    return (
      <div className="app-screen auth-screen">
        <div className="auth-card">
          <img className="auth-logo" src="/logo-asm.png" alt="ASM Pau" />
          <h1>ASM Pau</h1>
          <p>Calendrier des sorties et entraînements</p>

          <input placeholder="Prénom" value={firstname} onChange={(e) => setFirstname(e.target.value)} />
          <input placeholder="Nom" value={lastname} onChange={(e) => setLastname(e.target.value)} />
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />

          <button className="primary-btn" onClick={handleLogin}>Connexion</button>
          <button className="secondary-btn" onClick={handleSignup}>Créer un compte</button>
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
          <button className={activeTab === "mySessions" ? "active" : ""} onClick={() => { setActiveTab("mySessions"); setShowMenu(false); }}>👤 Mes séances</button>
          <button className={activeTab === "profile" ? "active" : ""} onClick={() => { setActiveTab("profile"); setShowMenu(false); }}>⚙️ Profil</button>
          <button className={activeTab === "notifications" ? "active" : ""} onClick={() => { setActiveTab("notifications"); setShowMenu(false); }}>🔔 Notifications</button>
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
            <p>{activeTab === "calendar" ? "ASM Pau" : activeTab === "mySessions" ? "Mes séances" : activeTab === "profile" ? "Profil" : "Notifications"}</p>
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
          <section className="panel-screen">
            <h2>Mes séances</h2>
            <p className="screen-intro">Toutes les séances auxquelles tu es inscrit ou intéressé.</p>
            {mySessions.length > 0
              ? mySessions.map((session) => renderSessionCard(session, true))
              : <p className="empty-message">Tu n’es inscrit à aucune séance pour le moment.</p>}
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

              {profileVma && (
                <div className="personal-goal-card">
                  <h3>Repères d’allure</h3>
                  <p>70% VMA : {formatPace(60 / (Number(profileVma) * 0.7))}</p>
                  <p>80% VMA : {formatPace(60 / (Number(profileVma) * 0.8))}</p>
                  <p>90% VMA : {formatPace(60 / (Number(profileVma) * 0.9))}</p>
                  <p>100% VMA : {formatPace(60 / Number(profileVma))}</p>
                </div>
              )}

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
                <label>Objectif structuré</label>
                <select value={formWorkoutMode} onChange={(e) => setFormWorkoutMode(e.target.value as WorkoutMode)}>
                  <option value="">Automatique depuis la description</option>
                  <option value="vma">Fractionné VMA</option>
                  <option value="fc">Pourcentage FC max</option>
                  <option value="seuil">Seuil</option>
                  <option value="10km">Allure 10 km</option>
                </select>
              </div>

              {formWorkoutMode && formWorkoutMode !== "fc" && (
                <div className="form-row">
                  <label>Distance fraction en mètres</label>
                  <input type="number" placeholder="Ex : 400" value={formFractionDistance} onChange={(e) => setFormFractionDistance(e.target.value)} />
                </div>
              )}

              {formWorkoutMode && (
                <div className="form-row">
                  <label>Intensité en %</label>
                  <input type="number" placeholder="Ex : 90" value={formIntensityPercent} onChange={(e) => setFormIntensityPercent(e.target.value)} />
                </div>
              )}

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
                <p>{selectedSession.description || "Aucune description"}</p>

                {selectedSession.gpx_url && (
                  <div className="gpx-actions">
                    <button className="primary-btn" onClick={openGpxMap}>Voir la carte GPX</button>
                    <a className="gpx-link" href={selectedSession.gpx_url} target="_blank" rel="noreferrer" download>Télécharger le GPX</a>
                  </div>
                )}
              </div>

              <div className="participation-summary">
                <button className="participant-count" onClick={() => setShowParticipantList("interested")}>
                  <strong>{interestedParticipants.length}</strong>
                  <span>Intéressés</span>
                </button>
                <button className="participant-count" onClick={() => setShowParticipantList("present")}>
                  <strong>{presentParticipants.length}</strong>
                  <span>Participants</span>
                </button>
              </div>

              {personalGoal && (
                <div className="personal-goal-card">
                  <h3>🎯 Mon objectif personnalisé</h3>
                  {personalGoal.type === "vma" && (
                    <>
                      <p>Séance : {personalGoal.repetitions ? `${personalGoal.repetitions} × ` : ""}{personalGoal.distance} m</p>
                      <p>VMA utilisée : {personalGoal.vma} km/h</p>
                      <p>Intensité : {personalGoal.percent}% VMA</p>
                      <p>Allure cible : {formatPace(personalGoal.pace)}</p>
                      <p>Temps cible : {formatDuration(personalGoal.timeSeconds)} par fraction</p>
                    </>
                  )}
                  {personalGoal.type === "fc" && (
                    <>
                      <p>FC max utilisée : {personalGoal.fcMax} bpm</p>
                      <p>Intensité : {personalGoal.percent}% FC max</p>
                      <p>Fréquence cible : {personalGoal.targetFc} bpm</p>
                    </>
                  )}
                  {(personalGoal.type === "seuil" || personalGoal.type === "10km") && (
                    <>
                      {personalGoal.distance && <p>Distance : {personalGoal.distance} m</p>}
                      <p>Terrain : {personalGoal.surface === "trail" ? "Trail / côte" : "Route"}</p>
                      <p>VMA utilisée : {personalGoal.vma} km/h</p>
                      <p>Intensité : {personalGoal.percent}% VMA</p>
                      <p>Allure cible : {formatPace(personalGoal.pace)}</p>
                      {personalGoal.timeSeconds && <p>Temps cible : {formatDuration(personalGoal.timeSeconds)}</p>}
                    </>
                  )}
                  {personalGoal.type === "allure" && <p>Allure cible : {formatPace(personalGoal.pace)}</p>}
                </div>
              )}

              <div className="floating-admin-menu">
                {showAdminActions && (
                  <div className="floating-admin-actions">
                    <button onClick={() => handleParticipation("interested")} title="Intéressé">☆</button>
                    <button onClick={() => handleParticipation("present")} title="Présent">✓</button>
                    {isAdmin && <button onClick={handleDuplicateSession} title="Dupliquer">📋</button>}
                    {canEditSelectedSession && (
                      <>
                        <button onClick={openEditForm} title="Modifier">✏️</button>
                        <button onClick={handleDeleteSession} title="Supprimer">🗑️</button>
                      </>
                    )}
                  </div>
                )}
                <button className={`floating-admin-main ${showAdminActions ? "open" : ""}`} onClick={() => setShowAdminActions((current) => !current)}>{showAdminActions ? "×" : "‹"}</button>
              </div>
            </div>
          </div>
        )}

        {showParticipantList && (
          <div className="participant-modal">
            <div className="participant-modal-card">
              <div className="participant-list-header">
                <h3>{showParticipantList === "present" ? "Participants" : "Intéressés"}</h3>
                <button onClick={() => setShowParticipantList(null)}>×</button>
              </div>

              {displayedParticipantList.length > 0 ? (
                displayedParticipantList.map((participant) => (
                  <div key={participant.id} className="participant-row">{participant.firstname} {participant.lastname}</div>
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
              <button onClick={() => { setShowGpxMap(false); setMapLoaded(false); setGpxStats(null); }}>←</button>
              <h2>Parcours</h2>
            </div>

            <div id="gpx-map"></div>

            {gpxStats && (
              <div className="gpx-stats-panel">
                <div><strong>{gpxStats.distance} km</strong><span>Distance</span></div>
                <div><strong>+{gpxStats.elevationGain} m</strong><span>Dénivelé +</span></div>
              </div>
            )}

            {!mapLoaded && <p className="map-loading">Chargement du parcours...</p>}
          </div>
        )}
      </div>
    </div>
  );
}
