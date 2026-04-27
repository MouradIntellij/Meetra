import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../utils/appConfig.js';
import { ArrowRightIcon, BuildingIcon, CalendarIcon, CalendarPlusIcon, CheckCircleIcon, ChatBubbleIcon, DoorExitIcon, GlobeIcon, LinkIcon, MailCalendarIcon, PhoneIcon, SearchIcon, SettingsIcon, ShieldLockIcon, SparkIcon, TranscriptIcon, UsersIcon, VideoAppIcon, WhiteboardIcon } from '../components/common/AppIcons.jsx';

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

function HeroStat({ value, label }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-slate-950/45 px-4 py-4">
      <div className="text-2xl font-semibold tracking-tight text-slate-50">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}

function ProductLane({ title, body, tags, accent = 'blue' }) {
  const accentClass = accent === 'emerald'
    ? 'from-emerald-400/18 to-cyan-400/10'
    : accent === 'amber'
      ? 'from-amber-400/18 to-orange-400/10'
      : 'from-blue-500/18 to-indigo-400/10';

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/55">
      <div className={`h-36 bg-gradient-to-br ${accentClass} p-5`}>
        <div className="max-w-[15rem] rounded-[20px] border border-white/10 bg-slate-950/55 p-4 shadow-[0_20px_44px_rgba(2,6,23,0.25)] backdrop-blur">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Meetra</div>
          <div className="mt-2 text-sm font-semibold text-slate-100">{title}</div>
          <div className="mt-2 h-2 w-20 rounded-full bg-white/15" />
          <div className="mt-2 h-2 w-28 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="p-5">
        <div className="text-base font-semibold text-slate-50">{title}</div>
        <div className="mt-2 text-sm leading-6 text-slate-400">{body}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="meetra-badge">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function NavMenuButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`meetra-focus-ring inline-flex items-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold transition ${
        active
          ? 'bg-white/10 text-slate-50 shadow-[0_14px_30px_rgba(2,6,23,0.22)]'
          : 'text-slate-300 hover:bg-white/[0.05] hover:text-slate-100'
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs transition ${active ? 'rotate-180' : ''}`}>▾</span>
    </button>
  );
}

function NavDropdown({ title, items, onSelect }) {
  const iconMap = {
    meetings: VideoAppIcon,
    hub: UsersIcon,
    chat: ChatBubbleIcon,
    phone: PhoneIcon,
    whiteboard: WhiteboardIcon,
    scheduler: CalendarIcon,
    schedulerPlus: CalendarPlusIcon,
    rooms: BuildingIcon,
    mail: MailCalendarIcon,
    docs: TranscriptIcon,
    platform: GlobeIcon,
    alerts: SparkIcon,
    settings: SettingsIcon,
  };

  return (
    <div className="grid gap-5 rounded-[30px] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)] xl:grid-cols-[0.85fr_1.15fr]">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{title}</div>
        <div className="mt-3 text-lg font-semibold text-slate-900">Découvrir la plateforme Meetra</div>
        <div className="mt-3 text-sm leading-6 text-slate-600">
          Explore les principaux espaces Meetra comme une vraie plateforme produit.
        </div>
        <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Pensé pour le web public</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            Réunions planifiées, admissions d’invités, co-hôte et sous-titres, dans une navigation plus claire dès la page d’accueil.
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => onSelect?.(item.sectionId)}
            className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300/60 hover:bg-blue-50/60"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-blue-50 text-blue-700">
                {(() => {
                  const Icon = iconMap[item.icon] || SparkIcon;
                  return <Icon size={18} />;
                })()}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{item.body}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LaunchMeetingDropdown({ onJoinMeeting, onHostMeeting }) {
  return (
    <div className="grid gap-5 rounded-[30px] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)] xl:grid-cols-[0.85fr_1.15fr]">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">lancer une réunion</div>
        <div className="mt-3 text-lg font-semibold text-slate-900">Choisir votre point d’entrée</div>
        <div className="mt-3 text-sm leading-6 text-slate-600">
          Rejoignez rapidement une salle existante ou ouvrez le planificateur pour organiser une nouvelle réunion.
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onJoinMeeting}
          className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300/60 hover:bg-blue-50/60"
        >
          <div className="text-sm font-semibold text-slate-900">Participer à une réunion</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">
            Aller directement au formulaire de participation avec ID ou lien public.
          </div>
        </button>
        <button
          type="button"
          onClick={onHostMeeting}
          className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300/60 hover:bg-blue-50/60"
        >
          <div className="text-sm font-semibold text-slate-900">Organiser une réunion</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">
            Ouvrir la zone de planification pour créer ou planifier une réunion.
          </div>
        </button>
      </div>
    </div>
  );
}

function ProductShowcase({ sectionId, icon, title, body, bullets, accent = 'blue', mockTitle, mockLines = [], mockBadges = [] }) {
  const accentClass = accent === 'emerald'
    ? 'from-emerald-500/18 to-cyan-400/8'
    : accent === 'amber'
      ? 'from-amber-500/18 to-orange-400/8'
      : 'from-blue-500/18 to-indigo-400/8';

  return (
    <section id={sectionId} className={`overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br ${accentClass} p-[1px]`}>
      <div className="rounded-[29px] bg-slate-950/92 p-6">
        <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr] xl:items-center">
          <div>
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-blue-500/12 text-blue-100">
                {icon}
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-slate-50">{title}</div>
                <div className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">{body}</div>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {bullets.map((bullet) => (
                <div key={bullet} className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
                  {bullet}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.96))] p-5 shadow-[0_28px_60px_rgba(2,6,23,0.34)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Preview</div>
                <div className="mt-2 text-sm font-semibold text-slate-100">{mockTitle || title}</div>
              </div>
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-3">
                {mockLines.map((line, index) => (
                  <div key={`${line}-${index}`} className="rounded-[16px] border border-white/8 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                    {line}
                  </div>
                ))}
              </div>
              {mockBadges.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {mockBadges.map((badge) => (
                    <span key={badge} className="meetra-badge">
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CapabilityShowcase({ sectionId, icon, title, body, items, accent = 'blue' }) {
  const accentClass = accent === 'emerald'
    ? 'from-emerald-500/18 to-cyan-400/8'
    : accent === 'amber'
      ? 'from-amber-500/18 to-orange-400/8'
      : 'from-blue-500/18 to-indigo-400/8';

  return (
    <section id={sectionId} className={`overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br ${accentClass} p-[1px]`}>
      <div className="rounded-[29px] bg-slate-950/92 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-blue-500/12 text-blue-100">
            {icon}
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight text-slate-50">{title}</div>
            <div className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">{body}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div key={item.title} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-slate-100">{item.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{item.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ quote, author, role }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
      <div className="text-base leading-7 text-slate-200">“{quote}”</div>
      <div className="mt-5 text-sm font-semibold text-slate-100">{author}</div>
      <div className="mt-1 text-sm text-slate-500">{role}</div>
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
  const [copiedMeetingId, setCopiedMeetingId] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('Réunion Meetra');
  const [scheduledDate, setScheduledDate] = useState(getDefaultScheduleDate);
  const [scheduledTime, setScheduledTime] = useState(getDefaultScheduleTime);
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto');
  const [hostEmail, setHostEmail] = useState('');
  const [hostPhone, setHostPhone] = useState('');
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState('');
  const [editForm, setEditForm] = useState({ title: '', date: '', time: '' });
  const [openMenu, setOpenMenu] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef(null);

  const navMenus = {
    produits: [
      { title: 'Meetings', body: 'Réunions vidéo, admission, co-hôte, partage et sous-titres dans une seule expérience.', icon: 'meetings', sectionId: 'product-meetings' },
      { title: 'Phone', body: 'Appels, coordination d’équipe et base de communication unifiée à faire évoluer.', icon: 'phone', sectionId: 'product-phone' },
      { title: 'Whiteboard', body: 'Tableau blanc collaboratif pour expliquer, dessiner et structurer une session.', icon: 'whiteboard', sectionId: 'product-whiteboard' },
      { title: 'Chat', body: 'Messagerie contextuelle intégrée à la salle pour garder les échanges visibles.', icon: 'chat', sectionId: 'product-chat' },
      { title: 'Rooms', body: 'Vision d’espaces, salles et présence hybride pour une plateforme plus complète.', icon: 'rooms', sectionId: 'product-rooms' },
      { title: 'Mail & Calendar', body: 'Pont naturel entre la planification, les invitations et les rappels de réunion.', icon: 'mail', sectionId: 'product-mail-calendar' },
      { title: 'Scheduler', body: 'Création de réunions avec date, heure, lien public et notifications hôte.', icon: 'schedulerPlus', sectionId: 'meetra-planner' },
      { title: 'AI Docs', body: 'Sous-titres, résumé et base documentaire évolutive à partir de la transcription.', icon: 'docs', sectionId: 'meetra-product' },
    ],
    plateforme: [
      { title: 'Accueil produit', body: 'Page d’entrée plus vivante avec sections, navigation et appels à l’action.', icon: 'platform', sectionId: 'platform-experience' },
      { title: 'Salle d’attente', body: 'Réception des invités avant admission avec contrôles hôte et co-hôte.', icon: 'hub', sectionId: 'platform-experience' },
      { title: 'Transcription', body: 'Base de sous-titres et résumé prête pour une future traduction live.', icon: 'docs', sectionId: 'platform-ai' },
      { title: 'Webhooks', body: 'Notifications hôte et intégration email via services externes.', icon: 'alerts', sectionId: 'platform-ai' },
    ],
    ressources: [
      { title: 'Réunions récentes', body: 'Retrouver rapidement un lien planifié et modifier une réunion existante.', icon: 'scheduler', sectionId: 'resources-operations' },
      { title: 'Pré-test audio/vidéo', body: 'Tester caméra, micro et haut-parleurs avant de rejoindre.', icon: 'meetings', sectionId: 'resources-operations' },
      { title: 'Paramètres', body: 'Panneau centralisé pour caméra, micro, sous-titres et préférences.', icon: 'settings', sectionId: 'resources-operations' },
      { title: 'Évolutions IA', body: 'Résumé, transcription enrichie, et future traduction temps réel.', icon: 'docs', sectionId: 'resources-guidance' },
    ],
    lancer: [
      { title: 'Participer à une réunion', body: 'Rejoindre une salle existante avec un ID ou un lien public.' },
      { title: 'Organiser une réunion', body: 'Créer tout de suite ou planifier une réunion avec date, heure et notifications.' },
    ],
  };

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpenMenu('');
    setSearchOpen(false);
  };

  const openJoinMeeting = () => {
    scrollToSection('meetra-join');
  };

  const openHostMeeting = () => {
    scrollToSection('meetra-planner');
  };

  const searchItems = [
    { id: 'organiser', label: 'Organiser une réunion', sectionId: 'meetra-planner' },
    { id: 'participer', label: 'Participer à une réunion', sectionId: 'meetra-join' },
    { id: 'recent', label: 'Réunions récentes', sectionId: 'meetra-recent' },
    { id: 'product', label: 'Expérience produit', sectionId: 'meetra-product' },
  ];

  const filteredSearchItems = searchItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  useEffect(() => {
    if (!openMenu && !searchOpen) return undefined;

    const handleClickOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpenMenu('');
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu, searchOpen]);

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
          hostEmail: hostEmail.trim() || null,
          hostPhone: hostPhone.trim() || null,
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
        hostEmail: data.hostEmail || hostEmail.trim() || null,
        hostPhone: data.hostPhone || hostPhone.trim() || null,
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
        hostEmail: hostEmail.trim() || null,
        hostPhone: hostPhone.trim() || null,
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
      hostEmail: meeting.hostEmail || '',
      hostPhone: meeting.hostPhone || '',
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
          hostEmail: editForm.hostEmail?.trim() || null,
          hostPhone: editForm.hostPhone?.trim() || null,
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

  const copyRecentMeetingLink = async (meeting) => {
    if (!meeting?.joinUrl) return;
    await navigator.clipboard.writeText(meeting.joinUrl);
    setCopiedMeetingId(meeting.roomId);
    setTimeout(() => setCopiedMeetingId(''), 2000);
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
    <div className="meetra-shell h-screen overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        {!prefillRoomId && (
          <section className="meetra-surface overflow-hidden rounded-[36px] px-6 py-6 md:px-8 md:py-8">
            <header ref={menuRef} className="relative">
              <div className="flex flex-col gap-4 rounded-[30px] border border-white/10 bg-slate-950/45 px-5 py-4 shadow-[0_22px_44px_rgba(2,6,23,0.18)] 2xl:px-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-blue-300/15 bg-gradient-to-br from-blue-500/18 to-emerald-400/12 text-blue-50 shadow-[0_22px_50px_rgba(37,99,235,0.22)]">
                    <VideoAppIcon size={24} />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Workspace vidéo</div>
                    <div className="text-[28px] font-semibold tracking-tight text-slate-50">Meetra</div>
                  </div>
                </div>
                  <button
                    type="button"
                    aria-label="Rechercher"
                    onClick={() => {
                      setOpenMenu('');
                      setSearchOpen((current) => !current);
                    }}
                    className="meetra-focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/[0.05] hover:text-slate-100"
                  >
                    <SearchIcon size={18} />
                  </button>
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <nav className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:gap-2">
                  <NavMenuButton label="Produits" active={openMenu === 'produits'} onClick={() => setOpenMenu((current) => current === 'produits' ? '' : 'produits')} />
                  <NavMenuButton label="Lancer une réunion" active={openMenu === 'lancer'} onClick={() => setOpenMenu((current) => current === 'lancer' ? '' : 'lancer')} />
                  <NavMenuButton label="Plateforme" active={openMenu === 'plateforme'} onClick={() => setOpenMenu((current) => current === 'plateforme' ? '' : 'plateforme')} />
                  <NavMenuButton label="Ressources" active={openMenu === 'ressources'} onClick={() => setOpenMenu((current) => current === 'ressources' ? '' : 'ressources')} />
                  <button type="button" onClick={() => scrollToSection('meetra-planner')} className="meetra-focus-ring whitespace-nowrap rounded-full px-5 py-3 text-[15px] font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-slate-100">
                    Tarification
                  </button>
                </nav>

                <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
                  <button type="button" onClick={() => scrollToSection('meetra-recent')} className="meetra-focus-ring whitespace-nowrap rounded-full px-5 py-3 text-[15px] font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-slate-100">
                    Assistance
                  </button>
                  <button type="button" onClick={() => scrollToSection('meetra-planner')} className="meetra-button meetra-focus-ring whitespace-nowrap px-5 py-3 text-[15px] font-semibold text-slate-100">
                    Se connecter
                  </button>
                  <button type="button" onClick={() => scrollToSection('meetra-planner')} className="meetra-button meetra-button-primary meetra-focus-ring whitespace-nowrap px-5 py-3 text-[15px] font-semibold text-white">
                    Essayer gratuitement
                  </button>
                </div>
                </div>
              </div>

              {openMenu && (
                <div className="mt-4">
                  {openMenu === 'lancer' ? (
                    <LaunchMeetingDropdown onJoinMeeting={openJoinMeeting} onHostMeeting={openHostMeeting} />
                  ) : (
                    <NavDropdown title={openMenu} items={navMenus[openMenu]} onSelect={scrollToSection} />
                  )}
                </div>
              )}

              {searchOpen && (
                <div className="mt-4 rounded-[30px] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)]">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Recherche</div>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher une action Meetra"
                    className="mt-4 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                    autoFocus
                  />
                  <div className="mt-4 grid gap-2">
                    {filteredSearchItems.length === 0 ? (
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        Aucun résultat pour cette recherche.
                      </div>
                    ) : (
                      filteredSearchItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => scrollToSection(item.sectionId)}
                          className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50/60"
                        >
                          {item.label}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </header>

            <div className="rounded-[22px] border border-blue-400/14 bg-blue-500/10 px-4 py-3 text-sm text-blue-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SparkIcon size={16} />
                  <span>Planifiez, admettez et collaborez dans un shell plus professionnel.</span>
                </div>
                <button
                  type="button"
                  onClick={() => scrollToSection('meetra-planner')}
                  className="text-sm font-semibold text-blue-100 underline decoration-blue-300/40 underline-offset-4"
                >
                  Ouvrir le planificateur
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-blue-300/15 bg-gradient-to-br from-blue-500/18 to-emerald-400/12 text-blue-50 shadow-[0_22px_50px_rgba(37,99,235,0.22)]">
                    <VideoAppIcon size={25} />
                  </div>
                  <div>
                    <div className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">Meetra platform</div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">Travail connecté, réunions planifiées, salle d’attente intégrée</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-300">
                  {['Réunions', 'Planification', 'Admissions', 'Sous-titres', 'Co-hôte', 'Chat'].map((item) => (
                    <span key={item} className="meetra-badge">{item}</span>
                  ))}
                </div>

                <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                  Meetra centralise la préparation d’une réunion, l’accueil des invités et la collaboration en direct dans une interface plus vivante. Partagez un lien public, gardez le contrôle des admissions et préparez vos réunions comme un vrai produit SaaS.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToSection('meetra-planner')}
                    className="meetra-button meetra-button-primary meetra-focus-ring inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Planifier ou démarrer
                    <ArrowRightIcon size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('meetra-product')}
                    className="meetra-button meetra-focus-ring inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-100"
                  >
                    Voir l’expérience produit
                    <SparkIcon size={15} />
                  </button>
                </div>
              </div>

              <div className="relative min-h-[28rem] rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-950/80 via-slate-900/60 to-blue-950/40 p-5">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/18 blur-3xl" />
                <div className="absolute bottom-0 left-10 h-36 w-36 rounded-full bg-emerald-400/12 blur-3xl" />
                <div className="relative grid h-full gap-4 md:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.96))] p-5 shadow-[0_26px_54px_rgba(2,6,23,0.34)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Live meeting</div>
                        <div className="mt-2 text-lg font-semibold text-slate-50">Équipe projet Meetra</div>
                      </div>
                      <span className="rounded-full bg-emerald-500/14 px-3 py-1 text-xs font-semibold text-emerald-100">En direct</span>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="h-40 rounded-[22px] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.34),transparent_45%),linear-gradient(180deg,#172554_0%,#0f172a_100%)] p-3">
                        <div className="flex h-full items-end rounded-[18px] border border-white/10 bg-black/15 p-3 text-sm font-semibold text-white">
                          Présentation
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <div className="h-[7.7rem] rounded-[22px] bg-[linear-gradient(180deg,#1e293b_0%,#0f172a_100%)] p-3">
                          <div className="flex h-full items-end rounded-[18px] border border-white/10 bg-white/[0.03] p-3 text-sm font-semibold text-white">
                            Chat
                          </div>
                        </div>
                        <div className="h-[7.7rem] rounded-[22px] bg-[linear-gradient(180deg,#164e63_0%,#0f172a_100%)] p-3">
                          <div className="flex h-full items-end rounded-[18px] border border-white/10 bg-white/[0.03] p-3 text-sm font-semibold text-white">
                            Whiteboard
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
                      <div className="mt-3 text-xl font-semibold text-slate-50">Une plateforme pour planifier, accueillir et collaborer</div>
                      <div className="mt-3 text-sm leading-6 text-slate-400">
                        Meetra met en avant les réunions planifiées, les admissions d’invités et la collaboration visuelle dans une page d’accueil plus vivante.
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-sm font-semibold text-slate-100">Meetings</div>
                        <div className="mt-2 text-sm leading-6 text-slate-400">Planification, lien public, salle d’attente et co-hôte.</div>
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-sm font-semibold text-slate-100">AI Companion</div>
                        <div className="mt-2 text-sm leading-6 text-slate-400">Sous-titres, résumé et base pour traduction live.</div>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-sm font-semibold text-slate-100">Histoires de réussite</div>
                      <div className="mt-2 text-sm leading-6 text-slate-400">
                        Présentez Meetra comme un espace de communication, de collaboration et de préparation de réunions modernes, prêt à évoluer vers plus d’IA.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <HeroStat value="Réunions planifiées" label="Créez un lien public à l’avance et revenez plus tard." />
              <HeroStat value="Admission contrôlée" label="File d’attente, hôte et co-hôte dans le même flux." />
              <HeroStat value="Sous-titres et résumé" label="Base prête pour transcription et extensions IA." />
              <HeroStat value="Expérience web" label="Interface pensée pour Vercel/Render et usage public." />
            </div>
          </section>
        )}

        {!prefillRoomId && (
          <section id="meetra-product" className="mt-6 grid gap-6 lg:grid-cols-3">
            <ProductLane
              title="Accueil des invités"
              body="Liens publics, vérification du nom, salle d’attente et notification hôte pour gérer les entrées avec plus de clarté."
              tags={['Lien public', 'Salle d’attente', 'Notifications']}
            />
            <ProductLane
              title="Réunion structurée"
              body="Contrôles hôte, co-hôte, panneau paramètres et barre d’actions plus stable pour un usage quotidien."
              tags={['Co-hôte', 'Paramètres', 'Chat']}
              accent="emerald"
            />
            <ProductLane
              title="Transcription évolutive"
              body="Sous-titres et résumé peuvent servir de base à une future traduction live français-anglais ou anglais-français."
              tags={['Sous-titres', 'Résumé', 'Évolution IA']}
              accent="amber"
            />
          </section>
        )}

        {!prefillRoomId && (
          <section className="mt-6 grid gap-6">
            <ProductShowcase
              sectionId="product-meetings"
              icon={<VideoAppIcon size={22} />}
              title="Meetings"
              body="Le cœur de Meetra: réunions planifiées, admissions d’invités, co-hôte, partage d’écran, chat et sous-titres dans un flux cohérent."
              bullets={['Créer et démarrer', 'Salle d’attente et admission', 'Sous-titres et co-hôte']}
              mockTitle="Réunion d’équipe Meetra"
              mockLines={['Vue principale avec participants', 'Admission d’un invité en attente', 'Sous-titres et partage actifs']}
              mockBadges={['Réunion live', 'Co-hôte', 'Transcript']}
            />
            <ProductShowcase
              sectionId="product-phone"
              icon={<PhoneIcon size={22} />}
              title="Phone"
              body="Une future brique de communication plus large pour appels et coordination d’équipe. La page produit peut déjà la présenter comme extension de la plateforme."
              bullets={['Communication unifiée', 'Appels d’équipe', 'Extension future']}
              accent="emerald"
              mockTitle="Console d’appel"
              mockLines={['Contacts prioritaires', 'Historique rapide des appels', 'Canal direct équipe ou client']}
              mockBadges={['Voice', 'Directory', 'Extension']}
            />
            <ProductShowcase
              sectionId="product-whiteboard"
              icon={<WhiteboardIcon size={22} />}
              title="Whiteboard"
              body="Le tableau blanc donne à Meetra une dimension plus collaborative pour la démonstration, l’enseignement ou les ateliers visuels."
              bullets={['Explication visuelle', 'Ateliers collaboratifs', 'Support de présentation']}
              accent="amber"
              mockTitle="Board de session"
              mockLines={['Notes de réunion', 'Zone de dessin et d’annotation', 'Espace de structuration rapide']}
              mockBadges={['Draw', 'Notes', 'Workshop']}
            />
            <ProductShowcase
              sectionId="product-chat"
              icon={<ChatBubbleIcon size={22} />}
              title="Chat"
              body="Le chat temps réel reste intégré à la réunion pour garder les messages, liens et suivis visibles sans quitter la salle."
              bullets={['Messages contextuels', 'Suivi pendant la réunion', 'Notifications visuelles']}
              mockTitle="Conversation de réunion"
              mockLines={['Message de suivi partagé', 'Lien de document collé', 'Notification de nouveau message']}
              mockBadges={['Realtime', 'Follow-up', 'Links']}
            />
            <ProductShowcase
              sectionId="product-rooms"
              icon={<BuildingIcon size={22} />}
              title="Rooms"
              body="Une extension naturelle pour imaginer Meetra au-delà de la réunion web: présence, espaces partagés et expérience plus hybride."
              bullets={['Espaces dédiés', 'Vision hybride', 'Évolution plateforme']}
              accent="emerald"
              mockTitle="Salle et présence"
              mockLines={['État de disponibilité de la salle', 'Session planifiée dans un espace partagé', 'Expérience hybride à venir']}
              mockBadges={['Spaces', 'Hybrid', 'Presence']}
            />
            <ProductShowcase
              sectionId="product-mail-calendar"
              icon={<MailCalendarIcon size={22} />}
              title="Mail & Calendar"
              body="Meetra peut déjà valoriser la planification, les liens publics et les notifications. Cette section prépare visuellement une évolution vers un calendrier plus intégré."
              bullets={['Invitations', 'Rappels', 'Coordination de réunion']}
              accent="amber"
              mockTitle="Invitation planifiée"
              mockLines={['Titre, date et heure de réunion', 'Lien public et rappel hôte', 'Coordination par email et agenda']}
              mockBadges={['Invite', 'Reminder', 'Calendar']}
            />
          </section>
        )}

        {!prefillRoomId && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="meetra-surface rounded-[32px] px-6 py-8 md:px-8">
              <div className="meetra-section-label">Pourquoi Meetra</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">
                Une expérience plus professionnelle pour planifier, accueillir et collaborer.
              </div>
              <div className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Meetra prend maintenant la forme d’une vraie homepage produit: plateforme, produits, ressources, planification et parcours de réunion dans un langage plus crédible pour un démonstrateur SaaS.
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {['Réunions planifiées', 'Salle d’attente', 'Co-hôte', 'Sous-titres', 'Chat', 'Webhooks'].map((item) => (
                  <span key={item} className="meetra-badge">{item}</span>
                ))}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {['Équipes projet', 'Support client', 'Présentations', 'Suivis internes', 'Cours virtuels', 'Réunions planifiées'].map((logo) => (
                  <div key={logo} className="rounded-[18px] border border-white/10 bg-slate-950/45 px-4 py-4 text-center text-sm font-semibold text-slate-300">
                    {logo}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => scrollToSection('meetra-planner')}
                  className="meetra-button meetra-button-primary meetra-focus-ring inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white"
                >
                  Découvrir les produits
                  <ArrowRightIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('resources-guidance')}
                  className="meetra-button meetra-focus-ring inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-100"
                >
                  Trouver votre parcours
                  <SparkIcon size={15} />
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              <TestimonialCard
                quote="Meetra présente désormais une vraie logique produit: accueil plus fort, réunions planifiées, et parcours d’admission cohérent."
                author="Équipe produit"
                role="Expérience plateforme"
              />
              <TestimonialCard
                quote="La page d’accueil explique mieux la valeur de l’application avant même d’entrer dans une réunion."
                author="Responsable démonstration"
                role="Présentation client et soutenance"
              />
              <TestimonialCard
                quote="Le mélange planification, salle d’attente, co-hôte et sous-titres donne une base crédible pour évoluer vers une vraie suite collaborative."
                author="Architecture Meetra"
                role="Vision produit"
              />
            </div>
          </section>
        )}

        {!prefillRoomId && (
          <section className="mt-6 grid gap-6">
            <CapabilityShowcase
              sectionId="platform-experience"
              icon={<GlobeIcon size={22} />}
              title="Plateforme"
              body="Meetra se présente maintenant comme une plateforme de travail connectée, pas seulement comme une page de création de salle. L’accueil, la salle d’attente et le parcours de réunion sont mieux organisés."
              items={[
                { title: 'Accueil produit', body: 'Navigation de plateforme, zones produit, actions principales visibles dès le header.' },
                { title: 'Salle d’attente', body: 'Admission structurée avec badge hôte/co-hôte et demande d’accès claire.' },
                { title: 'Parcours de réunion', body: 'Créer, planifier, rejoindre et retrouver une réunion dans un seul flux cohérent.' },
                { title: 'Expérience web public', body: 'Pensé pour être partagé via un lien Vercel et testé comme un vrai produit.' },
              ]}
            />

            <CapabilityShowcase
              sectionId="platform-ai"
              icon={<TranscriptIcon size={22} />}
              title="Plateforme IA et automatisation"
              body="Les briques déjà en place permettent de présenter Meetra comme une plateforme prête pour résumé, sous-titres, traduction live et notifications automatisées."
              items={[
                { title: 'Sous-titres', body: 'Base temps réel pour afficher des captions plus visibles pendant la réunion.' },
                { title: 'Résumé', body: 'Point d’appui pour produire un compte rendu exploitable après réunion.' },
                { title: 'Webhooks', body: 'Déclenchement d’alertes hôte et intégration avec email ou automatisation externe.' },
                { title: 'Traduction live', body: 'Étape suivante logique: transcription puis traduction vers une langue cible.' },
              ]}
              accent="emerald"
            />

            <CapabilityShowcase
              sectionId="resources-operations"
              icon={<SettingsIcon size={22} />}
              title="Ressources et opérations"
              body="L’utilisateur retrouve plus facilement les outils de préparation et d’exploitation de réunion: pré-test, paramètres, réunions récentes et édition rapide."
              items={[
                { title: 'Pré-test audio/vidéo', body: 'Choix du micro, de la caméra et vérification avant d’entrer dans la salle.' },
                { title: 'Réunions récentes', body: 'Récupération rapide d’un lien existant, modification d’horaire ou relance de réunion.' },
                { title: 'Paramètres', body: 'Panneau centralisé pour micro, caméra, sous-titres et confort de réunion.' },
                { title: 'Support hôte', body: 'Notifications, co-hôte, salle d’attente et parcours d’admission plus clairs.' },
              ]}
              accent="amber"
            />

            <CapabilityShowcase
              sectionId="resources-guidance"
              icon={<SparkIcon size={22} />}
              title="Ressources d’évolution"
              body="Cette zone positionne Meetra comme un produit qui peut continuer à monter en gamme, avec IA, traduction live, automatisation et expérience plus enterprise."
              items={[
                { title: 'Traduction FR↔EN', body: 'Sous-titres traduits par langue cible à partir de la transcription temps réel.' },
                { title: 'Historique exportable', body: 'Résumé, transcript et suivi de réunion plus complets pour l’après-session.' },
                { title: 'Automatisation', body: 'Webhooks, email, rappels et intégrations externes pour le flux de réunion.' },
                { title: 'Vision enterprise', body: 'Une homepage plus forte et une plateforme plus structurée pour convaincre plus vite.' },
              ]}
            />
          </section>
        )}

        {!prefillRoomId && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="meetra-surface rounded-[32px] px-6 py-8 md:px-10 md:py-10">
              <div className="meetra-section-label">Valeur produit</div>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
                Une page d’accueil qui vend mieux la réunion planifiée, sans perdre le flux direct.
              </div>
              <div className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Meetra garde la logique utile que tu as déjà validée, mais elle est maintenant présentée dans une structure plus crédible: produit, navigation, mise en avant des usages, puis action. C’est plus proche d’un Zoom ou d’un Teams que d’un simple formulaire.
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
                  <div className="text-sm font-semibold text-slate-100">Évolution possible</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-400">
                    {[
                      'Traduction live basée sur la transcription',
                      'Email hôte via webhook',
                      'Compte utilisateur et tableau de bord',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <CheckCircleIcon size={15} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="meetra-surface rounded-[32px] p-6 md:p-8">
              <div className="meetra-section-label">Pourquoi maintenant</div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-50">Prépare une réunion qui a déjà l’air d’un produit prêt pour un client.</div>
              <div className="mt-4 text-sm leading-7 text-slate-400">
                L’accueil met davantage en avant la planification, les usages et l’organisation des réunions. Cela améliore la perception du produit avant même d’entrer dans la salle.
              </div>
              <div className="mt-6 space-y-3">
                {[
                  'Créer et démarrer immédiatement',
                  'Planifier avec date, heure et notifications hôte',
                  'Modifier ensuite les réunions récentes',
                  'Rejoindre une salle par ID ou lien public',
                ].map((item) => (
                  <div key={item} className="rounded-[18px] border border-white/10 bg-slate-950/45 px-4 py-4 text-sm text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-[20px] border border-cyan-400/16 bg-cyan-500/8 px-4 py-4 text-sm text-cyan-50">
                <div className="flex items-center gap-2 font-semibold">
                  <GlobeIcon size={16} />
                  Traduction live
                </div>
                <div className="mt-2 leading-6 text-cyan-50/85">
                  Oui, c’est faisable. Le meilleur chemin est: parole → transcription temps réel → traduction → sous-titres traduits. C’est une vraie étape produit, pas seulement un bouton UI.
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mt-6 grid min-h-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section id="meetra-planner" className="meetra-surface rounded-[32px] p-6 md:p-8">
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="meetra-section-label">Email de notification hôte</label>
                      <input
                        type="email"
                        value={hostEmail}
                        onChange={(e) => setHostEmail(e.target.value)}
                        placeholder="alice@entreprise.com"
                        className="meetra-focus-ring mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="meetra-section-label">Téléphone de notification</label>
                      <input
                        type="tel"
                        value={hostPhone}
                        onChange={(e) => setHostPhone(e.target.value)}
                        placeholder="+1 514 555 1234"
                        className="meetra-focus-ring mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
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
                    <div className="mt-2 text-xs text-slate-500">
                      Alertes hôte: {hostEmail.trim() || hostPhone.trim() ? [hostEmail.trim(), hostPhone.trim()].filter(Boolean).join(' · ') : 'aucune'}
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

              <form id="meetra-join" onSubmit={joinRoom} className="space-y-3">
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

              <div id="meetra-recent" className="rounded-[24px] border border-white/10 bg-slate-950/45 px-4 py-4">
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
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="meetra-section-label">Email hôte</label>
                                <input
                                  type="email"
                                  value={editForm.hostEmail || ''}
                                  onChange={(e) => setEditForm((current) => ({ ...current, hostEmail: e.target.value }))}
                                  className="meetra-focus-ring mt-2 w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400"
                                />
                              </div>
                              <div>
                                <label className="meetra-section-label">Téléphone hôte</label>
                                <input
                                  type="tel"
                                  value={editForm.hostPhone || ''}
                                  onChange={(e) => setEditForm((current) => ({ ...current, hostPhone: e.target.value }))}
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
                            onClick={() => copyRecentMeetingLink(meeting)}
                            className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-slate-200"
                          >
                            {copiedMeetingId === meeting.roomId ? 'Lien copié' : 'Copier le lien'}
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

          {!prefillRoomId && (
            <section className="meetra-surface rounded-[32px] px-6 py-8 md:px-8">
              <div className="meetra-section-label">Parcours recommandé</div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-50">Préparer, inviter, admettre, collaborer.</div>
              <div className="mt-4 text-sm leading-7 text-slate-400">
                Le formulaire reste central, mais il est maintenant accompagné d’un contexte produit plus vendeur et plus facile à comprendre pour un utilisateur externe.
              </div>

              <div className="mt-6 space-y-4">
                {[
                  {
                    title: '1. Préparer la réunion',
                    body: 'Choisissez un titre, une date, une heure et les coordonnées hôte pour les alertes.',
                  },
                  {
                    title: '2. Envoyer le lien',
                    body: 'Copiez le lien public immédiatement après la planification ou la création.',
                  },
                  {
                    title: '3. Accueillir les invités',
                    body: 'La salle d’attente et le rôle co-hôte rendent l’admission plus propre.',
                  },
                  {
                    title: '4. Exploiter la réunion',
                    body: 'Chat, transcription, partage d’écran et réglages restent accessibles dans la salle.',
                  },
                ].map((step, index) => (
                  <div key={step.title} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/12 text-sm font-semibold text-blue-100">
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{step.title}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-400">{step.body}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[24px] border border-white/10 bg-gradient-to-br from-blue-500/10 to-emerald-400/8 p-5">
                <div className="text-sm font-semibold text-slate-100">Prochaine extension logique</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Traduction live FR↔EN à partir de la transcription, avec choix de langue cible par participant ou par réunion.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Transcription temps réel', 'Traduction serveur', 'Sous-titres traduits', 'Historique exportable'].map((item) => (
                    <span key={item} className="meetra-badge">{item}</span>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
