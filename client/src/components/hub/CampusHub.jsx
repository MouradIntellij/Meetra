import { useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '../../utils/appConfig.js';
import { useSocket } from '../../context/SocketContext.jsx';
import { EVENTS } from '../../utils/events.js';
import { CalendarIcon, ChatBubbleIcon, MailCalendarIcon, SearchIcon, SparkIcon, UsersIcon } from '../common/AppIcons.jsx';

const API_URL = getApiUrl();
const ACCESS_STORAGE_KEY = 'meetra-hub-access';
const AUTH_STORAGE_KEY = 'meetra-auth-session';

const HUB_TABS = [
  { id: 'activity', label: 'Activité', Icon: SparkIcon },
  { id: 'chat', label: 'Messages', Icon: ChatBubbleIcon },
  { id: 'people', label: 'Personnes', Icon: UsersIcon },
];

const PRESENCE_OPTIONS = [
  { value: 'available', label: 'Disponible', tone: 'bg-emerald-400' },
  { value: 'busy', label: 'Occupé', tone: 'bg-amber-400' },
  { value: 'meeting', label: 'En réunion', tone: 'bg-rose-400' },
];

function readStoredAccess() {
  if (typeof window === 'undefined') return { name: '', email: '' };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCESS_STORAGE_KEY) || '{}');
    return { name: parsed.name || '', email: parsed.email || '' };
  } catch {
    return { name: '', email: '' };
  }
}

function persistAccess(access) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(access));
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

function persistAuth(session) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function formatTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function TeamsRailButton({ active, label, Icon, onClick, badge = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition ${
        active
          ? 'bg-blue-500/16 text-blue-50 shadow-[0_14px_36px_rgba(37,99,235,0.16)]'
          : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${active ? 'bg-blue-500/18' : 'bg-white/[0.04]'}`}>
        <Icon size={18} />
      </span>
      <span className="text-sm font-semibold">{label}</span>
      {badge > 0 && (
        <span className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/18 px-2 py-0.5 text-[11px] font-bold text-blue-100">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

function SectionCard({ title, subtitle, children, toolbar = null }) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          {subtitle && <div className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</div>}
        </div>
        {toolbar}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function CampusHub() {
  const { socket, connected } = useSocket();
  const [authMode, setAuthMode] = useState('login');
  const [auth, setAuth] = useState(() => readStoredAuth());
  const [activeTab, setActiveTab] = useState('activity');
  const [access, setAccess] = useState(() => readStoredAccess());
  const [profile, setProfile] = useState(null);
  const [password, setPassword] = useState('');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directory, setDirectory] = useState([]);
  const [presence, setPresence] = useState([]);
  const [activity, setActivity] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const signedIn = Boolean(profile?.email);

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

  const unreadTotal = useMemo(
    () => conversations.reduce((total, item) => total + (item.unreadCount || 0), 0),
    [conversations]
  );

  const onlineMembers = useMemo(() => presence, [presence]);

  const selectedConversationSummary = useMemo(() => {
    if (!selectedPeer) return 'Sélectionnez un membre pour voir votre conversation directe.';
    return `Conversation directe avec ${selectedPeer.name}.`;
  }, [selectedPeer]);

  const currentPresence = useMemo(
    () => PRESENCE_OPTIONS.find((option) => option.value === (profile?.presenceStatus || 'available')) || PRESENCE_OPTIONS[0],
    [profile]
  );

  const accessSummary = useMemo(() => {
    if (!profile) return 'Activez votre accès Meetra pour voir vos activités, membres et messages.';
    return `Connecté comme ${profile.name} · ${profile.email}`;
  }, [profile]);

  const loadDirectory = async (email = access.email, query = directoryQuery) => {
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (query) params.set('q', query);
    const res = await authFetch(`/api/hub/directory?${params.toString()}`);
    const data = await res.json();
    setDirectory(data.profiles || []);
  };

  const loadPresence = async () => {
    const res = await authFetch('/api/hub/presence');
    const data = await res.json();
    setPresence(data.items || []);
  };

  const loadActivity = async (email = access.email) => {
    if (!email) return;
    const res = await authFetch(`/api/hub/activity?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    setActivity(data.items || []);
  };

  const loadConversations = async (email = access.email) => {
    if (!email) return;
    const res = await authFetch(`/api/hub/conversations?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    setConversations(data.items || []);
  };

  const loadMessages = async (email = access.email, peerEmail = selectedPeer?.email) => {
    if (!email || !peerEmail) return;
    const params = new URLSearchParams({ email, peerEmail });
    const res = await authFetch(`/api/hub/messages?${params.toString()}`);
    const data = await res.json();
    setMessages(data.items || []);
  };

  useEffect(() => {
    if (!access.email) return;
    if (auth.token) {
      authFetch('/api/auth/me')
        .then(async (res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.profile) return;
          setProfile(data.profile);
          setAccess((current) => ({
            ...current,
            name: data.profile.name,
            email: data.profile.email,
          }));
        })
        .catch(() => {});
      return;
    }

    fetch(`${API_URL}/api/hub/profile?email=${encodeURIComponent(access.email)}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.profile) return;
        setProfile(data.profile);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPresence();
  }, []);

  useEffect(() => {
    if (!socket || !connected || !profile?.email) return;
    socket.emit(EVENTS.HUB_ACCESS, {
      email: profile.email,
      name: profile.name,
      role: profile.role,
      token: auth.token,
      status: profile.presenceStatus || 'available',
    });
  }, [socket, connected, profile, auth.token]);

  useEffect(() => {
    if (!signedIn) return;
    loadDirectory();
    loadPresence();
    loadActivity();
    loadConversations();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    const timeoutId = setTimeout(() => {
      loadDirectory(access.email, directoryQuery);
    }, 180);
    return () => clearTimeout(timeoutId);
  }, [directoryQuery, signedIn]);

  useEffect(() => {
    if (!signedIn || !selectedPeer?.email) return;
    loadMessages(access.email, selectedPeer.email);
  }, [signedIn, selectedPeer]);

  useEffect(() => {
    if (!socket) return;

    const onHubMessage = (message) => {
      if (!profile?.email) return;
      if (message.fromEmail !== profile.email && message.toEmail !== profile.email) return;

      const peerEmail = message.fromEmail === profile.email ? message.toEmail : message.fromEmail;

      setConversations((current) => {
        const next = [...current];
        const index = next.findIndex((item) => item.peer.email === peerEmail);
        const unreadIncrement = message.toEmail === profile.email ? 1 : 0;
        const knownPeer = directory.find((entry) => entry.email === peerEmail)
          || presence.find((entry) => entry.email === peerEmail)
          || { email: peerEmail, name: peerEmail.split('@')[0] || peerEmail, role: 'member', online: false };

        const updatedItem = index >= 0
          ? {
              ...next[index],
              peer: { ...next[index].peer, ...knownPeer },
              lastMessage: message,
              unreadCount: selectedPeer?.email === peerEmail && message.toEmail === profile.email
                ? 0
                : (next[index].unreadCount || 0) + unreadIncrement,
            }
          : {
              peer: knownPeer,
              lastMessage: message,
              unreadCount: selectedPeer?.email === peerEmail && message.toEmail === profile.email ? 0 : unreadIncrement,
            };

        if (index >= 0) next[index] = updatedItem;
        else next.unshift(updatedItem);

        return next.sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0));
      });

      if (selectedPeer?.email === peerEmail) {
        setMessages((current) => {
          if (current.some((item) => item.id === message.id)) return current;
          return [...current, message];
        });
      }
    };

    const onHubActivity = (item) => {
      if (!item) return;
      setActivity((current) => [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 20));
    };

    const onPresence = (payload) => {
      const items = payload?.items || [];
      setPresence(items);
      const onlineMap = new Map(items.map((item) => [item.email, item]));
      setDirectory((current) => current.map((entry) => ({
        ...entry,
        online: onlineMap.has(entry.email),
        presenceStatus: onlineMap.get(entry.email)?.status || entry.presenceStatus || 'offline',
      })));
      setConversations((current) => current.map((item) => ({
        ...item,
        peer: {
          ...item.peer,
          online: onlineMap.has(item.peer.email),
          presenceStatus: onlineMap.get(item.peer.email)?.status || item.peer.presenceStatus || 'offline',
        },
      })));
    };

    socket.on(EVENTS.HUB_MESSAGE_RECEIVED, onHubMessage);
    socket.on(EVENTS.HUB_ACTIVITY_RECEIVED, onHubActivity);
    socket.on(EVENTS.HUB_PRESENCE_UPDATED, onPresence);

    return () => {
      socket.off(EVENTS.HUB_MESSAGE_RECEIVED, onHubMessage);
      socket.off(EVENTS.HUB_ACTIVITY_RECEIVED, onHubActivity);
      socket.off(EVENTS.HUB_PRESENCE_UPDATED, onPresence);
    };
  }, [socket, profile, selectedPeer, directory, presence]);

  const handleAccessSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus('');

    try {
      const payload = {
        name: access.name.trim(),
        email: access.email.trim().toLowerCase(),
      };
      let authResult = null;
      if (password.trim()) {
        const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
        const authRes = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: payload.name,
            email: payload.email,
            password: password.trim(),
          }),
        });
        authResult = await authRes.json();
        if (!authRes.ok) {
          setStatus(
            authResult.error === 'EMAIL_ALREADY_EXISTS'
              ? 'Cet email possède déjà un compte.'
              : authResult.error === 'INVALID_CREDENTIALS'
                ? 'Email ou mot de passe invalide.'
                : "Impossible d'ouvrir la session Meetra."
          );
          return;
        }
        setAuth({ token: authResult.token, profile: authResult.profile });
        persistAuth({ token: authResult.token, profile: authResult.profile });
      }

      const res = await authFetch(`/api/hub/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("Impossible d'activer l'accès Meetra.");
        return;
      }

      const nextProfile = authResult?.profile || data.profile;
      setProfile(nextProfile);
      persistAccess(payload);
      socket?.emit(EVENTS.HUB_ACCESS, {
        ...payload,
        token: authResult?.token || auth.token,
        role: nextProfile?.role,
        status: nextProfile?.presenceStatus || 'available',
      });
      setPassword('');
      setStatus(authResult ? 'Compte Meetra prêt et connecté.' : 'Accès Meetra activé.');
      await Promise.all([
        loadDirectory(payload.email, ''),
        loadPresence(),
        loadActivity(payload.email),
        loadConversations(payload.email),
      ]);
    } catch {
      setStatus("Impossible de joindre le hub Meetra.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConversation = async (peer) => {
    setSelectedPeer(peer);
    setActiveTab('chat');
    setMessages([]);
    await loadMessages(access.email, peer.email);
    setConversations((current) => current.map((item) => (
      item.peer.email === peer.email ? { ...item, unreadCount: 0 } : item
    )));
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuth({ token: '', profile: null });
    setProfile(null);
    setSelectedPeer(null);
    setMessages([]);
    setStatus('Session fermée.');
  };

  const handlePresenceChange = (value) => {
    setProfile((current) => (current ? { ...current, presenceStatus: value } : current));
    if (!socket || !profile?.email) return;
    socket.emit(EVENTS.HUB_STATUS_SET, {
      email: profile.email,
      status: value,
    });
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!profile?.email || !selectedPeer?.email || !draft.trim()) return;

    setLoading(true);
    setStatus('');

    try {
      if (!socket || !connected) {
        setStatus("Le serveur temps réel n'est pas disponible.");
        return;
      }

      socket.emit(EVENTS.HUB_MESSAGE_SEND, {
        fromEmail: profile.email,
        fromName: profile.name,
        toEmail: selectedPeer.email,
        content: draft.trim(),
        token: auth.token,
      });

      setDraft('');
      setStatus('Message envoyé.');
    } catch {
      setStatus("Impossible d'envoyer le message.");
    } finally {
      setLoading(false);
    }
  };

  const peopleView = (
    <SectionCard
      title="Annuaire Meetra"
      subtitle="Parcourez les membres inscrits et ouvrez une conversation directe."
      toolbar={(
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
          {directory.length} membre{directory.length > 1 ? 's' : ''}
        </div>
      )}
    >
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-5 text-slate-500">
          <SearchIcon size={16} />
        </div>
        <input
          value={directoryQuery}
          onChange={(event) => setDirectoryQuery(event.target.value)}
          placeholder="Rechercher une personne"
          className="meetra-focus-ring w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 pl-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
        />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {directory.length === 0 ? (
          <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
            Aucun membre disponible pour le moment.
          </div>
        ) : directory.map((peer) => (
          <button
            key={peer.email}
            type="button"
            onClick={() => handleOpenConversation(peer)}
            className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/[0.05]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">{peer.name}</div>
                <div className="mt-1 text-xs text-slate-500">{peer.email}</div>
              </div>
              <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${peer.online ? 'bg-emerald-500/16 text-emerald-100' : 'bg-slate-700/60 text-slate-300'}`}>
                {peer.online ? (PRESENCE_OPTIONS.find((option) => option.value === peer.presenceStatus)?.label || 'En ligne') : 'Hors ligne'}
              </span>
            </div>
            <div className="mt-3 text-sm text-slate-400">
              Ouvrir une conversation directe dans Meetra.
            </div>
          </button>
        ))}
      </div>
    </SectionCard>
  );

  const activityView = (
    <SectionCard
      title="Fil d’activité"
      subtitle="Réunions créées pour vous, mises à jour et nouveaux messages directs."
      toolbar={(
        <button
          type="button"
          onClick={() => loadActivity(access.email)}
          className="meetra-button meetra-focus-ring px-3 py-2 text-xs font-semibold text-slate-200"
        >
          Actualiser
        </button>
      )}
    >
      <div className="space-y-3">
        {activity.length === 0 ? (
          <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
            Aucune activité pour le moment.
          </div>
        ) : activity.map((item) => (
          <div key={item.id} className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-100">{item.title}</div>
              <div className="text-xs text-slate-500">{formatTime(item.createdAt)}</div>
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-400">{item.body}</div>
            {item.meta?.joinUrl && (
              <a href={item.meta.joinUrl} className="mt-3 inline-flex text-xs font-semibold text-blue-200 underline decoration-blue-400/40 underline-offset-4">
                Ouvrir la réunion liée
              </a>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );

  const chatView = (
    <div className="grid gap-5 xl:grid-cols-[0.42fr_0.58fr]">
      <SectionCard
        title="Conversations"
        subtitle="Vos fils directs récents, organisés comme une inbox."
      >
        <div className="space-y-3">
          {conversations.length === 0 ? (
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
              Aucune conversation récente.
            </div>
          ) : conversations.map((item) => (
            <button
              key={item.peer.email}
              type="button"
              onClick={() => handleOpenConversation(item.peer)}
              className={`flex w-full items-start justify-between gap-3 rounded-[18px] border px-4 py-4 text-left transition ${
                selectedPeer?.email === item.peer.email
                  ? 'border-blue-400/24 bg-blue-500/10'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
              }`}
            >
              <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{item.peer.name}</span>
                    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      item.peer.online
                        ? (PRESENCE_OPTIONS.find((option) => option.value === item.peer.presenceStatus)?.tone || 'bg-emerald-400')
                        : 'bg-slate-600'
                    }`} />
                  </div>
                <div className="mt-1 truncate text-sm text-slate-400">{item.lastMessage?.content || 'Conversation vide'}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs text-slate-500">{formatTime(item.lastMessage?.createdAt)}</div>
                {item.unreadCount > 0 && (
                  <div className="mt-2 inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-100">
                    {item.unreadCount}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={selectedPeer ? selectedPeer.name : 'Conversation directe'}
        subtitle={selectedConversationSummary}
      >
        {selectedPeer ? (
          <>
            <div className="max-h-[380px] space-y-3 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                  Aucun message pour le moment.
                </div>
              ) : messages.map((message) => {
                const isMine = message.fromEmail === profile?.email;
                return (
                  <div
                    key={message.id}
                    className={`rounded-[18px] px-4 py-3 text-sm ${
                      isMine
                        ? 'ml-auto max-w-[82%] border border-blue-400/20 bg-blue-500/10 text-blue-50'
                        : 'mr-auto max-w-[82%] border border-white/10 bg-white/[0.03] text-slate-100'
                    }`}
                  >
                    <div className="font-semibold">{isMine ? 'Vous' : message.fromName}</div>
                    <div className="mt-1 leading-6">{message.content}</div>
                    <div className="mt-2 text-[11px] opacity-70">{formatTime(message.createdAt)}</div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="mt-4 space-y-3">
              <textarea
                rows={4}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Écrire un message direct…"
                className="meetra-focus-ring w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
              />
              <button
                type="submit"
                disabled={loading || !signedIn}
                className="meetra-button meetra-button-primary meetra-focus-ring w-full px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? 'Envoi...' : 'Envoyer le message'}
              </button>
            </form>
          </>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-sm leading-6 text-slate-400">
            Choisissez une conversation existante ou ouvrez-en une depuis l’annuaire.
          </div>
        )}
      </SectionCard>
    </div>
  );

  const mainView = activeTab === 'chat'
    ? chatView
    : activeTab === 'people'
      ? peopleView
      : activityView;

  return (
    <section id="meetra-campus-hub" className="meetra-surface rounded-[32px] px-6 py-8 md:px-8">
      <div className="meetra-section-label">Campus Hub</div>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-slate-50">Activité, conversations et présence Meetra</div>
          <div className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
            Une présentation plus proche d’un hub Teams: rail d’activité, conversations directes et membres connectés visibles en permanence.
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-400">
          {accessSummary}
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="rounded-[26px] border border-white/10 bg-slate-950/60 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Navigation</div>
          <div className="mt-4 space-y-2">
            {HUB_TABS.map(({ id, label, Icon }) => (
              <TeamsRailButton
                key={id}
                active={activeTab === id}
                label={label}
                Icon={Icon}
                badge={id === 'chat' ? unreadTotal : 0}
                onClick={() => setActiveTab(id)}
              />
            ))}
          </div>

          <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-500/12 text-blue-100">
                <MailCalendarIcon size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">Accès Meetra</div>
                <div className="mt-1 text-xs text-slate-500">Membres autorisés</div>
              </div>
            </div>

            <form onSubmit={handleAccessSubmit} className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-2 rounded-[16px] border border-white/10 bg-slate-950/55 p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`rounded-[12px] px-3 py-2 text-sm font-semibold transition ${authMode === 'login' ? 'bg-blue-500/16 text-blue-100' : 'text-slate-400 hover:text-white'}`}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`rounded-[12px] px-3 py-2 text-sm font-semibold transition ${authMode === 'register' ? 'bg-blue-500/16 text-blue-100' : 'text-slate-400 hover:text-white'}`}
                >
                  Inscription
                </button>
              </div>
              <input
                value={access.name}
                onChange={(event) => setAccess((current) => ({ ...current, name: event.target.value }))}
                placeholder="Votre nom"
                className="meetra-focus-ring w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
              />
              <input
                type="email"
                value={access.email}
                onChange={(event) => setAccess((current) => ({ ...current, email: event.target.value }))}
                placeholder="vous@ecole.com"
                className="meetra-focus-ring w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={authMode === 'register' ? 'Mot de passe (6 caractères min.)' : 'Mot de passe'}
                className="meetra-focus-ring w-full rounded-[16px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
              />
              {signedIn && (
                <div className="rounded-[16px] border border-white/10 bg-slate-950/55 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Statut Teams-like</div>
                  <div className="mt-3 grid gap-2">
                    {PRESENCE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handlePresenceChange(option.value)}
                        className={`flex items-center justify-between rounded-[14px] border px-3 py-2 text-sm transition ${
                          currentPresence.value === option.value
                            ? 'border-blue-400/24 bg-blue-500/10 text-blue-50'
                            : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${option.tone}`} />
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="meetra-button meetra-button-primary meetra-focus-ring px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? 'Traitement...' : signedIn ? 'Mettre à jour' : authMode === 'register' ? 'Créer mon compte' : 'Se connecter'}
              </button>
              {signedIn && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="meetra-button meetra-focus-ring px-4 py-3 text-sm font-semibold text-slate-200"
                >
                  Se déconnecter
                </button>
              )}
            </form>
            {status && <div className="mt-3 text-sm text-slate-300">{status}</div>}
          </div>
        </aside>

        <div className="min-w-0">
          {mainView}
        </div>

        <aside className="space-y-5">
          <SectionCard
            title="Membres connectés"
            subtitle="Les personnes actuellement présentes dans le Hub apparaissent ici."
          >
            <div className="space-y-3">
              {onlineMembers.length === 0 ? (
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                  Aucun membre connecté pour le moment.
                </div>
              ) : onlineMembers.map((member) => (
                <button
                  key={member.email}
                  type="button"
                  onClick={() => handleOpenConversation(member)}
                  className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{member.name}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${(PRESENCE_OPTIONS.find((option) => option.value === member.status)?.tone) || 'bg-emerald-400'}`} />
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500">{member.email}</div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-semibold text-slate-200">
                    {PRESENCE_OPTIONS.find((option) => option.value === member.status)?.label || 'Disponible'}
                  </span>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Vue rapide"
            subtitle="Résumé de votre espace collaboratif Meetra."
          >
            <div className="grid gap-3">
              <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Activité</div>
                <div className="mt-2 text-2xl font-semibold text-slate-50">{activity.length}</div>
                <div className="mt-1 text-sm text-slate-400">éléments visibles dans votre fil</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Messages</div>
                <div className="mt-2 text-2xl font-semibold text-slate-50">{conversations.length}</div>
                <div className="mt-1 text-sm text-slate-400">conversations directes actives</div>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Présence</div>
                <div className="mt-2 text-2xl font-semibold text-slate-50">{onlineMembers.length}</div>
                <div className="mt-1 text-sm text-slate-400">membres connectés en ce moment</div>
              </div>
            </div>
          </SectionCard>
        </aside>
      </div>
    </section>
  );
}
