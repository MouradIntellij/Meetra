// client/src/pages/Home.jsx
// Meetra — Page d'accueil complète v2
// ✅ Cards dynamiques  ✅ Modals (Nouvelle réunion / Rejoindre / Planifier)
// ✅ Navbar avec sous-menus dropdown  ✅ Historique récent  ✅ Contacts rapides
// ✅ Barre de recherche  ✅ Horloge live  ✅ Stats  ✅ Compatible Vite + Tailwind + React Router

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { buildPublicRoomUrl, getApiUrl } from "../utils/appConfig.js";

// ═══════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════

const generateRoomId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

const API_URL = getApiUrl();
const AUTH_STORAGE_KEY = "meetra-auth-session";
const CONTACTS_STORAGE_KEY = "meetra-contacts";
const CONTACT_ROLES = ["Étudiant", "Enseignant", "Développeur UI", "Programmeur", "Administrateur"];

function readStoredAuth() {
  if (typeof window === "undefined") return { token: "", profile: null };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || "{}");
    return {
      token: parsed.token || "",
      profile: parsed.profile || null,
    };
  } catch {
    return { token: "", profile: null };
  }
}

function persistAuth(session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("meetra-auth-changed", { detail: session }));
}

function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("meetra-auth-changed", { detail: { token: "", profile: null } }));
}

function readStoredContacts() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CONTACTS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistContacts(contacts) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
}

function getInitials(name = "", email = "") {
  const source = String(name || "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "M";
  }
  return (String(email || "").trim().slice(0, 2) || "M").toUpperCase();
}

function colorFromText(value) {
  const source = String(value || "M");
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) % 360;
  return `hsl(${hash}, 58%, 42%)`;
}

function nameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "";
  return local
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim() || email;
}

function getAuthErrorMessage(errorCode) {
  switch (errorCode) {
    case "AUTH_DATABASE_REQUIRED":
      return "Configuration serveur incomplète : la base Postgres est requise pour l'authentification.";
    case "EMAIL_ALREADY_EXISTS":
      return "Cet email possède déjà un compte.";
    case "INVALID_CREDENTIALS":
      return "Email ou mot de passe invalide.";
    case "INVALID_REGISTRATION_PAYLOAD":
      return "Inscription invalide : nom, email valide et mot de passe de 6 caractères minimum requis.";
    case "AUTH_REQUEST_FAILED":
      return "Le serveur n'a pas pu traiter la demande d'authentification.";
    default:
      return "Impossible d'ouvrir la session Meetra.";
  }
}

function normalizeRoomInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/room\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : raw;
  } catch {
    const match = raw.match(/\/room\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : raw;
  }
}

function normalizeInviteeEmails(value) {
  const source = Array.isArray(value) ? value.join(",") : value;
  return Array.from(new Set(
      String(source || "")
          .split(/[,\n;]/)
          .map((item) => item.trim())
          .filter(Boolean)
  ));
}

function formatMeetingDate(value, timezone) {
  if (!value) return "Date à confirmer";
  try {
    return new Intl.DateTimeFormat("fr-CA", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || undefined,
    }).format(new Date(value));
  } catch {
    return "Date à confirmer";
  }
}

function formatDuration(minutes) {
  const value = Number(minutes) || 60;
  if (value < 60) return `${value} min`;
  if (value % 60 === 0) return `${value / 60} h`;
  return `${Math.floor(value / 60)} h ${value % 60}`;
}

function getInviteeLabel(meeting) {
  const firstInvitee = meeting?.inviteeEmails?.[0];
  if (!firstInvitee) return "Aucun invité indiqué";
  const namePart = firstInvitee.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return namePart || firstInvitee;
}

function uniqueMeetingsByRoom(meetings) {
  const seen = new Set();
  return (meetings || []).filter((meeting) => {
    const roomKey = String(meeting?.roomId || meeting?.id || "").trim().toLowerCase();
    const logicalKey = [
      String(meeting?.title || "").trim().toLowerCase(),
      String(meeting?.scheduledFor || "").trim(),
      String(meeting?.inviteeEmails?.[0] || "").trim().toLowerCase(),
    ].join("|");
    const key = roomKey || logicalKey;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    if (logicalKey && !seen.has(logicalKey)) seen.add(logicalKey);
    return true;
  });
}

function useClickOutside(ref, cb) {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) cb();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, cb]);
}

// ═══════════════════════════════════════════════════════════
// ICÔNES SVG  (zero dépendance)
// ═══════════════════════════════════════════════════════════

const I = {
  Video: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
  ),
  Link: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
  ),
  Calendar: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
  ),
  Screen: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
  ),
  Clock: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
  ),
  Copy: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
  ),
  Check: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
  ),
  X: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
  ),
  Arrow: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
      </svg>
  ),
  ChevronDown: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
  ),
  Search: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
  ),
  Users: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
  ),
  Mic: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
      </svg>
  ),
  Play: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
      </svg>
  ),
  Trash: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
      </svg>
  ),
  Star: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
  ),
  Bell: (p) => (
      <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
  ),
};

// ═══════════════════════════════════════════════════════════
// DONNÉES MOCK
// ═══════════════════════════════════════════════════════════

const MEETINGS_TODAY = [
  {
    id: "ROOM-A1",
    title: "Standup d'équipe",
    host: "Mourad S.",
    time: "10:00",
    duration: "30 min",
    participants: 5,
    status: "live",
    avatars: ["MS", "AL", "JD", "KP", "+1"],
  },
  {
    id: "ROOM-B2",
    title: "Revue de sprint #12",
    host: "Alice L.",
    time: "14:00",
    duration: "1h",
    participants: 8,
    status: "upcoming",
    avatars: ["AL", "MS", "RK", "+5"],
  },
  {
    id: "ROOM-C3",
    title: "Demo client — TT4",
    host: "Mourad S.",
    time: "16:30",
    duration: "45 min",
    participants: 12,
    status: "upcoming",
    avatars: ["MS", "JD", "PW", "+9"],
  },
];

const RECENT_MEETINGS = [
  { id: "R01", title: "Revue de code backend", date: "Hier, 15h20", duration: "58 min", participants: 4, recorded: true },
  { id: "R02", title: "Planification sprint #11", date: "Lun 28 avr, 10h00", duration: "1h12", participants: 7, recorded: false },
  { id: "R03", title: "Entretien candidat UX", date: "Ven 25 avr, 14h30", duration: "45 min", participants: 3, recorded: true },
  { id: "R04", title: "Demo finale TT4", date: "Jeu 24 avr, 11h00", duration: "30 min", participants: 15, recorded: true },
];

const NAV_MENU = [
  { label: "Accueil", active: true, items: [] },
  {
    label: "Réunions",
    items: [
      { icon: "📅", label: "Mes réunions planifiées" },
      { icon: "⏺️", label: "Réunions enregistrées" },
      { icon: "👥", label: "Salles de groupe" },
      { icon: "🔒", label: "Salles verrouillées" },
    ],
  },
  {
    label: "Contacts",
    items: [
      { icon: "👤", label: "Mes contacts" },
      { icon: "✉️", label: "Inviter des membres" },
      { icon: "📋", label: "Annuaire LaSalle" },
    ],
  },
  {
    label: "Paramètres",
    items: [
      { icon: "🎙️", label: "Audio & Vidéo" },
      { icon: "🖼️", label: "Arrière-plans virtuels" },
      { icon: "🔔", label: "Notifications" },
      { icon: "🛡️", label: "Sécurité & Confidentialité" },
      { icon: "🌐", label: "Réseau & TURN" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// COMPOSANTS PRIMITIFS
// ═══════════════════════════════════════════════════════════

/** Bouton copier avec feedback visuel */
function CopyBtn({ text, size = 16 }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  };
  return (
      <button
          onClick={copy}
          title="Copier"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
          style={{
            color: done ? "#10b981" : "#818cf8",
            background: done ? "rgba(16,185,129,0.1)" : "rgba(99,102,241,0.1)",
          }}
      >
        {done
            ? <I.Check width={size} height={size} />
            : <I.Copy width={size} height={size} />}
        {done ? "Copié !" : "Copier"}
      </button>
  );
}

/** Toggle switch animé */
function Toggle({ value, onChange }) {
  return (
      <button
          onClick={() => onChange(!value)}
          className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-300"
          style={{ background: value ? "#6366f1" : "rgba(255,255,255,0.1)" }}
      >
      <span
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300"
          style={{ left: value ? "calc(100% - 1.25rem)" : "0.25rem" }}
      />
      </button>
  );
}

/** Ligne toggle dans un formulaire */
function ToggleRow({ label, sub, value, onChange }) {
  return (
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm text-white font-medium leading-snug">{label}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <Toggle value={value} onChange={onChange} />
      </div>
  );
}

/** Avatar coloré avec indicateur de présence */
function Avatar({ initials, color, online, size = 36, showStatus = false }) {
  return (
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <div
            className="w-full h-full rounded-full flex items-center justify-center text-white font-bold"
            style={{
              background: `linear-gradient(135deg, ${color}, ${color}99)`,
              fontSize: size * 0.33,
            }}
        >
          {initials}
        </div>
        {showStatus && (
            <span
                className="absolute bottom-0 right-0 rounded-full border-2 border-gray-900"
                style={{
                  width: size * 0.3,
                  height: size * 0.3,
                  background: online ? "#10b981" : "#475569",
                }}
            />
        )}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MODAL GÉNÉRIQUE
// ═══════════════════════════════════════════════════════════

function Modal({ open, onClose, title, children, maxWidth = "max-w-md" }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    if (open) {
      document.addEventListener("keydown", k);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
      <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(5,8,16,0.85)", backdropFilter: "blur(10px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
            className={`relative w-full ${maxWidth} rounded-2xl p-6`}
            style={{
              background: "linear-gradient(160deg, #111827 0%, #0d1322 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 0 0 1px rgba(99,102,241,0.08), 0 32px 80px rgba(0,0,0,0.7)",
              animation: "modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
            }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
            <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <I.X width={17} height={17} />
            </button>
          </div>
          {children}
        </div>
      </div>
  );
}

function AccountModal({ open, onClose, auth, onSessionChange }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus("");
    setPassword("");
    setName(auth.profile?.name || "");
    setEmail(auth.profile?.email || "");
  }, [open, auth]);

  const submit = async () => {
    if (!email.trim() || !password.trim() || (mode === "register" && !name.trim())) {
      setStatus("Complétez les champs requis pour ouvrir votre accès hôte.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(getAuthErrorMessage(data.error));
        return;
      }

      const session = {
        token: data.token || "",
        profile: data.profile || null,
      };
      persistAuth(session);
      onSessionChange(session);
      onClose();
    } catch {
      setStatus("Connexion serveur impossible pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    clearStoredAuth();
    onSessionChange({ token: "", profile: null });
    onClose();
  };

  const signedIn = Boolean(auth.profile?.email);

  return (
      <Modal open={open} onClose={onClose} title={signedIn ? "Compte Meetra" : "Accès hôte Meetra"}>
        <div className="space-y-4">
          {signedIn ? (
              <>
                <div className="rounded-xl px-4 py-4"
                     style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
                  <p className="text-sm font-bold text-white">{auth.profile?.name || "Compte Meetra"}</p>
                  <p className="text-xs text-slate-400 mt-1">{auth.profile?.email}</p>
                  <p className="text-xs text-slate-500 mt-3">
                    Ce compte pourra créer des réunions et entrer comme hôte.
                  </p>
                </div>
                <PrimaryBtn onClick={signOut} color="#ef4444">
                  Se déconnecter
                </PrimaryBtn>
              </>
          ) : (
              <>
                <div className="flex gap-2 rounded-xl p-1"
                     style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {[
                    ["login", "Connexion"],
                    ["register", "Créer un compte"],
                  ].map(([value, label]) => (
                      <button
                          key={value}
                          onClick={() => setMode(value)}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                          style={{
                            color: mode === value ? "white" : "#94a3b8",
                            background: mode === value ? "rgba(99,102,241,0.22)" : "transparent",
                          }}
                      >
                        {label}
                      </button>
                  ))}
                </div>

                {mode === "register" && (
                    <FormField label="Nom complet">
                      <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ex : Mourad Sehboub"
                          className="meetra-input"
                      />
                    </FormField>
                )}

                <FormField label="Adresse email">
                  <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex : vous@meetra.app"
                      className="meetra-input"
                  />
                </FormField>

                <FormField label="Mot de passe">
                  <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submit()}
                      placeholder={mode === "register" ? "6 caractères minimum" : "Mot de passe"}
                      className="meetra-input"
                  />
                </FormField>

                {status && (
                    <div className="rounded-xl px-4 py-3 text-sm"
                         style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.18)", color: "#fecaca" }}>
                      {status}
                    </div>
                )}

                <PrimaryBtn onClick={submit} disabled={loading} color="#6366f1">
                  {loading ? "Traitement..." : mode === "register" ? "Créer mon accès hôte" : "Se connecter"}
                </PrimaryBtn>
              </>
          )}
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// MODAL : NOUVELLE RÉUNION
// ═══════════════════════════════════════════════════════════

function NewMeetingModal({ open, onClose, onJoin, auth, onOpenAccount, onCreateMeeting }) {
  const [name, setName] = useState("");
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [lock, setLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const roomId = useRef(generateRoomId());

  useEffect(() => {
    if (!open) return;
    roomId.current = generateRoomId();
    setError("");
    setLoading(false);
    setName(auth.profile?.name || "");
  }, [open]);

  const start = async () => {
    if (!name.trim()) return;
    if (!auth.token) {
      setError("Connectez-vous avec votre accès Meetra pour créer une réunion comme hôte.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const meeting = await onCreateMeeting({
        title: `Réunion instantanée · ${name.trim()}`,
        durationMinutes: 60,
      });
      onJoin(meeting.roomId, name.trim(), { asHost: true });
      onClose();
    } catch (createError) {
      setError(createError.message || "Impossible de créer la réunion.");
    } finally {
      setLoading(false);
    }
  };

  return (
      <Modal open={open} onClose={onClose} title="✦ Nouvelle réunion instantanée">
        <div className="space-y-4">

          {/* Badge ID salle */}
          <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}
          >
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Accès hôte</span>
            <span className="flex-1 font-mono text-sm font-black text-white tracking-[0.25em]">
            {auth.profile?.email ? "AUTORISÉ" : "CONNEXION REQUISE"}
          </span>
            {!auth.profile?.email ? (
                <button
                    onClick={onOpenAccount}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: "rgba(99,102,241,0.14)", color: "#a5b4fc" }}
                >
                  Se connecter
                </button>
            ) : null}
          </div>

          {/* Nom */}
          <FormField label="Votre nom d'affichage">
            <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && start()}
                placeholder="Ex : Mourad Sehboub"
                className="meetra-input"
            />
          </FormField>

          {/* Toggles */}
          <div className="rounded-xl overflow-hidden divide-y divide-white/5"
               style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <ToggleRow label="Microphone activé" sub="Audio dès l'entrée" value={mic} onChange={setMic} />
            <ToggleRow label="Caméra activée" sub="Vidéo dès l'entrée" value={cam} onChange={setCam} />
            <ToggleRow label="Salle d'attente" sub="Approuver chaque participant" value={waiting} onChange={setWaiting} />
            <ToggleRow label="Verrouiller après ouverture" sub="Personne ne rejoint sans invitation" value={lock} onChange={setLock} />
          </div>

          {error && (
              <div className="rounded-xl px-4 py-3 text-sm"
                   style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.18)", color: "#fecaca" }}>
                {error}
              </div>
          )}

          <PrimaryBtn onClick={start} disabled={!name.trim() || loading} color="#6366f1">
            {loading ? "Création de la réunion..." : "Démarrer la réunion →"}
          </PrimaryBtn>
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// MODAL : REJOINDRE
// ═══════════════════════════════════════════════════════════

function JoinModal({ open, onClose, onJoin, prefillRoomId = "" }) {
  const [roomId, setRoomId] = useState(prefillRoomId);
  const [name, setName] = useState("");
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);

  const join = () => {
    const normalizedRoomId = normalizeRoomInput(roomId).trim();
    if (!normalizedRoomId || !name.trim()) return;
    onJoin(normalizedRoomId, name.trim(), { asHost: false });
    onClose();
  };

  return (
      <Modal open={open} onClose={onClose} title="↗ Rejoindre une réunion">
        <div className="space-y-4">
          <FormField label="ID de réunion ou lien">
            <input
                autoFocus
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Ex : AB12CD"
                className="meetra-input font-mono tracking-[0.3em] text-center text-lg"
            />
          </FormField>
          <FormField label="Votre nom d'affichage">
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="Ex : Mourad Sehboub"
                className="meetra-input"
            />
          </FormField>
          <div className="rounded-xl overflow-hidden divide-y divide-white/5"
               style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <ToggleRow label="Microphone" value={mic} onChange={setMic} />
            <ToggleRow label="Caméra" value={cam} onChange={setCam} />
          </div>
          <PrimaryBtn onClick={join} disabled={!roomId.trim() || !name.trim()} color="#10b981">
            Rejoindre →
          </PrimaryBtn>
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// MODAL : PLANIFIER
// ═══════════════════════════════════════════════════════════

function ScheduleModal({ open, onClose, auth, onOpenAccount, onCreateMeeting }) {
  const today = new Date().toISOString().split("T")[0];
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [invitees, setInvitees] = useState("");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdMeeting, setCreatedMeeting] = useState(null);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setLoading(false);
    setError("");
    setCreatedMeeting(null);
    setInvitees("");
  }, [open]);

  const schedule = async () => {
    if (loading || createdMeeting) return;
    if (!title.trim()) return;
    if (!auth.token) {
      setError("Connectez-vous avec votre accès Meetra pour planifier une réunion.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
      const meeting = await onCreateMeeting({
        title: title.trim(),
        scheduledFor,
        durationMinutes: Number(duration),
        inviteeEmails: normalizeInviteeEmails(invitees),
      });
      setCreatedMeeting(meeting);
      await navigator.clipboard.writeText(meeting.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (createError) {
      setError(createError.message || "Impossible de planifier la réunion.");
    } finally {
      setLoading(false);
    }
  };

  return (
      <Modal open={open} onClose={onClose} title="📅 Planifier une réunion">
        <div className="space-y-4">
          <FormField label="Titre de la réunion">
            <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Standup d'équipe"
                className="meetra-input"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date">
              <input type="date" value={date} min={today}
                     onChange={(e) => setDate(e.target.value)}
                     className="meetra-input" style={{ colorScheme: "dark" }} />
            </FormField>
            <FormField label="Heure">
              <input type="time" value={time}
                     onChange={(e) => setTime(e.target.value)}
                     className="meetra-input" style={{ colorScheme: "dark" }} />
            </FormField>
          </div>
          <FormField label="Durée estimée">
            <select value={duration} onChange={(e) => setDuration(e.target.value)}
                    className="meetra-input" style={{ background: "#0d1322" }}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 heure</option>
              <option value="90">1 heure 30</option>
              <option value="120">2 heures</option>
            </select>
          </FormField>
          <FormField label="Personne à inviter par courriel">
            <textarea
                rows={3}
                value={invitees}
                onChange={(e) => setInvitees(e.target.value)}
                placeholder="nom@exemple.com, autre@exemple.com"
                className="meetra-input"
                style={{ resize: "vertical", minHeight: 92 }}
            />
          </FormField>
          <div className="rounded-xl overflow-hidden"
               style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <ToggleRow label="Activer la salle d'attente" sub="Les participants attendent votre approbation" value={waitingRoom} onChange={setWaitingRoom} />
          </div>

          {/* Aperçu lien */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
               style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-slate-500 flex-shrink-0">Lien :</span>
            <span className="font-mono text-slate-400 truncate flex-1">
            {createdMeeting?.joinUrl || "Le lien sera généré après la création"}
          </span>
          </div>

          {!auth.token && (
              <button
                  onClick={onOpenAccount}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}
              >
                Ouvrir l'accès hôte
              </button>
          )}

          {error && (
              <div className="rounded-xl px-4 py-3 text-sm"
                   style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.18)", color: "#fecaca" }}>
                {error}
              </div>
          )}

          <PrimaryBtn onClick={schedule} disabled={!title.trim() || loading} color="#f59e0b">
            {copied
                ? <span className="flex items-center gap-2 justify-center"><I.Check width={16} height={16} /> Lien copié dans le presse-papier !</span>
                : <span className="flex items-center gap-2 justify-center"><I.Copy width={16} height={16} /> {loading ? "Création..." : "Créer, envoyer et copier le lien"}</span>
            }
          </PrimaryBtn>
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// MODAL : DÉTAIL RÉUNION RÉCENTE
// ═══════════════════════════════════════════════════════════

function RecentDetailModal({ open, onClose, meeting, onHostMeeting, auth }) {
  const [recipients, setRecipients] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRecipients((meeting?.inviteeEmails || []).join(", "));
    setStatus("");
    setSending(false);
  }, [open, meeting]);

  if (!meeting) return null;

  const copyLink = async () => {
    await navigator.clipboard.writeText(meeting.joinUrl || buildPublicRoomUrl(meeting.roomId || meeting.id));
    setStatus("Lien copié.");
  };

  const sendLink = async () => {
    const normalizedRecipients = normalizeInviteeEmails(recipients);
    if (!normalizedRecipients.length) {
      setStatus("Ajoutez au moins une adresse courriel.");
      return;
    }
    if (!auth.token) {
      setStatus("Connectez-vous comme administrateur pour envoyer le lien.");
      return;
    }

    setSending(true);
    setStatus("");
    try {
      const roomId = meeting.roomId || meeting.id;
      const res = await fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ recipients: normalizedRecipients }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "INVITATIONS_FAILED");
      }
      setStatus("Lien envoyé aux invités.");
    } catch {
      setStatus("Impossible d'envoyer le lien. Copiez-le et envoyez-le manuellement.");
    } finally {
      setSending(false);
    }
  };

  return (
      <Modal open={open} onClose={onClose} title={meeting.title}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Date", value: meeting.date || formatMeetingDate(meeting.scheduledFor, meeting.timezone) },
              { label: "Durée", value: meeting.duration || formatDuration(meeting.durationMinutes) },
              { label: "Invité", value: getInviteeLabel(meeting) },
            ].map((s) => (
                <div key={s.label} className="py-3 rounded-xl"
                     style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-sm font-black text-white truncate px-2">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
               style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-slate-500 flex-shrink-0">Lien :</span>
            <span className="font-mono text-slate-400 truncate flex-1">
              {meeting.joinUrl || buildPublicRoomUrl(meeting.roomId || meeting.id)}
            </span>
          </div>
          <FormField label="Envoyer le lien à">
            <textarea
                rows={2}
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="invite@exemple.com"
                className="meetra-input"
                style={{ resize: "vertical", minHeight: 76 }}
            />
          </FormField>
          {status && (
              <div className="rounded-xl px-4 py-3 text-sm"
                   style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.18)", color: "#c7d2fe" }}>
                {status}
              </div>
          )}
          <div className="flex gap-3">
            <button
                onClick={() => { onHostMeeting(meeting); onClose(); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
            >
              Ouvrir comme hôte
            </button>
            <button
                onClick={copyLink}
                className="px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              Copier
            </button>
            <button
                onClick={sendLink}
                disabled={sending}
                className="px-4 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              {sending ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </div>
      </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// PETITS COMPOSANTS UI
// ═══════════════════════════════════════════════════════════

function FormField({ label, children }) {
  return (
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-2">{label}</label>
        {children}
      </div>
  );
}

function PrimaryBtn({ onClick, disabled, color, children }) {
  return (
      <button
          onClick={onClick}
          disabled={disabled}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
          style={{ background: disabled ? `${color}55` : `linear-gradient(135deg, ${color}, ${color}cc)` }}
      >
        {children}
      </button>
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION : 4 CARDS D'ACTION RAPIDE
// ═══════════════════════════════════════════════════════════

function ActionCards({ setModal }) {
  const cards = [
    {
      Icon: I.Video, label: "Nouvelle réunion", desc: "Visioconférence instantanée avec lien de partage",
      color: "#6366f1", badge: "Instant", onClick: () => setModal("new"),
    },
    {
      Icon: I.Link, label: "Rejoindre", desc: "Collez un ID ou un lien reçu par email",
      color: "#10b981", onClick: () => setModal("join"),
    },
    {
      Icon: I.Calendar, label: "Planifier", desc: "Créez une réunion et envoyez le lien",
      color: "#f59e0b", onClick: () => setModal("schedule"),
    },
    {
      Icon: I.Screen, label: "Partager l'écran", desc: "Partage rapide sans rejoindre de salle",
      color: "#ec4899", badge: "Bêta", onClick: () => setModal("join"),
    },
  ];

  return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
            <button
                key={c.label}
                onClick={c.onClick}
                className="group relative flex flex-col items-start p-5 rounded-2xl text-left transition-all duration-300 hover:-translate-y-1 active:scale-[0.98]"
                style={{
                  background: `linear-gradient(150deg, ${c.color}14 0%, ${c.color}06 100%)`,
                  border: `1px solid ${c.color}22`,
                }}
            >
              {c.badge && (
                  <span className="absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: `${c.color}20`, color: c.color }}>
              {c.badge}
            </span>
              )}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                   style={{ background: `${c.color}18` }}>
                <c.Icon width={22} height={22} style={{ color: c.color }} />
              </div>
              <p className="text-sm font-bold text-white mb-1">{c.label}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{c.desc}</p>
              <span className="mt-4 flex items-center gap-1 text-xs font-semibold transition-all duration-200 group-hover:gap-2"
                    style={{ color: c.color }}>
            Lancer <I.Arrow width={13} height={13} />
          </span>
            </button>
        ))}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION : RÉUNIONS DU JOUR
// ═══════════════════════════════════════════════════════════

function MeetingCard({ meeting, onJoin }) {
  const isLive = meeting.status === "live";
  const style = isLive
      ? { border: "rgba(16,185,129,0.3)", bg: "rgba(16,185,129,0.05)", badge: "#10b981", badgeBg: "rgba(16,185,129,0.1)", label: "EN DIRECT" }
      : { border: "rgba(99,102,241,0.15)", bg: "rgba(99,102,241,0.03)", badge: "#818cf8", badgeBg: "rgba(99,102,241,0.1)", label: "À VENIR" };

  return (
      <div
          className="flex flex-col rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: style.bg, border: `1px solid ${style.border}` }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-[0.08em]"
              style={{ background: style.badgeBg, color: style.badge }}>
          {isLive && (
              <span className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ background: style.badge, animation: "liveP 1.5s ease-in-out infinite" }} />
          )}
          {style.label}
        </span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <I.Clock width={11} height={11} /> {meeting.time} · {meeting.duration}
        </span>
        </div>

        {/* Titre */}
        <h3 className="text-sm font-bold text-white mb-0.5">{meeting.title}</h3>
        <p className="text-xs text-slate-500 mb-4">Hôte : {meeting.host}</p>

        {/* Avatars */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex -space-x-2">
            {meeting.avatars.map((av, i) => (
                <div key={i}
                     className="w-7 h-7 rounded-full border-2 border-[#0d1322] flex items-center justify-center text-[9px] font-bold text-white"
                     style={{ background: av.startsWith("+") ? "#334155" : `hsl(${(av.charCodeAt(0) * 53) % 360},55%,38%)` }}>
                  {av}
                </div>
            ))}
          </div>
          <span className="text-[11px] text-slate-500">{meeting.participants} participants</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <button
              onClick={() => onJoin(meeting.id, "Moi", { asHost: false })}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={isLive
                  ? { background: "linear-gradient(135deg,#10b981,#059669)", color: "white" }
                  : { background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
            {isLive ? "Rejoindre maintenant" : "Préparer l'entrée"}
          </button>
          <button
              title="Copier le lien"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/room/${meeting.id}`)}
              className="px-3 py-2 rounded-xl text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all">
            <I.Copy width={14} height={14} />
          </button>
        </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION : HISTORIQUE RÉCENT
// ═══════════════════════════════════════════════════════════

function RecentMeetings({ meetings, loading, signedIn, onSelect }) {
  return (
      <div>
        <SectionHeader title="Mes réunions planifiées" />
        <div className="rounded-2xl overflow-hidden divide-y"
             style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          {!signedIn ? (
              <div className="px-5 py-6 text-sm text-slate-500">
                Connectez-vous comme administrateur pour afficher vos réunions planifiées.
              </div>
          ) : loading ? (
              <div className="px-5 py-6 text-sm text-slate-500">Chargement des réunions...</div>
          ) : meetings.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-500">
                Aucune réunion planifiée. Créez une réunion depuis le bouton Planifier.
              </div>
          ) : meetings.map((m) => (
              <button
                  key={m.roomId || m.id}
                  onClick={() => onSelect(m)}
                  className="flex items-center gap-4 w-full px-5 py-4 text-left hover:bg-white/[0.03] transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: "rgba(99,102,241,0.1)" }}>
                  <I.Video width={16} height={16} style={{ color: "#818cf8" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {getInviteeLabel(m)}
                    <span className="text-slate-500 font-medium"> · {m.title}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatMeetingDate(m.scheduledFor, m.timezone)} · {formatDuration(m.durationMinutes)} · {m.status || "scheduled"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.joinUrl && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7" }}>
                  LIEN PRÊT
                </span>
                  )}
                  <I.Arrow width={14} height={14} style={{ color: "#475569" }}
                           className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
          ))}
        </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION : CONTACTS RAPIDES
// ═══════════════════════════════════════════════════════════

function QuickContacts({ contacts, onAddContact, onHostMeeting }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(CONTACT_ROLES[0]);
  const [status, setStatus] = useState("");

  const callContact = (c) => {
    onHostMeeting(`Appel avec ${c.name}`);
  };

  const addContact = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const displayName = name.trim() || nameFromEmail(normalizedEmail);
    if (!displayName || !normalizedEmail.includes("@")) {
      setStatus("Nom et courriel valide requis.");
      return;
    }
    onAddContact({ name: displayName, email: normalizedEmail, role });
    setName("");
    setEmail("");
    setRole(CONTACT_ROLES[0]);
    setStatus("Contact ajouté.");
    setTimeout(() => setStatus(""), 2200);
  };

  return (
      <div>
        <SectionHeader title="Contacts" />
        <div className="rounded-2xl p-4 mb-3"
             style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div className="text-sm font-semibold text-white">Ajouter un contact</div>
          <div className="mt-3 space-y-2">
            <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom complet"
                className="meetra-input"
            />
            <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="courriel@exemple.com"
                className="meetra-input"
            />
            <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="meetra-input"
                style={{ background: "#0d1322" }}
            >
              {CONTACT_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {status && <div className="text-xs text-slate-400">{status}</div>}
            <button
                onClick={addContact}
                className="w-full py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              Ajouter le contact
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {contacts.length === 0 ? (
              <div className="rounded-xl px-4 py-5 text-sm text-slate-500"
                   style={{ border: "1px dashed rgba(255,255,255,0.08)" }}>
                Aucun contact. Planifiez une réunion avec un invité ou ajoutez un contact.
              </div>
          ) : contacts.map((c) => (
              <div key={c.email || c.name}
                   className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/[0.03] group"
                   style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
                <Avatar initials={getInitials(c.name, c.email)} color={c.color || colorFromText(c.email || c.name)} online={c.online} size={36} showStatus />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-tight">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">{c.role} · {c.email}</p>
                </div>
                <button
                    onClick={() => callContact(c)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                  <I.Video width={13} height={13} /> Appeler
                </button>
              </div>
          ))}
        </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════

function Stats() {
  const data = [
    { value: "3", label: "Réunions aujourd'hui", color: "#818cf8" },
    { value: "18", label: "Participants actifs", color: "#34d399" },
    { value: "2h14", label: "Temps en réunion", color: "#fbbf24" },
    { value: "99%", label: "Disponibilité serveur", color: "#f472b6" },
  ];
  return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.map((s) => (
            <div key={s.label}
                 className="rounded-2xl px-4 py-5 text-center"
                 style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] text-slate-500 leading-tight">{s.label}</p>
            </div>
        ))}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NAVBAR AVEC SOUS-MENUS
// ═══════════════════════════════════════════════════════════

function NavItem({ item }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
      <div ref={ref} className="relative">
        <button
            onMouseEnter={() => item.items.length && setOpen(true)}
            onMouseLeave={() => item.items.length && setOpen(false)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              color: item.active ? "#818cf8" : "rgba(148,163,184,0.85)",
              background: item.active ? "rgba(99,102,241,0.1)" : "transparent",
            }}
        >
          {item.label}
          {item.items.length > 0 && (
              <I.ChevronDown width={12} height={12}
                             style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
          )}
        </button>

        {item.items.length > 0 && open && (
            <div
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                className="absolute top-full left-0 mt-1 py-2 rounded-xl min-w-[200px] z-50"
                style={{
                  background: "rgba(11,16,30,0.98)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                  animation: "fadeD 0.15s ease-out",
                }}
            >
              {item.items.map((sub) => (
                  <button
                      key={sub.label}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors"
                      style={{ color: "rgba(148,163,184,0.8)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "white"; e.currentTarget.style.background = "rgba(99,102,241,0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(148,163,184,0.8)"; e.currentTarget.style.background = "transparent"; }}
                  >
                    <span className="text-base leading-none">{sub.icon}</span>
                    {sub.label}
                  </button>
              ))}
            </div>
        )}
      </div>
  );
}

function Navbar({ time, search, setSearch, auth, onOpenAccount }) {
  const [notif, setNotif] = useState(2);
  const initials = getInitials(auth.profile?.name, auth.profile?.email);

  return (
      <nav
          className="sticky top-0 z-40 flex items-center gap-4 px-6 py-3"
          style={{
            background: "rgba(5,8,16,0.88)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.055)",
          }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white"
               style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>M</div>
          <span className="text-base font-black tracking-tight hidden sm:block"
                style={{ background: "linear-gradient(135deg,#a5b4fc,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Meetra
        </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black"
                style={{ background: "rgba(16,185,129,0.12)", color: "#34d399" }}>BETA</span>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-0.5 flex-1">
          {NAV_MENU.map((item) => <NavItem key={item.label} item={item} />)}
        </div>

        {/* Recherche */}
        <div className="relative hidden lg:block">
          <I.Search width={14} height={14} style={{ color: "#475569", position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
          <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une réunion…"
              className="pl-8 pr-4 py-2 rounded-xl text-sm text-slate-300 placeholder-slate-600 outline-none transition-all w-52 focus:w-72"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          />
        </div>

        {/* Actions droite */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-600 hidden xl:block tabular-nums">{time}</span>
          <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
            <I.Bell width={16} height={16} />
            {notif > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full text-[9px] font-black text-white flex items-center justify-center"
                      style={{ background: "#6366f1" }}
                      onClick={() => setNotif(0)}>
              {notif}
            </span>
            )}
          </button>
          <button
               onClick={onOpenAccount}
               className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white cursor-pointer hover:opacity-80 transition-opacity"
               style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
               title={auth.profile?.email ? `${auth.profile?.name || "Compte Meetra"} — ${auth.profile?.email}` : "Ouvrir l'accès Meetra"}>
            {initials}
          </button>
        </div>
      </nav>
  );
}

// ═══════════════════════════════════════════════════════════
// HELPER : EN-TÊTE DE SECTION
// ═══════════════════════════════════════════════════════════

function SectionHeader({ title, action, onAction }) {
  return (
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">{title}</h2>
        {action && (
            <button onClick={onAction}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
              {action} <I.Arrow width={12} height={12} />
            </button>
        )}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PAGE PRINCIPALE : HOME
// ═══════════════════════════════════════════════════════════

export default function Home({ onJoin, prefillRoomId = "" }) {
  // onJoin(roomId, userName, { asHost }) — appelé par App.jsx
  // prefillRoomId            — pré-remplit le champ ID si on arrive via /room/:id
  const [modal, setModal] = useState(prefillRoomId ? "join" : null);          // "new"|"join"|"schedule"|"recent"
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [search, setSearch] = useState("");
  const [time, setTime] = useState(new Date());
  const [auth, setAuth] = useState(() => readStoredAuth());
  const [plannedMeetings, setPlannedMeetings] = useState([]);
  const [accountMeetings, setAccountMeetings] = useState([]);
  const [manualContacts, setManualContacts] = useState(() => readStoredContacts());
  const [meetingsLoading, setMeetingsLoading] = useState(false);

  // Horloge temps réel
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const syncAuth = () => setAuth(readStoredAuth());
    window.addEventListener("storage", syncAuth);
    window.addEventListener("meetra-auth-changed", syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("meetra-auth-changed", syncAuth);
    };
  }, []);

  const openRecent = useCallback((m) => {
    setSelectedMeeting(m);
    setModal("recent");
  }, []);

  const loadPlannedMeetings = useCallback(async (tokenOverride = auth.token) => {
    if (!tokenOverride) {
      setPlannedMeetings([]);
      setAccountMeetings([]);
      return;
    }

    setMeetingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/meetings?limit=12`, {
        headers: { authorization: `Bearer ${tokenOverride}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPlannedMeetings([]);
        setAccountMeetings([]);
        return;
      }
      const meetings = uniqueMeetingsByRoom(data.meetings);
      setAccountMeetings(meetings);
      setPlannedMeetings(meetings.filter((meeting) => meeting.scheduledFor));
    } catch {
      setPlannedMeetings([]);
      setAccountMeetings([]);
    } finally {
      setMeetingsLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    loadPlannedMeetings(auth.token);
  }, [auth.token, loadPlannedMeetings]);

  const createMeetingRequest = useCallback(async ({ title, scheduledFor = null, durationMinutes = 60, inviteeEmails = [] }) => {
    if (!auth.token) {
      throw new Error("Connectez-vous avec votre accès Meetra pour créer une réunion.");
    }

    const res = await fetch(`${API_URL}/api/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        title,
        scheduledFor,
        durationMinutes,
        inviteeEmails,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
          data.error === "UNAUTHENTICATED"
              ? "Votre session Meetra a expiré. Reconnectez-vous pour créer une réunion."
              : "Le serveur n'a pas pu enregistrer la réunion."
      );
    }

    const meeting = {
      ...data,
      joinUrl: data.joinUrl || buildPublicRoomUrl(data.roomId),
    };
    if (meeting.scheduledFor) {
      setPlannedMeetings((current) => uniqueMeetingsByRoom([meeting, ...current]).slice(0, 12));
    }
    setAccountMeetings((current) => uniqueMeetingsByRoom([meeting, ...current]).slice(0, 20));
    return meeting;
  }, [auth.token]);

  const contacts = useMemo(() => {
    const map = new Map();
    const add = (contact) => {
      const email = String(contact.email || "").trim().toLowerCase();
      if (!email || email === auth.profile?.email) return;
      map.set(email, {
        name: contact.name || nameFromEmail(email),
        email,
        role: contact.role || "Invité de réunion",
        online: Boolean(contact.online),
        color: contact.color || colorFromText(email),
      });
    };

    accountMeetings.forEach((meeting) => {
      (meeting.inviteeEmails || []).forEach((email) => {
        add({ email, role: meeting.scheduledFor ? "Invité planifié" : "Invité de réunion" });
      });
    });
    manualContacts.forEach(add);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [accountMeetings, manualContacts, auth.profile?.email]);

  const handleAddContact = useCallback((contact) => {
    setManualContacts((current) => {
      const normalizedEmail = contact.email.trim().toLowerCase();
      const next = [
        {
          ...contact,
          email: normalizedEmail,
          color: colorFromText(normalizedEmail),
          online: false,
        },
        ...current.filter((item) => String(item.email || "").trim().toLowerCase() !== normalizedEmail),
      ];
      persistContacts(next);
      return next;
    });
  }, []);

  const handleQuickHostMeeting = useCallback(async (title = "Réunion Meetra") => {
    if (!auth.token) {
      setModal("account");
      return;
    }

    try {
      const meeting = await createMeetingRequest({ title, durationMinutes: 60 });
      onJoin(meeting.roomId, auth.profile?.name || "Hôte Meetra", { asHost: true });
    } catch {
      setModal("account");
    }
  }, [auth, createMeetingRequest, onJoin]);

  const handleOpenScheduledMeeting = useCallback((meeting) => {
    const roomId = meeting?.roomId || meeting?.id;
    if (!roomId) return;
    onJoin(roomId, auth.profile?.name || "Administrateur Meetra", { asHost: true });
  }, [auth.profile?.name, onJoin]);

  const fmtTime = time.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtDate = time.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Filtrage avec la barre de recherche
  const filteredMeetings = search
      ? MEETINGS_TODAY.filter((m) =>
          m.title.toLowerCase().includes(search.toLowerCase()) ||
          m.host.toLowerCase().includes(search.toLowerCase())
      )
      : MEETINGS_TODAY;

  return (
      <div style={{ minHeight: "100vh", overflowY: "auto", overflowX: "hidden", position: "relative" }}>
        {/* ── CSS global injecté ─────────────────────────────── */}
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Forcer le scroll sur toute la page ── */
        html, body {
          height: auto !important;
          min-height: 100vh;
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }

        /* Annuler tout overflow:hidden que index.css ou App.css pourrait avoir mis */
        #root {
          height: auto !important;
          min-height: 100vh;
          overflow: visible !important;
        }

        body {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #050810;
          color: #e2e8f0;
        }

        .meetra-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 10px 14px;
          color: #e2e8f0;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .meetra-input::placeholder { color: #334155; }
        .meetra-input:focus {
          border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        @keyframes modalIn {
          from { opacity:0; transform:scale(0.94) translateY(12px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes fadeD {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes liveP {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:0.3; transform:scale(1.4); }
        }
        @keyframes heroFade {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .hero-animate { animation: heroFade 0.5s ease-out both; }
        .hero-animate:nth-child(2) { animation-delay: 0.08s; }
        .hero-animate:nth-child(3) { animation-delay: 0.16s; }
        .hero-animate:nth-child(4) { animation-delay: 0.24s; }
        .hero-animate:nth-child(5) { animation-delay: 0.32s; }
        .hero-animate:nth-child(6) { animation-delay: 0.40s; }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

        {/* ── FOND RADIAL ─────────────────────────────────────── */}
        <div className="fixed inset-0 pointer-events-none z-0" style={{
          background: "radial-gradient(ellipse 90% 45% at 50% -5%, rgba(99,102,241,0.11) 0%, transparent 65%)",
        }} />

        {/* ── NAVBAR ──────────────────────────────────────────── */}
        <Navbar time={fmtTime} search={search} setSearch={setSearch} auth={auth} onOpenAccount={() => setModal("account")} />

        {/* ── CONTENU ─────────────────────────────────────────── */}
        <main className="relative z-10 max-w-5xl mx-auto px-5 pb-20">

          {/* HERO : horloge */}
          <div className="text-center py-14 hero-animate">
            <p className="text-6xl font-black text-white tracking-tight tabular-nums mb-2"
               style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmtTime}
            </p>
            <p className="text-slate-500 text-sm capitalize">{fmtDate}</p>
          </div>

          {/* 4 CARDS D'ACTION */}
          <div className="hero-animate">
            <SectionHeader title="Actions rapides" />
            <ActionCards setModal={setModal} />
          </div>

          {/* STATS */}
          <div className="mt-8 hero-animate">
            <SectionHeader title="Aperçu du jour" />
            <Stats />
          </div>

          {/* RÉUNIONS DU JOUR */}
          <div className="mt-8 hero-animate">
            <SectionHeader title="Réunions du jour" action="Tout voir" />
            {filteredMeetings.length === 0 ? (
                <div className="text-center py-10 rounded-2xl" style={{ border: "1px dashed rgba(255,255,255,0.07)" }}>
                  <p className="text-slate-500 text-sm">Aucune réunion trouvée pour « {search} »</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {filteredMeetings.map((m) => (
                      <MeetingCard key={m.id} meeting={m} onJoin={onJoin} />
                  ))}
                </div>
            )}
          </div>

          {/* HISTORIQUE + CONTACTS (2 colonnes sur grand écran) */}
          <div className="mt-8 grid lg:grid-cols-5 gap-6 hero-animate">
            <div className="lg:col-span-3">
              <RecentMeetings
                  meetings={plannedMeetings}
                  loading={meetingsLoading}
                  signedIn={Boolean(auth.token)}
                  onSelect={openRecent}
              />
            </div>
            <div className="lg:col-span-2">
              <QuickContacts
                  contacts={contacts}
                  onAddContact={handleAddContact}
                  onHostMeeting={handleQuickHostMeeting}
              />
            </div>
          </div>

          {/* BADGE PROJET */}
          <div className="mt-8 rounded-2xl px-5 py-4 flex flex-wrap gap-4 items-center justify-between hero-animate"
               style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)" }}>
            <div>
              <p className="text-sm font-bold text-white">Meetra — LaSalle College · TT4 Winter 2026</p>
              <p className="text-xs text-slate-500 mt-0.5">
                WebRTC P2P · Socket.IO · Vite · React · Vercel + Render · Electron · coturn
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["WebRTC", "TURN/STUN", "Breakout", "Enregistrement", "Tableau blanc", "IA Transcription"].map((f) => (
                  <span key={f} className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                {f}
              </span>
              ))}
            </div>
          </div>

        </main>

        {/* ── MODALS ──────────────────────────────────────────── */}
        <AccountModal open={modal === "account"} onClose={() => setModal(null)} auth={auth} onSessionChange={setAuth} />
        <NewMeetingModal open={modal === "new"}      onClose={() => setModal(null)} onJoin={onJoin} auth={auth} onOpenAccount={() => setModal("account")} onCreateMeeting={createMeetingRequest} />
        <JoinModal       open={modal === "join"}     onClose={() => setModal(null)} onJoin={onJoin} prefillRoomId={prefillRoomId} />
        <ScheduleModal   open={modal === "schedule"} onClose={() => setModal(null)} auth={auth} onOpenAccount={() => setModal("account")} onCreateMeeting={createMeetingRequest} />
        <RecentDetailModal
            open={modal === "recent"}
            onClose={() => setModal(null)}
            meeting={selectedMeeting}
            onHostMeeting={handleOpenScheduledMeeting}
            auth={auth}
        />
      </div>
  );
}
