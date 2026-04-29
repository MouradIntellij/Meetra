import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../utils/appConfig.js';
import { ArrowRightIcon, BuildingIcon, CalendarIcon, CalendarPlusIcon, CheckCircleIcon, ChatBubbleIcon, DoorExitIcon, GlobeIcon, LinkIcon, MailCalendarIcon, PhoneIcon, SearchIcon, SettingsIcon, ShieldLockIcon, SparkIcon, TranscriptIcon, UsersIcon, VideoAppIcon, WhiteboardIcon } from '../components/common/AppIcons.jsx';
import CampusHub from '../components/hub/CampusHub.jsx';

const API_URL = getApiUrl();
const DEFAULT_DURATION_MINUTES = 60;
const AUTH_STORAGE_KEY = 'meetra-auth-session';

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

function readStoredAuth() {
  if (typeof window === 'undefined') return { token: '', profile: null };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
    return {
      token: parsed.token || '',
      profile: parsed.profile || null,
    };
  } catch {
    return { token: '', profile: null };
  }
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

function getMeetingApiErrorMessage(errorCode, action = 'create') {
  switch (errorCode) {
    case 'UNAUTHENTICATED':
      return action === 'update'
        ? 'Connectez-vous avec le compte propriétaire pour modifier cette réunion.'
        : action === 'schedule'
          ? 'Connectez-vous dans Campus Hub avant de planifier une réunion.'
          : 'Connectez-vous dans Campus Hub avant de créer une réunion.';
    case 'MEETING_ACCESS_DENIED':
      return 'Connectez-vous avec le compte propriétaire pour modifier cette réunion.';
    case 'MEETING_DATABASE_REQUIRED':
      return 'Configuration serveur incomplète: Postgres est requis en production pour stocker les réunions.';
    case 'ROOM_CREATE_FAILED_500':
    case 'ROOM_UPDATE_FAILED_500':
      return "Le serveur n'a pas pu enregistrer la réunion.";
    default:
      return action === 'update'
        ? 'Impossible de modifier cette réunion planifiée.'
        : action === 'schedule'
          ? 'Impossible de planifier la réunion sur le serveur.'
          : 'Impossible de créer la réunion sur le serveur.';
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
          ? 'border border-white/10 bg-white/10 text-slate-50 shadow-[0_14px_30px_rgba(2,6,23,0.22)]'
          : 'border border-transparent text-slate-300 hover:border-white/8 hover:bg-white/[0.05] hover:text-slate-100'
      }`}
    >
      <span>{label}</span>
      <span className={`text-[11px] transition ${active ? 'rotate-180 text-slate-100' : 'text-slate-500'}`}>▾</span>
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
    <div className="grid gap-5 rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] p-6 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)] xl:grid-cols-[0.85fr_1.15fr]">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{title}</div>
        <div className="mt-3 text-lg font-semibold text-slate-900">Découvrir la plateforme Meetra</div>
        <div className="mt-3 text-sm leading-6 text-slate-600">
          Accédez directement aux espaces principaux sans descendre dans toute la page.
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
            className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-[1px] hover:border-blue-300/60 hover:bg-blue-50/60"
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
    <div className="grid gap-5 rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] p-6 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)] xl:grid-cols-[0.85fr_1.15fr]">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">lancer une réunion</div>
        <div className="mt-3 text-lg font-semibold text-slate-900">Choisir votre point d’entrée</div>
        <div className="mt-3 text-sm leading-6 text-slate-600">
          Les deux chemins principaux restent accessibles directement depuis le menu supérieur.
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onJoinMeeting}
          className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-[1px] hover:border-blue-300/60 hover:bg-blue-50/60"
        >
          <div className="text-sm font-semibold text-slate-900">Participer à une réunion</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">
            Aller directement au formulaire de participation avec ID ou lien public.
          </div>
        </button>
        <button
          type="button"
          onClick={onHostMeeting}
          className="rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-[1px] hover:border-blue-300/60 hover:bg-blue-50/60"
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
  const [auth, setAuth] = useState(() => readStoredAuth());
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
  const effectiveUserName = userName.trim() || auth.profile?.name || '';
  const effectiveHostEmail = hostEmail.trim() || auth.profile?.email || '';

  const authFetch = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (auth.token) {
      headers.set('authorization', `Bearer ${auth.token}`);
    }
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  };

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

  useEffect(() => {
    if (!auth.token) return;
    authFetch('/api/auth/me')
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.profile) return;
        setAuth((current) => ({ ...current, profile: data.profile }));
        setUserName((current) => current || data.profile.name || '');
        setHostEmail((current) => current || data.profile.email || '');
      })
      .catch(() => {});
  }, [auth.token]);

  useEffect(() => {
    if (!auth.profile) return;
    setUserName((current) => current || auth.profile?.name || '');
    setHostEmail((current) => current || auth.profile?.email || '');
  }, [auth.profile]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncAuth = () => setAuth(readStoredAuth());
    window.addEventListener('meetra-auth-changed', syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener('meetra-auth-changed', syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  useEffect(() => {
    if (!auth.token) {
      setRecentMeetings([]);
      return;
    }
    loadRecentMeetings();
  }, [auth.token]);

  const loadRecentMeetings = async () => {
    if (!auth.token) {
      setRecentMeetings([]);
      return;
    }
    setLoadingRecent(true);
    try {
      const res = await authFetch('/api/meetings?limit=6');
      const data = await res.json().catch(() => ({ meetings: [] }));
      if (res.ok) {
        setRecentMeetings(data.meetings || []);
      } else {
        setRecentMeetings([]);
      }
    } catch {
      setRecentMeetings([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  const createRoomRequest = async ({ includeSchedule = false } = {}) => {
    if (!auth.token) {
      throw new Error('UNAUTHENTICATED');
    }
    const scheduledFor = includeSchedule ? buildScheduledIso(scheduledDate, scheduledTime) : null;
    const res = await authFetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: meetingTitle.trim() || 'Réunion Meetra',
        scheduledFor,
        timezone,
        durationMinutes: DEFAULT_DURATION_MINUTES,
        hostName: effectiveUserName || null,
        hostEmail: effectiveHostEmail || null,
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
      hostName: data.hostName || effectiveUserName || null,
      hostEmail: data.hostEmail || effectiveHostEmail || null,
      hostPhone: data.hostPhone || hostPhone.trim() || null,
    };
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
      const res = await authFetch(`/api/rooms/${roomIdToUpdate}`, {
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
    } catch (error) {
      setError(getMeetingApiErrorMessage(error?.message, 'update'));
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async (event) => {
    event?.preventDefault?.();
    if (!auth.token) {
      setError('Connectez-vous dans Campus Hub avant de créer une réunion.');
      return;
    }
    if (!effectiveUserName) {
      setError('Entrez votre nom.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const meeting = await createRoomRequest({ includeSchedule: false });
      setCreatedMeeting(meeting);
      loadRecentMeetings();
      onJoin(meeting.roomId, effectiveUserName);
    } catch (error) {
      setError(getMeetingApiErrorMessage(error?.message, 'create'));
    } finally {
      setLoading(false);
    }
  };

  const scheduleRoom = async (event) => {
    event?.preventDefault?.();
    if (!auth.token) {
      setError('Connectez-vous dans Campus Hub avant de planifier une réunion.');
      return;
    }
    if (!effectiveUserName) {
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
    } catch (error) {
      setError(getMeetingApiErrorMessage(error?.message, 'schedule'));
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!effectiveUserName) {
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
        onJoin(normalizedRoomId, effectiveUserName);
      } else {
        setError("Cette salle n'existe pas ou a expiré.");
      }
    } catch {
      onJoin(normalizedRoomId, effectiveUserName);
    } finally {
      setLoading(false);
    }
  };

  const copyCreatedLink = async (event) => {
    event?.preventDefault?.();
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

  const enterCreatedRoom = (event) => {
    event?.preventDefault?.();
    if (!effectiveUserName) {
      setError('Entrez votre nom pour entrer comme hôte.');
      return;
    }

    onJoin(createdMeeting.roomId, effectiveUserName);
  };

  useEffect(() => {
    if (prefillRoomId) return;
    loadRecentMeetings();
  }, [prefillRoomId]);

  return (
    <div className="meetra-shell h-screen overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        {!prefillRoomId && (
          <section className="meetra-surface meetra-accent-panel overflow-hidden rounded-[36px] px-6 py-6 md:px-8 md:py-8">
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
                  <button type="button" onClick={() => scrollToSection('meetra-campus-hub')} className="meetra-focus-ring whitespace-nowrap rounded-full px-5 py-3 text-[15px] font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-slate-100">
                    Campus Hub
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
                <div className="mt-4 rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] p-5 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)]">
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
                  onClick={() => scrollToSection('meetra-campus-hub')}
                  className="text-sm font-semibold text-blue-100 underline decoration-blue-300/40 underline-offset-4"
                >
                  Ouvrir Campus Hub
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
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
                  {['Campus Hub', 'Réunions', 'Planification', 'Admissions', 'Sous-titres', 'Co-hôte'].map((item) => (
                    <span key={item} className="meetra-badge">{item}</span>
                  ))}
                </div>

                <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                  Meetra centralise la préparation d’une réunion, l’accueil des invités et la collaboration en direct dans une interface plus vivante. Partagez un lien public, gardez le contrôle des admissions et préparez vos réunions comme un vrai produit SaaS.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToSection('meetra-campus-hub')}
                    className="meetra-button meetra-button-primary meetra-focus-ring inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Ouvrir Campus Hub
                    <ArrowRightIcon size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('meetra-planner')}
                    className="meetra-button meetra-focus-ring inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-100"
                  >
                    Planifier ou démarrer
                    <SparkIcon size={15} />
                  </button>
                </div>
              </div>

              <div className="meetra-hero-panel relative rounded-[32px] p-5">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/18 blur-3xl" />
                <div className="absolute bottom-0 left-10 h-36 w-36 rounded-full bg-emerald-400/12 blur-3xl" />
                <div className="relative grid gap-4">
                  <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Démarrage rapide</div>
                    <div className="mt-3 text-xl font-semibold text-slate-50">Campus Hub, réunion, accès hôte.</div>
                    <div className="mt-4 grid gap-3">
                      {[
                        'Connexion Campus Hub',
                        'Créer et démarrer',
                        'Copier le lien et entrer comme hôte',
                      ].map((line, index) => (
                        <div key={line} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/12 font-semibold text-blue-100">{index + 1}</span>
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="meetra-info-strip sm:grid-cols-2 sm:grid">
                    <div className="meetra-info-chip">
                      <h4>Salle d’attente</h4>
                      <p>L’hôte garde le contrôle des admissions dès l’entrée des invités.</p>
                    </div>
                    <div className="meetra-info-chip">
                      <h4>Campus Hub visible</h4>
                      <p>Connexion, présence et messages restent visibles avant la planification.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {!prefillRoomId && (
          <section className="mt-6">
            <div className="meetra-divider-label">Chemins principaux</div>
            <div className="meetra-card-grid mt-4 grid gap-6 lg:grid-cols-3">
            <div className="meetra-surface meetra-subtle-card meetra-shortcut-card rounded-[28px] p-5">
              <span className="meetra-shortcut-index">01</span>
              <div className="meetra-section-label mt-4">Campus Hub</div>
              <div className="mt-3 text-xl font-semibold text-slate-50">Connexion et présence</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Le Hub est visible plus tôt dans la page pour ouvrir la session, voir les membres connectés et lancer un message direct.
              </div>
              <button
                type="button"
                onClick={() => scrollToSection('meetra-campus-hub')}
                className="meetra-button meetra-button-primary mt-5 px-4 py-3 text-sm font-semibold text-white"
              >
                Aller au Campus Hub
              </button>
            </div>
            <div className="meetra-surface meetra-subtle-card meetra-shortcut-card rounded-[28px] p-5">
              <span className="meetra-shortcut-index">02</span>
              <div className="meetra-section-label mt-4">Créer</div>
              <div className="mt-3 text-xl font-semibold text-slate-50">Réunion immédiate</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Créez la salle, copiez le lien et entrez comme hôte sans quitter la même page.
              </div>
              <button
                type="button"
                onClick={() => scrollToSection('meetra-planner')}
                className="meetra-button mt-5 px-4 py-3 text-sm font-semibold text-slate-100"
              >
                Ouvrir le planificateur
              </button>
            </div>
            <div className="meetra-surface meetra-subtle-card meetra-shortcut-card rounded-[28px] p-5">
              <span className="meetra-shortcut-index">03</span>
              <div className="meetra-section-label mt-4">Rejoindre</div>
              <div className="mt-3 text-xl font-semibold text-slate-50">Salle existante</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Rejoignez rapidement une salle avec un lien public ou un identifiant partagé.
              </div>
              <button
                type="button"
                onClick={() => scrollToSection('meetra-join')}
                className="meetra-button mt-5 px-4 py-3 text-sm font-semibold text-slate-100"
              >
                Aller au formulaire
              </button>
            </div>
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
            <div>
              <div className="meetra-divider-label">Produits phares</div>
              <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Les blocs ci-dessous prolongent la plateforme sans prendre le dessus sur Campus Hub et les actions de réunion.
              </div>
            </div>
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
            <div className="meetra-surface meetra-accent-panel rounded-[32px] px-6 py-8 md:px-8">
              <div className="meetra-section-label">Pourquoi Meetra</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">
                Une expérience plus professionnelle pour planifier, accueillir et collaborer.
              </div>
              <div className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Meetra présente maintenant une lecture plus claire: entrée par Campus Hub, gestion des réunions au centre, puis exploration produit plus bas dans la page.
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {['Réunions planifiées', 'Salle d’attente', 'Co-hôte', 'Sous-titres', 'Chat', 'Webhooks'].map((item) => (
                  <span key={item} className="meetra-badge">{item}</span>
                ))}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {['Équipes projet', 'Support client', 'Présentations', 'Suivis internes', 'Cours virtuels', 'Réunions planifiées'].map((logo) => (
                  <div key={logo} className="rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-4 text-center text-sm font-semibold text-slate-300">
                    {logo}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => scrollToSection('meetra-product')}
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
            </div>
          </section>
        )}

        {!prefillRoomId && (
          <section className="mt-6 grid gap-6">
            <div>
              <div className="meetra-divider-label">Plateforme et ressources</div>
              <div className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Cette partie détaille les capacités de la plateforme après les actions principales, pour garder le haut de page plus direct.
              </div>
            </div>
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
          <CampusHub />
        )}

        <div className="mt-6 grid min-h-full gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <section id="meetra-planner" className="meetra-surface meetra-accent-panel rounded-[32px] p-6 md:p-8">
          {!prefillRoomId && (
            <div className="mb-5">
              <div className="meetra-section-label">Réunions</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Créer, planifier ou rejoindre</div>
              <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Toutes les actions liées aux réunions sont regroupées ici, juste sous le Campus Hub.
              </div>
            </div>
          )}
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
                  type="button"
                  onClick={copyCreatedLink}
                  className="meetra-button meetra-focus-ring flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-100"
                >
                  <LinkIcon size={15} />
                  {copied ? 'Lien copié' : 'Copier le lien'}
                </button>
                <button
                  type="button"
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
                type="button"
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
                    <div className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
                      Donnez un titre, une date et une heure. Meetra génère ensuite un lien public à partager.
                    </div>
                  </div>
                </div>
                  <div className={`mb-4 rounded-[18px] border px-4 py-3 text-sm leading-6 ${
                  auth.token
                    ? 'border-emerald-400/16 bg-emerald-500/8 text-slate-200'
                    : 'border-amber-400/16 bg-amber-500/8 text-amber-100'
                }`}>
                  {auth.token
                    ? `Planification sécurisée active pour ${auth.profile?.name || userName || 'votre compte'}${auth.profile?.email ? ` · ${auth.profile.email}` : ''}.`
                    : 'Connectez-vous dans Campus Hub pour créer, planifier et modifier vos réunions.'}
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
                  type="button"
                  onClick={createRoom}
                  disabled={loading}
                  className="meetra-button meetra-button-primary meetra-focus-ring flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <VideoAppIcon size={16} />
                  {loading ? 'Création...' : 'Créer et démarrer'}
                </button>
                <button
                  type="button"
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
                    <div className="meetra-section-label">Mes réunions</div>
                    <div className="mt-1 max-w-lg text-sm text-slate-400">Retrouvez, modifiez et relancez les réunions liées à votre compte.</div>
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
                  {auth.token && (
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Compte</div>
                        <div className="mt-2 text-sm font-semibold text-slate-100">{auth.profile?.name || userName || 'Meetra user'}</div>
                        <div className="mt-1 text-xs text-slate-500">{auth.profile?.email || 'email non disponible'}</div>
                      </div>
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Réunions visibles</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-50">{recentMeetings.length}</div>
                        <div className="mt-1 text-xs text-slate-500">planifications rattachées à votre compte</div>
                      </div>
                      <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Propriété</div>
                        <div className="mt-2 text-sm font-semibold text-slate-100">Gestion privée</div>
                        <div className="mt-1 text-xs text-slate-500">seul le compte propriétaire peut modifier ces réunions</div>
                      </div>
                    </div>
                  )}
                  {!auth.token ? (
                    <div className="rounded-[18px] border border-amber-400/16 bg-amber-500/8 px-4 py-4 text-sm text-amber-100">
                      Connectez-vous dans Campus Hub pour afficher uniquement vos réunions planifiées.
                    </div>
                  ) : recentMeetings.length === 0 ? (
                    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                      Aucune réunion récente à afficher pour le moment.
                    </div>
                  ) : (
                    recentMeetings.map((meeting) => (
                      <div key={meeting.roomId} className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold text-slate-100">{meeting.title || 'Réunion Meetra'}</div>
                              <span className="rounded-full border border-emerald-400/16 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                                Mon compte
                              </span>
                            </div>
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
          <section className="meetra-surface meetra-subtle-card meetra-sticky-panel rounded-[32px] px-6 py-8 md:px-8">
              <div className="meetra-section-label">Parcours rapide</div>
              <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-50">Ordre recommandé</div>
              <div className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Utilisez ce chemin si vous voulez aller vite sans chercher dans la page.
              </div>
              <div className="mt-4 grid gap-3">
                {[
                  ['01', 'Connectez-vous dans Campus Hub', 'Ouvrez la session, vérifiez votre présence et gardez vos réunions liées à votre compte.'],
                  ['02', 'Créez ou planifiez la réunion', 'Préparez le titre, l’horaire et les notifications avant de générer le lien public.'],
                  ['03', 'Copiez le lien et entrez comme hôte', 'Rejoignez ensuite la salle avec votre nom pour piloter admissions et collaboration.'],
                ].map(([index, title, body]) => (
                  <div key={title} className="meetra-step-card">
                    <span className="meetra-shortcut-index shrink-0">{index}</span>
                    <span>
                      <strong>{title}</strong>
                      <span>{body}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-[20px] border border-white/10 bg-slate-950/45 px-4 py-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Repère</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Campus Hub reste la porte d’entrée visible, puis toute la gestion des réunions se fait dans le bloc juste à gauche.
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
