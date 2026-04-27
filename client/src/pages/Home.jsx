import { useEffect, useState } from 'react';
import { getApiUrl } from '../utils/appConfig.js';
import { CalendarIcon, DoorExitIcon, LinkIcon, SettingsIcon, ShieldLockIcon, UsersIcon, VideoAppIcon } from '../components/common/AppIcons.jsx';

const API_URL = getApiUrl();
const DEFAULT_DURATION_MINUTES = 60;

function generateFallbackRoomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `room-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeRoomInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/room\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : raw;
  } catch {
    const match = raw.match(/\/room\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : raw;
  }
}

function getDefaultScheduleDate() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  return now.toISOString().slice(0, 10);
}

function getDefaultScheduleTime() {
  return '09:00';
}

function buildScheduledIso(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  return new Date(`${dateValue}T${timeValue}:00`).toISOString();
}

function formatScheduledMeeting(dateIso, timezone) {
  if (!dateIso) return 'Date à confirmer';

  try {
    return new Intl.DateTimeFormat('fr-CA', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(new Date(dateIso));
  } catch {
    return dateIso;
  }
}

function FeatureCard({ icon, title, body }) {
  return (
    <div className="meetra-surface-soft rounded-[22px] p-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-blue-500/12 text-blue-100">
        {icon}
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-50">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-400">{body}</div>
    </div>
  );
}

export default function Home({ onJoin, prefillRoomId = '' }) {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState(prefillRoomId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [copied, setCopied] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('Réunion Meetra');
  const [scheduledDate, setScheduledDate] = useState(getDefaultScheduleDate);
  const [scheduledTime, setScheduledTime] = useState(getDefaultScheduleTime);
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto');
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState('');
  const [editForm, setEditForm] = useState({ title: '', date: '', time: '' });

  const loadRecentMeetings = async () => {
    setLoadingRecent(true);
    try {
      const res = await fetch(`${API_URL}/api/meetings?limit=6`);
      const data = await res.json().catch(() => ({ meetings: [] }));
      if (res.ok) {
        setRecentMeetings(data.meetings || []);
      }
    } catch {
      setRecentMeetings([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  const createRoomRequest = async ({ includeSchedule = false } = {}) => {
    const scheduledFor = includeSchedule ? buildScheduledIso(scheduledDate, scheduledTime) : null;
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingTitle.trim() || 'Réunion Meetra',
          scheduledFor,
          timezone,
          durationMinutes: DEFAULT_DURATION_MINUTES,
          hostName: userName.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.roomId) {
        throw new Error(data?.error || `ROOM_CREATE_FAILED_${res.status}`);
      }

      return {
        roomId: data.roomId,
        joinUrl: data.joinUrl || `${window.location.origin}/room/${data.roomId}`,
        title: data.title || meetingTitle.trim() || 'Réunion Meetra',
        scheduledFor: data.scheduledFor || scheduledFor,
        timezone: data.timezone || timezone,
        durationMinutes: data.durationMinutes || DEFAULT_DURATION_MINUTES,
        hostName: data.hostName || userName.trim() || null,
      };
    } catch {
      const fallbackRoomId = generateFallbackRoomId();
      return {
        roomId: fallbackRoomId,
        joinUrl: `${window.location.origin}/room/${fallbackRoomId}`,
        title: meetingTitle.trim() || 'Réunion Meetra',
        scheduledFor,
        timezone,
        durationMinutes: DEFAULT_DURATION_MINUTES,
        hostName: userName.trim() || null,
      };
    }
  };

  const beginEditMeeting = (meeting) => {
    const nextDate = meeting?.scheduledFor ? new Date(meeting.scheduledFor) : null;
    setEditingRoomId(meeting.roomId);
    setEditForm({
      title: meeting.title || 'Réunion Meetra',
      date: nextDate ? nextDate.toISOString().slice(0, 10) : getDefaultScheduleDate(),
      time: nextDate ? nextDate.toISOString().slice(11, 16) : getDefaultScheduleTime(),
    });
  };

  const saveMeetingEdit = async (roomIdToUpdate) => {
    const scheduledFor = buildScheduledIso(editForm.date, editForm.time);
    if (!scheduledFor || new Date(`${editForm.date}T${editForm.time}:00`).getTime() <= Date.now()) {
      setError('Choisissez une nouvelle date/heure future pour la réunion.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomIdToUpdate}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim() || 'Réunion Meetra',
          scheduledFor,
          timezone,
          durationMinutes: DEFAULT_DURATION_MINUTES,
        }),
      });
      const updated = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(updated?.error || `ROOM_UPDATE_FAILED_${res.status}`);
      }

      setRecentMeetings((current) => current.map((meeting) => (
        meeting.roomId === roomIdToUpdate ? { ...meeting, ...updated } : meeting
      )));
      if (createdMeeting?.roomId === roomIdToUpdate) {
        setCreatedMeeting((current) => ({ ...current, ...updated }));
      }
      setEditingRoomId('');
    } catch {
      setError('Impossible de modifier cette réunion planifiée.');
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!userName.trim()) {
      setError('Entrez votre nom.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const meeting = await createRoomRequest({ includeSchedule: false });
      setCreatedMeeting(meeting);
      loadRecentMeetings();
      onJoin(meeting.roomId, userName.trim());
    } finally {
      setLoading(false);
    }
  };

  const scheduleRoom = async () => {
    if (!userName.trim()) {
      setError('Entrez votre nom.');
      return;
    }
    if (!meetingTitle.trim()) {
      setError('Entrez un titre de réunion.');
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      setError('Choisissez une date et une heure pour planifier la réunion.');
      return;
    }
    if (new Date(`${scheduledDate}T${scheduledTime}:00`).getTime() <= Date.now()) {
      setError('Choisissez une date et une heure futures pour la planification.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const meeting = await createRoomRequest({ includeSchedule: true });
      setCreatedMeeting(meeting);
      loadRecentMeetings();
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!userName.trim()) {
      setError('Entrez votre nom.');
      return;
    }
    const normalizedRoomId = normalizeRoomInput(roomId);
    if (!normalizedRoomId) {
      setError("Entrez l'ID ou le lien de la salle.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/rooms/${normalizedRoomId}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || `ROOM_LOOKUP_FAILED_${res.status}`);
      }

      if (data.exists) {
        onJoin(normalizedRoomId, userName.trim());
      } else {
        setError("Cette salle n'existe pas ou a expiré.");
      }
    } catch {
      onJoin(normalizedRoomId, userName.trim());
    } finally {
      setLoading(false);
    }
  };

  const copyCreatedLink = async () => {
    if (!createdMeeting?.joinUrl) return;
    await navigator.clipboard.writeText(createdMeeting.joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enterCreatedRoom = () => {
    if (!userName.trim()) {
      setError('Entrez votre nom pour entrer comme hôte.');
      return;
    }

    onJoin(createdMeeting.roomId, userName.trim());
  };

  useEffect(() => {
    if (prefillRoomId) return;
    loadRecentMeetings();
  }, [prefillRoomId]);

  return (
    <div className="meetra-shell min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="meetra-surface rounded-[32px] px-6 py-8 md:px-10 md:py-10">
          <div className="meetra-section-label">Workspace vidéo</div>
          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-blue-300/15 bg-gradient-to-br from-blue-500/18 to-emerald-400/12 text-blue-50 shadow-[0_22px_50px_rgba(37,99,235,0.22)]">
              <VideoAppIcon size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-50 md:text-5xl">Meetra</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                Une expérience de réunion claire, structurée et prête pour le web public: admission d’invités, partage d’écran, transcription, chat et rôles hôte dans un shell plus professionnel.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <FeatureCard
              icon={<ShieldLockIcon size={18} />}
              title="Contrôles hôte"
              body="Admission, verrouillage de salle et gouvernance simple depuis l’interface principale."
            />
            <FeatureCard
              icon={<CalendarIcon size={18} />}
              title="Réunions planifiées"
              body="Créez un lien public à l’avance, partagez-le puis rejoignez la même salle plus tard."
            />
            <FeatureCard
              icon={<SettingsIcon size={18} />}
              title="Préférences centralisées"
              body="Caméra, micro, sous-titres et confort de réunion regroupés comme dans un vrai produit."
            />
          </div>

          <div className="mt-8 grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2">
            <div>
              <div className="text-sm font-semibold text-slate-100">Conçu pour un flux simple</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                1. Préparez le lien. 2. Envoyez-le. 3. Ouvrez la salle. 4. Admettez les invités. 5. Lancez le partage et la transcription si nécessaire.
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">Usage recommandé</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                {['Liens publics', 'Salle d’attente', 'Chat temps réel', 'Sous-titres', 'Tableau', 'Réactions'].map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1.5">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="meetra-surface rounded-[32px] p-6 md:p-8">
          {prefillRoomId && (
            <div className="mb-5 rounded-[22px] border border-blue-400/18 bg-blue-500/10 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-blue-500/14 text-blue-100">
                  <LinkIcon size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-blue-100">Invitation reçue</div>
                  <div className="mt-1 text-sm leading-6 text-slate-300">Entrez votre nom pour rejoindre directement cette réunion.</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="meetra-section-label">Votre nom</label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (prefillRoomId ? joinRoom(e) : null)}
              placeholder="ex: Alice Tremblay"
              autoFocus
              className="meetra-focus-ring mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
            />
          </div>

          {!prefillRoomId && createdMeeting && (
            <div className="mt-5 rounded-[24px] border border-emerald-400/16 bg-emerald-500/10 px-4 py-4">
              <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-emerald-500/15 text-emerald-100">
                  <CalendarIcon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-emerald-100">{createdMeeting.title || 'Réunion prête à être partagée'}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-300">
                    Planifiée pour le {formatScheduledMeeting(createdMeeting.scheduledFor, createdMeeting.timezone)}.
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 bg-slate-950/40 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Fuseau</div>
                  <div className="mt-2 text-sm font-semibold text-slate-100">{createdMeeting.timezone || timezone}</div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-slate-950/40 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Durée prévue</div>
                  <div className="mt-2 text-sm font-semibold text-slate-100">{createdMeeting.durationMinutes || DEFAULT_DURATION_MINUTES} minutes</div>
                </div>
              </div>
              <div className="mt-4">
                <label className="meetra-section-label">Lien d’accès</label>
                <input
                  value={createdMeeting.joinUrl}
                  readOnly
                  className="mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 font-mono text-sm text-slate-200"
                />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={copyCreatedLink}
                  className="meetra-button meetra-focus-ring flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-100"
                >
                  <LinkIcon size={15} />
                  {copied ? 'Lien copié' : 'Copier le lien'}
                </button>
                <button
                  onClick={enterCreatedRoom}
                  className="meetra-button meetra-button-primary meetra-focus-ring flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white"
                >
                  <VideoAppIcon size={15} />
                  Entrer comme hôte
                </button>
              </div>
            </div>
          )}

          {prefillRoomId ? (
            <div className="mt-5 space-y-4">
              <div>
                <label className="meetra-section-label">Salle</label>
                <input
                  value={roomId}
                  readOnly
                  className="mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/45 px-4 py-3 font-mono text-sm text-slate-400"
                />
              </div>
              <button
                onClick={joinRoom}
                disabled={loading}
                className="meetra-button meetra-button-primary meetra-focus-ring flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <VideoAppIcon size={16} />
                {loading ? 'Connexion...' : 'Rejoindre la réunion'}
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-blue-500/14 text-blue-100">
                    <CalendarIcon size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Planifier une vraie réunion</div>
                    <div className="mt-1 text-sm leading-6 text-slate-400">
                      Donnez un titre, une date et une heure. Meetra générera ensuite un lien public à partager à l’avance.
                    </div>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div>
                    <label className="meetra-section-label">Titre de la réunion</label>
                    <input
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder="ex: Rencontre de suivi TT4"
                      className="meetra-focus-ring mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="meetra-section-label">Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="meetra-focus-ring mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="meetra-section-label">Heure</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="meetra-focus-ring mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400"
                      />
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Prévisualisation</div>
                    <div className="mt-2 font-semibold text-slate-100">
                      {meetingTitle.trim() || 'Réunion Meetra'}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {formatScheduledMeeting(buildScheduledIso(scheduledDate, scheduledTime), timezone)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Fuseau: {timezone} · Durée par défaut: {DEFAULT_DURATION_MINUTES} minutes
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={createRoom}
                  disabled={loading}
                  className="meetra-button meetra-button-primary meetra-focus-ring flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <VideoAppIcon size={16} />
                  {loading ? 'Création...' : 'Créer et démarrer'}
                </button>
                <button
                  onClick={scheduleRoom}
                  disabled={loading}
                  className="meetra-button meetra-focus-ring flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-slate-100 disabled:opacity-60"
                >
                  <CalendarIcon size={16} />
                  {loading ? 'Planification...' : 'Planifier la réunion'}
                </button>
              </div>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">ou rejoindre une salle</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={joinRoom} className="space-y-3">
                <div>
                  <label className="meetra-section-label">ID ou lien public</label>
                  <input
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Coller l’ID ou l’URL de réunion"
                    className="meetra-focus-ring mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="meetra-button meetra-focus-ring flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-slate-100 disabled:opacity-60"
                >
                  <DoorExitIcon size={16} />
                  Rejoindre la salle
                </button>
              </form>

              <div className="rounded-[24px] border border-white/10 bg-slate-950/45 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="meetra-section-label">Réunions planifiées récentes</div>
                    <div className="mt-1 text-sm text-slate-400">Modifiez rapidement une réunion déjà préparée et récupérez son lien.</div>
                  </div>
                  <button
                    type="button"
                    onClick={loadRecentMeetings}
                    className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    {loadingRecent ? 'Actualisation...' : 'Actualiser'}
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {recentMeetings.length === 0 ? (
                    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                      Aucune réunion récente à afficher pour le moment.
                    </div>
                  ) : (
                    recentMeetings.map((meeting) => (
                      <div key={meeting.roomId} className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-100">{meeting.title || 'Réunion Meetra'}</div>
                            <div className="mt-1 text-sm text-slate-400">
                              {formatScheduledMeeting(meeting.scheduledFor, meeting.timezone)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {meeting.hostName ? `Hôte prévu: ${meeting.hostName}` : 'Hôte non renseigné'} · {meeting.durationMinutes || DEFAULT_DURATION_MINUTES} min
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => beginEditMeeting(meeting)}
                            className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-slate-200"
                          >
                            Modifier
                          </button>
                        </div>

                        {editingRoomId === meeting.roomId && (
                          <div className="mt-4 grid gap-3 rounded-[18px] border border-blue-400/14 bg-blue-500/8 p-4">
                            <div>
                              <label className="meetra-section-label">Titre</label>
                              <input
                                value={editForm.title}
                                onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value }))}
                                className="meetra-focus-ring mt-2 w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400"
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="meetra-section-label">Date</label>
                                <input
                                  type="date"
                                  value={editForm.date}
                                  onChange={(e) => setEditForm((current) => ({ ...current, date: e.target.value }))}
                                  className="meetra-focus-ring mt-2 w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400"
                                />
                              </div>
                              <div>
                                <label className="meetra-section-label">Heure</label>
                                <input
                                  type="time"
                                  value={editForm.time}
                                  onChange={(e) => setEditForm((current) => ({ ...current, time: e.target.value }))}
                                  className="meetra-focus-ring mt-2 w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => saveMeetingEdit(meeting.roomId)}
                                className="meetra-button meetra-button-primary meetra-focus-ring px-4 py-3 text-sm font-semibold text-white"
                              >
                                Enregistrer
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingRoomId('')}
                                className="meetra-button meetra-focus-ring px-4 py-3 text-sm font-semibold text-slate-200"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(meeting.joinUrl);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-slate-200"
                          >
                            {copied ? 'Lien copié' : 'Copier le lien'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!userName.trim()) {
                                setError('Entrez votre nom pour rejoindre la réunion planifiée.');
                                return;
                              }
                              onJoin(meeting.roomId, userName.trim());
                            }}
                            className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-slate-200"
                          >
                            Rejoindre
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-[18px] border border-red-400/18 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {!prefillRoomId && (
            <div className="mt-6 rounded-[24px] border border-white/10 bg-slate-950/45 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <UsersIcon size={16} />
                Expérience recommandée
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Préparez votre nom, créez la salle, copiez le lien public, puis utilisez les contrôles hôte et le nouveau panneau Paramètres une fois en réunion.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
