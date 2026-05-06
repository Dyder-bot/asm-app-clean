import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
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

export default function CalendarApp() {
  const [activeTab, setActiveTab] = useState<"calendar" | "profile">("calendar");
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

  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [participants, setParticipants] = useState<any[]>([]);
  const [showParticipantList, setShowParticipantList] = useState<string | null>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  const [showGpxMap, setShowGpxMap] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [gpxStats, setGpxStats] = useState<any>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState("Trail");
  const [formStartTime, setFormStartTime] = useState("18:30");
  const [formEndTime, setFormEndTime] = useState("20:00");
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formWorkoutMode, setFormWorkoutMode] = useState("");
  const [formFractionDistance, setFormFractionDistance] = useState("");
  const [formIntensityPercent, setFormIntensityPercent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [gpxFile, setGpxFile] = useState<File | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
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

    fetchParticipants(selectedSession.id);
  }, [selectedSession]);

  const fetchMyProfile = async () => {
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
  };

  const saveMyProfile = async () => {
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
  };

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      alert("Erreur chargement séances : " + error.message);
      return;
    }

    setSessions(data || []);
  };

  const fetchParticipants = async (sessionId: string) => {
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

    setParticipants(enriched);
  };

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Erreur de connexion : " + error.message);
      return;
    }

    setUser(data.user);
  };

  const handleSignup = async () => {
    if (!firstname || !lastname || !email || !password) {
      alert("Merci de remplir prénom, nom, email et mot de passe.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

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
  };

  const resetForm = () => {
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
  };

  const openCreateForm = () => {
    if (!selectedDate) {
      alert("Choisis d'abord une journée dans le calendrier.");
      return;
    }

    resetForm();
    setSelectedSession(null);
    setActiveTab("calendar");
    setShowCreateForm(true);
  };

  const openEditForm = () => {
    if (!selectedSession) return;

    setFormTitle(selectedSession.title || "");
    setFormType(selectedSession.type || "Trail");
    setFormStartTime(selectedSession.start_time || "18:30");
    setFormEndTime(selectedSession.end_time || "20:00");
    setFormLocation(selectedSession.location || "");
    setFormDescription(selectedSession.description || "");
    setFormWorkoutMode(selectedSession.workout_mode || "");
    setFormFractionDistance(selectedSession.fraction_distance || "");
    setFormIntensityPercent(selectedSession.intensity_percent || "");
    setImageFile(null);
    setGpxFile(null);
    setIsEditing(true);
    setShowCreateForm(true);
    setShowAdminActions(false);
  };

  const uploadFile = async (file: File, bucketName: string) => {
    const filePath = `${user.id}/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file);

    if (error) {
      alert("Erreur upload fichier : " + error.message);
      return null;
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSaveSession = async () => {
    if (!selectedDate && !selectedSession?.date) {
      alert("Choisis d'abord une date.");
      return;
    }

    if (!formTitle) {
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
      title: formTitle,
      type: formType,
      date: selectedSession?.date || selectedDate,
      start_time: formStartTime,
      end_time: formEndTime,
      location: formLocation,
      description: formDescription,
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

      const updatedSession = data?.[0];

      setSessions((current) =>
        current.map((session) =>
          session.id === updatedSession.id ? updatedSession : session
        )
      );

      setSelectedSession(updatedSession);
    } else {
      const { data, error } = await supabase
        .from("sessions")
        .insert(payload)
        .select();

      if (error) {
        alert("Erreur création séance : " + error.message);
        return;
      }

      if (data && data[0]) {
        setSessions((current) => [...current, data[0]]);
      }
    }

    resetForm();
    setShowCreateForm(false);
  };

  const handleDuplicateSession = async () => {
    if (!selectedSession || !user || !isAdmin) return;

    const newDate = window.prompt(
      "Date de la nouvelle séance au format AAAA-MM-JJ",
      selectedSession.date
    );

    if (!newDate) return;

    const payload = {
      title: selectedSession.title + " - copie",
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

    const { data, error } = await supabase
      .from("sessions")
      .insert(payload)
      .select();

    if (error) {
      alert("Erreur duplication séance : " + error.message);
      return;
    }

    if (data?.[0]) {
      setSessions((current) => [...current, data[0]]);
      alert("Séance dupliquée");
      setShowAdminActions(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return;

    const confirmDelete = window.confirm("Supprimer cette séance ?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", selectedSession.id);

    if (error) {
      alert("Erreur suppression séance : " + error.message);
      return;
    }

    setSessions((current) =>
      current.filter((session) => session.id !== selectedSession.id)
    );

    setSelectedSession(null);
    setShowAdminActions(false);
  };

  const handleParticipation = async (status: "present" | "interested") => {
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
  };

  const formatPace = (paceMinKm: number) => {
    const minutes = Math.floor(paceMinKm);
    const seconds = Math.round((paceMinKm - minutes) * 60);
    return `${minutes}'${String(seconds).padStart(2, "0")}/km`;
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    return `${min}'${String(sec).padStart(2, "0")}`;
  };

  const estimateVmaFromRace = (distanceKm: number, totalMinutes: number) => {
    const speed = distanceKm / (totalMinutes / 60);
    let percent = 0.9;

    if (distanceKm === 5) percent = 0.95;
    if (distanceKm === 10) percent = 0.9;
    if (distanceKm === 21.1) percent = 0.85;
    if (distanceKm === 42.195) percent = 0.8;

    return (speed / percent).toFixed(1);
  };

  const getPersonalGoal = (): any => {
    if (!selectedSession || myParticipation !== "present") return null;

    const text = `${selectedSession.title || ""} ${selectedSession.description || ""}`.toLowerCase();

    const isTrailSession =
      selectedSession?.type?.toLowerCase().includes("trail") ||
      text.includes("côte") ||
      text.includes("cote") ||
      text.includes("montée") ||
      text.includes("montee") ||
      text.includes("d+") ||
      text.includes("dénivelé");

    const vmaMatch = text.match(
      /(\d+)\s*[x×]\s*(\d+)\s*(m|km)?\s*.*?(\d+)\s*%\s*(de\s*)?vma/
    );

    const fcMatch = text.match(
      /(\d+)\s*%\s*(de\s*)?(fc\s*max|fc|max)/
    );

    const seuilMatch = text.match(
      /(\d+)\s*[x×]\s*(\d+)'?\s*(au\s*)?seuil/
    );

    const km10Match = text.match(
      /(\d+)\s*[x×]\s*(\d+)\s*(m|km)?\s*.*?(allure\s*)?(10\s?km)/
    );

    const allureMatch = text.match(
      /allure\s*(\d+)'(\d{1,2})"?/
    );

    if (vmaMatch && profileVma) {
      const repetitions = Number(vmaMatch[1]);
      const distance = vmaMatch[3] === "km" ? Number(vmaMatch[2]) * 1000 : Number(vmaMatch[2]);
      const percent = Number(vmaMatch[4]);
      const vma = Number(profileVma);
      const speed = (vma * percent) / 100;
      const pace = 60 / speed;
      const timeSeconds = (distance / 1000) * pace * 60;

      return { type: "vma", repetitions, distance, percent, vma, pace, timeSeconds };
    }

    if (fcMatch && profileFcMax) {
      const percent = Number(fcMatch[1]);
      const fcMax = Number(profileFcMax);
      const targetFc = Math.round((fcMax * percent) / 100);

      return { type: "fc", percent, fcMax, targetFc };
    }

    if (seuilMatch && profileVma) {
      const repetitions = Number(seuilMatch[1]);
      const durationMin = Number(seuilMatch[2]);
      const vma = Number(profileVma);
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

    if (km10Match && profileVma) {
      const repetitions = Number(km10Match[1]);
      const distance = km10Match[3] === "km" ? Number(km10Match[2]) * 1000 : Number(km10Match[2]);
      const vma = Number(profileVma);
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
      const pace = minutes + seconds / 60;

      return { type: "allure", pace };
    }

    return null;
  };

  const distanceBetween = (a: any, b: any) => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const openGpxMap = async () => {
    if (!selectedSession?.gpx_url) return;

    setShowGpxMap(true);
    setMapLoaded(false);
    setGpxStats(null);

    setTimeout(async () => {
      try {
        const response = await fetch(selectedSession.gpx_url);
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

        setGpxStats({
          distance: distance.toFixed(1),
          elevationGain: Math.round(elevationGain),
        });

        const mapElement = document.querySelector("#gpx-map");
        if (!mapElement) return;

        mapElement.innerHTML = "";

        const map = L.map("gpx-map", { zoomControl: true }).setView(
          [points[0].lat, points[0].lon],
          13
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
        }).addTo(map);

        const latLngs = points.map((p) => [p.lat, p.lon]) as [number, number][];

        const track = L.polyline(latLngs, {
          color: "#facc15",
          weight: 5,
          opacity: 0.95,
        }).addTo(map);

        const start = latLngs[0];
        const end = latLngs[latLngs.length - 1];
        const isLoop = map.distance(start, end) < 30;

        L.circleMarker(start, {
          radius: 10,
          color: "#22c55e",
          fillColor: "#22c55e",
          fillOpacity: 1,
          weight: 3,
        })
          .addTo(map)
          .bindPopup(isLoop ? "Départ / Arrivée" : "Départ");

        if (!isLoop) {
          L.circleMarker(end, {
            radius: 10,
            color: "#ef4444",
            fillColor: "#ef4444",
            fillOpacity: 1,
            weight: 3,
          })
            .addTo(map)
            .bindPopup("Arrivée");
        }

        map.fitBounds(track.getBounds(), { padding: [30, 30] });
        setMapLoaded(true);
      } catch (error) {
        alert("Erreur lecture GPX.");
      }
    }, 150);
  };

  const presentParticipants = participants.filter((p) => p.status === "present");
  const interestedParticipants = participants.filter((p) => p.status === "interested");
  const myParticipation = participants.find((p) => p.user_id === user?.id)?.status;
  const personalGoal: any = getPersonalGoal();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const mondayBasedOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const formatDate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const sessionsByDate = sessions.reduce((acc, session) => {
    acc[session.date] = true;
    return acc;
  }, {} as Record<string, boolean>);

  const sessionsForSelectedDate = selectedDate
    ? sessions.filter((session) => session.date === selectedDate)
    : [];

  const canEditSelectedSession = isAdmin || selectedSession?.created_by === user?.id;

  const displayedParticipantList =
    showParticipantList === "present" ? presentParticipants : interestedParticipants;

  if (!user) {
    return (
      <div className="app-screen auth-screen">
        <div className="auth-card">
          <h1>ASM Pau</h1>
          <p>Course à pied</p>

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
      <div className="app-container" onClick={(e) => e.stopPropagation()}>
        <header className="calendar-header">
          <button className="menu-btn" onClick={() => setShowMenu((current) => !current)}>
            ☰
          </button>

          <button onClick={() => setCurrentDate(new Date(year, month - 1))}>◀</button>

          <div>
            <h1>{currentDate.toLocaleString("fr-FR", { month: "long" })} {year}</h1>
            <p>ASM Pau</p>
          </div>

          <button onClick={() => setCurrentDate(new Date(year, month + 1))}>▶</button>
        </header>

        {showMenu && (
          <div className="side-menu">
            <button onClick={() => { setActiveTab("calendar"); setShowMenu(false); }}>
              Calendrier
            </button>
            <button onClick={() => { setActiveTab("profile"); setShowMenu(false); }}>
              Profil
            </button>
          </div>
        )}

        {activeTab === "calendar" && (
          <>
            <section className="calendar-card">
              <div className="calendar-grid calendar-days">
                {["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map((dayName) => (
                  <div key={dayName}>{dayName}</div>
                ))}
              </div>

              <div className="calendar-grid">
                {Array.from({ length: mondayBasedOffset }, (_, index) => (
                  <div key={`empty-${index}`} className="calendar-empty" />
                ))}

                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = index + 1;
                  const dateKey = formatDate(day);
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
                  <h2>Séances du {selectedDate}</h2>
                  <button className="floating-add-btn" onClick={openCreateForm}>+</button>
                </div>

                {sessionsForSelectedDate.length > 0 ? (
                  sessionsForSelectedDate.map((session) => (
                    <button key={session.id} onClick={() => setSelectedSession(session)} className="session-card">
                      <strong>{session.title}</strong>
                      <span>{session.start_time} - {session.end_time}</span>
                      {session.type && <small>🏷️ {session.type}</small>}
                      {session.location && <small>📍 {session.location}</small>}
                    </button>
                  ))
                ) : (
                  <p className="empty-message">Aucune séance</p>
                )}
              </section>
            )}
          </>
        )}

        {activeTab === "profile" && (
          <section className="profile-screen">
            <h2>Profil</h2>

            <div className="profile-card">
              <div className="form-row">
                <label>Pseudo :</label>
                <input value={`${firstname} ${lastname.charAt(0).toUpperCase()}.`} disabled />
              </div>

              <div className="form-row">
                <label>Sexe :</label>
                <select value={profileSexe} onChange={(e) => setProfileSexe(e.target.value)}>
                  <option value="">Non renseigné</option>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                </select>
              </div>

              <div className="form-row">
                <label>VMA :</label>
                <input
                  type="number"
                  step="0.1"
                  value={profileVma}
                  onChange={(e) => setProfileVma(e.target.value)}
                  placeholder="Ex : 15"
                />
              </div>

              <div className="form-row">
                <label>Distance (km) :</label>
                <input
                  type="number"
                  placeholder="Ex : 10"
                  value={raceDistance}
                  onChange={(e) => setRaceDistance(e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Temps (minutes) :</label>
                <input
                  type="number"
                  placeholder="Ex : 45"
                  value={raceTime}
                  onChange={(e) => setRaceTime(e.target.value)}
                />
              </div>

              <button
                className="secondary-btn"
                onClick={() => {
                  if (!raceDistance || !raceTime) return;
                  const estimated = estimateVmaFromRace(Number(raceDistance), Number(raceTime));
                  setProfileVma(estimated);
                }}
              >
                Estimer ma VMA
              </button>

              <div className="form-row">
                <label>FC max :</label>
                <input
                  type="number"
                  value={profileFcMax}
                  onChange={(e) => setProfileFcMax(e.target.value)}
                  placeholder="Ex : 190"
                />
              </div>

              <button className="primary-btn" onClick={saveMyProfile}>
                Enregistrer le profil
              </button>
            </div>
          </section>
        )}

        {showCreateForm && (
          <div className="create-modal">
            <div className="create-header">
              <button onClick={() => setShowCreateForm(false)}>☰</button>
              <h2>{isEditing ? "Modifier l'événement" : "Ajouter un événement"}</h2>
            </div>

            <div className="create-card">
              <div className="form-row">
                <label>Titre :</label>
                <input placeholder="Titre de la séance" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              </div>

              <div className="form-row">
                <label>Type :</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)}>
                  {SESSION_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>

              <div className="form-row">
                <label>Objectif personnalisé :</label>
                <select value={formWorkoutMode} onChange={(e) => setFormWorkoutMode(e.target.value)}>
                  <option value="">Aucun</option>
                  <option value="vma">VMA</option>
                  <option value="fc">FC max</option>
                </select>
              </div>

              {formWorkoutMode === "vma" && (
                <div className="form-row">
                  <label>Distance fraction :</label>
                  <input
                    type="number"
                    placeholder="Ex : 400"
                    value={formFractionDistance}
                    onChange={(e) => setFormFractionDistance(e.target.value)}
                  />
                </div>
              )}

              {formWorkoutMode && (
                <div className="form-row">
                  <label>Intensité (%) :</label>
                  <input
                    type="number"
                    placeholder="Ex : 90"
                    value={formIntensityPercent}
                    onChange={(e) => setFormIntensityPercent(e.target.value)}
                  />
                </div>
              )}

              <div className="form-row">
                <label>Ville :</label>
                <input placeholder="Ville ou lieu" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
              </div>

              <div className="form-row description-row">
                <label>Description :</label>
                <textarea placeholder="Description et lien éventuel" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
              </div>

              <div className="form-row">
                <label>Début :</label>
                <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
              </div>

              <div className="form-row">
                <label>Fin :</label>
                <input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
              </div>

              <div className="form-row file-row">
                <label>Image :</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>

              <div className="form-row file-row">
                <label>GPX :</label>
                <input type="file" accept=".gpx" onChange={(e) => setGpxFile(e.target.files?.[0] || null)} />
              </div>

              <button className="primary-btn" onClick={handleSaveSession}>
                {isEditing ? "Modifier l’événement" : "Créer l’événement"}
              </button>

              <button className="close-floating-btn" onClick={() => setShowCreateForm(false)}>×</button>
            </div>
          </div>
        )}

        {selectedSession && (
          <div className="session-detail">
            <div className="detail-container">
              <button className="back-btn" onClick={() => setSelectedSession(null)}>⬅ Retour</button>

              <h2>{selectedSession.title}</h2>
              <p className="detail-date">{selectedSession.date} • {selectedSession.start_time} - {selectedSession.end_time}</p>

              {selectedSession.image_url && <img src={selectedSession.image_url} alt={selectedSession.title} />}

              <div className="detail-box">
                <p>🏷️ {selectedSession.type || "Type non renseigné"}</p>
                <p>{selectedSession.description || "Aucune description"}</p>
                <p>📍 {selectedSession.location || "Lieu non renseigné"}</p>

                {selectedSession.gpx_url && (
                  <div className="gpx-actions">
                    <button className="primary-btn" onClick={openGpxMap}>Voir le GPX</button>
                    <a className="gpx-link" href={selectedSession.gpx_url} target="_blank" rel="noreferrer" download>
                      Télécharger le GPX
                    </a>
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

              <div className="notification-row">
                <button
                  className={`notification-toggle ${notificationEnabled ? "enabled" : ""}`}
                  onClick={() => setNotificationEnabled(!notificationEnabled)}
                >
                  <span />
                </button>
                <p>Notification</p>
              </div>

              {personalGoal && (
                <div className="personal-goal-card">
                  <h3>🎯 Mon objectif personnalisé</h3>

                  {personalGoal.type === "vma" && (
                    <>
                      <p>Séance : {personalGoal.repetitions} × {personalGoal.distance} m</p>
                      <p>VMA utilisée : {personalGoal.vma} km/h</p>
                      <p>Intensité : {personalGoal.percent}% VMA</p>
                      <p>Allure cible : {formatPace(personalGoal.pace ?? 0)}</p>
                      <p>Temps cible : {formatTime(personalGoal.timeSeconds ?? 0)} par fraction</p>
                    </>
                  )}

                  {personalGoal.type === "fc" && (
                    <>
                      <p>FC max utilisée : {personalGoal.fcMax} bpm</p>
                      <p>Intensité : {personalGoal.percent}% FC max</p>
                      <p>Fréquence cible : {personalGoal.targetFc} bpm</p>
                    </>
                  )}

                  {personalGoal.type === "seuil" && (
                    <>
                      <p>Séance : {personalGoal.repetitions} × {personalGoal.durationMin}'</p>
                      <p>Terrain : {personalGoal.surface === "trail" ? "Trail / côte" : "Route"}</p>
                      <p>VMA utilisée : {personalGoal.vma} km/h</p>
                      <p>Intensité : {personalGoal.percent}% VMA</p>
                      {personalGoal.surface === "trail" ? (
                        <p>Objectif : effort seuil contrôlé, sans chercher l’allure route.</p>
                      ) : (
                        <p>Allure seuil : {formatPace(personalGoal.pace ?? 0)}</p>
                      )}
                    </>
                  )}

                  {personalGoal.type === "10km" && (
                    <>
                      <p>Séance : {personalGoal.repetitions} × {personalGoal.distance} m</p>
                      <p>Terrain : {personalGoal.surface === "trail" ? "Trail / côte" : "Route"}</p>
                      <p>VMA utilisée : {personalGoal.vma} km/h</p>
                      <p>Intensité : {personalGoal.percent}% VMA</p>
                      {personalGoal.surface === "trail" ? (
                        <p>Objectif : effort proche allure 10 km, à adapter au terrain.</p>
                      ) : (
                        <>
                          <p>Allure 10 km : {formatPace(personalGoal.pace ?? 0)}</p>
                          <p>Temps cible : {formatTime(personalGoal.timeSeconds ?? 0)} par fraction</p>
                        </>
                      )}
                    </>
                  )}

                  {personalGoal.type === "allure" && (
                    <p>Allure cible : {formatPace(personalGoal.pace ?? 0)}</p>
                  )}
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

              <div className="floating-admin-menu">
                {showAdminActions && (
                  <div className="floating-admin-actions">
                    <button onClick={() => handleParticipation("interested")} title="Intéressé">
                      ☆
                    </button>

                    <button onClick={() => handleParticipation("present")} title="Présent">
                      ✓
                    </button>

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
                  className="floating-admin-main"
                  onClick={() => setShowAdminActions((current) => !current)}
                >
                  {showAdminActions ? "×" : "‹"}
                </button>
              </div>
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
