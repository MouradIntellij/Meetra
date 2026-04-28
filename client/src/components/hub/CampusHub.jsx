import { useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '../../utils/appConfig.js';
import { CalendarIcon, ChatBubbleIcon, MailCalendarIcon, SearchIcon, UsersIcon } from '../common/AppIcons.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { EVENTS } from '../../utils/events.js';

const API_URL = getApiUrl();
const ACCESS_STORAGE_KEY = 'meetra-hub-access';

function readStoredAccess() {
  if (typeof window === 'undefined') return { name: '', email: '' };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCESS_STORAGE_KEY) || '{}');
    return {
      name: parsed.name || '',
      email: parsed.email || '',
    };
  } catch {
    return { name: '', email: '' };
  }
}

function persistAccess(access) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(access));
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

function PanelCard({ icon, title, body, children }) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-slate-950/55 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-blue-500/12 text-blue-100">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
          <div className="mt-1 text-sm leading-6 text-slate-400">{body}</div>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function CampusHub() {
  const { socket, connected } = useSocket();
  const [access, setAccess] = useState(() => readStoredAccess());
  const [profile, setProfile] = useState(null);
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directory, setDirectory] = useState([]);
  const [activity, setActivity] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const signedIn = Boolean(profile?.email);

  const loadDirectory = async (email = access.email, query = directoryQuery) => {
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (query) params.set('q', query);
    const res = await fetch(`${API_URL}/api/hub/directory?${params.toString()}`);
    const data = await res.json();
    setDirectory(data.profiles || []);
  };

  const loadActivity = async (email = access.email) => {
    if (!email) return;
    const res = await fetch(`${API_URL}/api/hub/activity?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    setActivity(data.items || []);
  };

  const loadConversations = async (email = access.email) => {
    if (!email) return;
    const res = await fetch(`${API_URL}/api/hub/conversations?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    setConversations(data.items || []);
  };

  const loadMessages = async (email = access.email, peerEmail = selectedPeer?.email) => {
    if (!email || !peerEmail) return;
    const params = new URLSearchParams({ email, peerEmail });
    const res = await fetch(`${API_URL}/api/hub/messages?${params.toString()}`);
    const data = await res.json();
    setMessages(data.items || []);
  };

  useEffect(() => {
    if (!access.email) return;
    fetch(`${API_URL}/api/hub/profile?email=${encodeURIComponent(access.email)}`)
      .then(async (res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.profile) return;
        setProfile(data.profile);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket || !connected || !profile?.email) return;
    socket.emit(EVENTS.HUB_ACCESS, {
      email: profile.email,
      name: profile.name,
      role: profile.role,
    });
  }, [socket, connected, profile]);

  useEffect(() => {
    if (!signedIn) return;
    loadDirectory();
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
        const peerFallback = {
          email: peerEmail,
          name: peerEmail.split('@')[0] || peerEmail,
          role: 'member',
        };

        if (index >= 0) {
          next[index] = {
            ...next[index],
            lastMessage: message,
            unreadCount: selectedPeer?.email === peerEmail && message.toEmail === profile.email
              ? 0
              : (next[index].unreadCount || 0) + unreadIncrement,
          };
        } else {
          next.unshift({
            peer: directory.find((entry) => entry.email === peerEmail) || peerFallback,
            lastMessage: message,
            unreadCount: selectedPeer?.email === peerEmail && message.toEmail === profile.email ? 0 : unreadIncrement,
          });
        }

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

    socket.on(EVENTS.HUB_MESSAGE_RECEIVED, onHubMessage);
    socket.on(EVENTS.HUB_ACTIVITY_RECEIVED, onHubActivity);

    return () => {
      socket.off(EVENTS.HUB_MESSAGE_RECEIVED, onHubMessage);
      socket.off(EVENTS.HUB_ACTIVITY_RECEIVED, onHubActivity);
    };
  }, [socket, profile, selectedPeer, directory]);

  const accessSummary = useMemo(() => {
    if (!profile) return 'Activez votre accès Meetra pour voir votre activité et joindre un autre membre.';
    return `Connecté comme ${profile.name} · ${profile.email}`;
  }, [profile]);

  const handleAccessSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus('');

    try {
      const payload = {
        name: access.name.trim(),
        email: access.email.trim().toLowerCase(),
      };
      const res = await fetch(`${API_URL}/api/hub/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("Impossible d'activer l'accès Meetra.");
        return;
      }

      setProfile(data.profile);
      persistAccess(payload);
      setStatus('Accès Meetra activé.');
      socket?.emit(EVENTS.HUB_ACCESS, payload);
      await Promise.all([
        loadDirectory(payload.email, ''),
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
    setMessages([]);
    await loadMessages(access.email, peer.email);
    await loadConversations(access.email);
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
      });

      setDraft('');
      setStatus('Message envoyé.');
      await Promise.all([
        loadConversations(profile.email),
        loadActivity(profile.email),
      ]);
    } catch {
      setStatus("Impossible d'envoyer le message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="meetra-campus-hub" className="meetra-surface rounded-[32px] px-6 py-8 md:px-8">
      <div className="meetra-section-label">Campus Hub</div>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-slate-50">Activité et messages directs Meetra</div>
          <div className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
            Un espace simple pour activer votre accès, voir vos activités récentes et écrire directement à un autre membre autorisé de Meetra.
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-400">
          {accessSummary}
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <PanelCard
            icon={<MailCalendarIcon size={18} />}
            title="Accès Meetra"
            body="Entrez votre nom et votre email pour apparaître dans l’annuaire et recevoir activité et messages."
          >
            <form onSubmit={handleAccessSubmit} className="grid gap-3">
              <input
                value={access.name}
                onChange={(event) => setAccess((current) => ({ ...current, name: event.target.value }))}
                placeholder="Votre nom"
                className="meetra-focus-ring w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
              />
              <input
                type="email"
                value={access.email}
                onChange={(event) => setAccess((current) => ({ ...current, email: event.target.value }))}
                placeholder="vous@ecole.com"
                className="meetra-focus-ring w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
              />
              <button
                type="submit"
                disabled={loading}
                className="meetra-button meetra-button-primary meetra-focus-ring px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? 'Activation...' : signedIn ? 'Mettre à jour mon accès' : 'Activer mon accès'}
              </button>
              {status && <div className="text-sm text-slate-300">{status}</div>}
            </form>
          </PanelCard>

          <PanelCard
            icon={<CalendarIcon size={18} />}
            title="Zone activité"
            body="Retrouvez ici les réunions créées pour vous et les nouveaux messages directs."
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
                </div>
              ))}
            </div>
          </PanelCard>
        </div>

        <div className="space-y-5">
          <PanelCard
            icon={<UsersIcon size={18} />}
            title="Annuaire et conversations"
            body="Sélectionnez un membre inscrit pour lui écrire directement depuis Meetra."
          >
            <div className="grid gap-4 lg:grid-cols-[0.46fr_0.54fr]">
              <div className="space-y-4">
                <div className="relative">
                  <SearchIcon size={16} color="currentColor" />
                  <input
                    value={directoryQuery}
                    onChange={(event) => setDirectoryQuery(event.target.value)}
                    placeholder="Rechercher un membre"
                    className="meetra-focus-ring mt-2 w-full rounded-[18px] border border-white/10 bg-slate-950/60 px-4 py-3 pl-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400"
                  />
                </div>

                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {directory.length === 0 ? (
                    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                      Aucun membre trouvé pour le moment.
                    </div>
                  ) : directory.map((peer) => (
                    <button
                      key={peer.email}
                      type="button"
                      onClick={() => handleOpenConversation(peer)}
                      className={`w-full rounded-[18px] border px-4 py-3 text-left transition ${
                        selectedPeer?.email === peer.email
                          ? 'border-blue-400/30 bg-blue-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="text-sm font-semibold text-slate-100">{peer.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{peer.email}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-slate-950/50 p-4">
                {selectedPeer ? (
                  <>
                    <div className="border-b border-white/10 pb-3">
                      <div className="text-sm font-semibold text-slate-100">{selectedPeer.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{selectedPeer.email}</div>
                    </div>

                    <div className="mt-4 max-h-[260px] space-y-3 overflow-y-auto pr-1">
                      {messages.length === 0 ? (
                        <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                          Aucun message avec ce membre pour le moment.
                        </div>
                      ) : messages.map((message) => {
                        const isMine = message.fromEmail === profile?.email;
                        return (
                          <div
                            key={message.id}
                            className={`rounded-[18px] px-4 py-3 text-sm ${
                              isMine
                                ? 'border border-blue-400/20 bg-blue-500/10 text-blue-50'
                                : 'border border-white/10 bg-white/[0.03] text-slate-100'
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
                  <div className="flex h-full min-h-[260px] items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-sm leading-6 text-slate-400">
                    Sélectionnez un membre dans l’annuaire pour ouvrir une conversation directe.
                  </div>
                )}
              </div>
            </div>
          </PanelCard>

          <PanelCard
            icon={<ChatBubbleIcon size={18} />}
            title="Conversations récentes"
            body="Vos fils directs les plus récents apparaissent ici pour reprendre une discussion."
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
                  className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100">{item.peer.name}</div>
                    <div className="mt-1 truncate text-sm text-slate-400">{item.lastMessage?.content || 'Conversation vide'}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-slate-500">{formatTime(item.lastMessage?.createdAt)}</div>
                    {item.unreadCount > 0 && (
                      <div className="mt-2 inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-100">
                        {item.unreadCount} non lu{item.unreadCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </PanelCard>
        </div>
      </div>
    </section>
  );
}
