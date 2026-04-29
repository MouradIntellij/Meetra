import { useEffect, useState } from 'react';
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

function NavDropdown({ title, items, actions = [] }) {
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
    <div className="grid gap-5 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] p-4 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)] sm:p-6 xl:grid-cols-[0.85fr_1.15fr]">
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
          <div
            key={item.title}
            className="rounded-[20px] border border-slate-200 bg-white p-4 text-left"
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
          </div>
        ))}
      </div>
      {actions.length > 0 && (
        <div className="xl:col-span-2">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Actions utiles</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={`rounded-[18px] border px-4 py-4 text-left transition hover:-translate-y-[1px] ${
                    action.tone === 'emerald'
                      ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80'
                      : action.tone === 'amber'
                        ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/80'
                        : 'border-blue-200 bg-blue-50 hover:bg-blue-100/80'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{action.label}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-600">{action.body}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LaunchMeetingDropdown({ onJoinMeeting, onHostMeeting }) {
  return (
    <div className="grid gap-5 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] p-4 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)] sm:p-6 xl:grid-cols-[0.85fr_1.15fr]">
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

function PlatformOverviewModal({ onOpenHub, onOpenPlanner, onOpenJoin, isSignedIn, recentCount, hubSnapshot }) {
  return (
    <div className="grid gap-5 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] p-4 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)] sm:p-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">plateforme</div>
        <div className="mt-3 text-lg font-semibold text-slate-900">Vue rapide de Meetra</div>
        <div className="mt-3 text-sm leading-6 text-slate-600">
          Les actions essentielles restent au premier plan, et cette fenêtre vous donne un résumé plus compact de la plateforme.
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Hub</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{isSignedIn ? 'Actif' : 'Invité'}</div>
            <div className="mt-1 text-sm text-slate-600">accès et présence</div>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Réunions</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{recentCount}</div>
            <div className="mt-1 text-sm text-slate-600">liées à votre compte</div>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Entrée</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">3</div>
            <div className="mt-1 text-sm text-slate-600">actions principales</div>
          </div>
        </div>
        <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Synthèse Hub</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">{hubSnapshot.onlineCount}</div>
              <div className="mt-1 text-sm text-slate-600">membres en ligne</div>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">{hubSnapshot.conversationCount}</div>
              <div className="mt-1 text-sm text-slate-600">conversations directes</div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onOpenHub} className="rounded-[22px] border border-slate-200 bg-blue-50 p-4 text-left transition hover:bg-blue-100/80">
          <div className="text-sm font-semibold text-slate-900">Ouvrir Campus Hub</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">Connexion, présence, messages et membres connectés.</div>
        </button>
        <button type="button" onClick={onOpenPlanner} className="rounded-[22px] border border-slate-200 bg-emerald-50 p-4 text-left transition hover:bg-emerald-100/80">
          <div className="text-sm font-semibold text-slate-900">Créer ou planifier</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">Créer une salle immédiatement ou préparer une réunion planifiée.</div>
        </button>
        <button type="button" onClick={onOpenJoin} className="rounded-[22px] border border-slate-200 bg-amber-50 p-4 text-left transition hover:bg-amber-100/80">
          <div className="text-sm font-semibold text-slate-900">Rejoindre une salle</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">Accéder rapidement à une réunion avec un lien ou un identifiant.</div>
        </button>
        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Parcours conseillé</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">Hub, création de salle, partage du lien, entrée comme hôte.</div>
        </div>
      </div>
    </div>
  );
}

function ResourcesModal({
  auth,
  recentMeetings,
  loadingRecent,
  onRefresh,
  onJoinMeeting,
  onCopyMeetingLink,
  onOpenPlanner,
}) {
  return (
    <div className="grid gap-5 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] p-4 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)] sm:p-6 xl:grid-cols-[0.85fr_1.15fr]">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">ressources</div>
        <div className="mt-3 text-lg font-semibold text-slate-900">Mes réunions et accès rapides</div>
        <div className="mt-3 text-sm leading-6 text-slate-600">
          Retrouvez vos réunions, rechargez la liste et relancez une salle directement depuis cette fenêtre.
        </div>
        <div className="mt-5 grid gap-3">
          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Compte</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{auth.profile?.name || 'Compte non connecté'}</div>
            <div className="mt-1 text-xs text-slate-500">{auth.profile?.email || 'Connectez-vous dans Campus Hub'}</div>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Réunions visibles</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{recentMeetings.length}</div>
            <div className="mt-1 text-sm text-slate-600">planifications rattachées à votre compte</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onRefresh} className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
              {loadingRecent ? 'Actualisation...' : 'Actualiser'}
            </button>
            <button type="button" onClick={onOpenPlanner} className="rounded-[16px] border border-slate-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-blue-100/80">
              Ouvrir la zone réunions
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {!auth.token ? (
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            Connectez-vous dans Campus Hub pour afficher vos réunions planifiées.
          </div>
        ) : recentMeetings.length === 0 ? (
          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
            Aucune réunion récente à afficher pour le moment.
          </div>
        ) : (
          recentMeetings.map((meeting) => (
            <div key={meeting.roomId} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{meeting.title || 'Réunion Meetra'}</div>
                  <div className="mt-1 text-sm text-slate-600">{formatScheduledMeeting(meeting.scheduledFor, meeting.timezone)}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {meeting.hostName ? `Hôte prévu: ${meeting.hostName}` : 'Hôte non renseigné'} · {meeting.durationMinutes || DEFAULT_DURATION_MINUTES} min
                  </div>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                  Mon compte
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => onCopyMeetingLink(meeting)} className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100">
                  Copier le lien
                </button>
                <button type="button" onClick={() => onJoinMeeting(meeting)} className="rounded-[14px] border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 transition hover:bg-blue-100/80">
                  Rejoindre
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MenuModal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm md:py-12">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="relative z-10 w-full max-w-5xl">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/12 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            Fermer
          </button>
        </div>
        <div className="max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[24px] md:rounded-[32px] md:max-h-[calc(100vh-8rem)]">
          {children}
        </div>
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
  const [meetingTitle, setMeetingTitle] = useState('Réunion Meetra');
  const [scheduledDate, setScheduledDate] = useState(getDefaultScheduleDate);
  const [scheduledTime, setScheduledTime] = useState(getDefaultScheduleTime);
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto');
  const [hostEmail, setHostEmail] = useState('');
  const [hostPhone, setHostPhone] = useState('');
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [hubSnapshot, setHubSnapshot] = useState({ onlineCount: 0, conversationCount: 0 });
  const [openMenu, setOpenMenu] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
      { title: 'Meetings', body: 'Réunions vidéo, admission, co-hôte, partage d’écran, chat et sous-titres dans une seule expérience.', icon: 'meetings' },
      { title: 'Phone', body: 'Appels et coordination d’équipe pour étendre Meetra au-delà de la réunion web.', icon: 'phone' },
      { title: 'Whiteboard', body: 'Tableau blanc collaboratif pour expliquer, annoter et piloter des ateliers.', icon: 'whiteboard' },
      { title: 'Chat', body: 'Messagerie contextuelle intégrée pour garder les échanges visibles pendant la réunion.', icon: 'chat' },
      { title: 'Rooms', body: 'Vision hybride avec présence, espaces partagés et salles collaboratives.', icon: 'rooms' },
      { title: 'Mail & Calendar', body: 'Invitations, rappels et coordination de planning autour des réunions.', icon: 'mail' },
    ],
    plateforme: [
      { title: 'Campus Hub', body: 'Connexion, présence, annuaire, messages et vie du campus visibles dès l’accueil.', icon: 'hub' },
      { title: 'Salle d’attente', body: 'Admission des invités avec contrôle hôte et meilleure lisibilité du flux d’entrée.', icon: 'platform' },
      { title: 'Transcription', body: 'Sous-titres et base de résumé prêts pour une évolution vers la traduction live.', icon: 'docs' },
      { title: 'Automatisation', body: 'Notifications hôte, webhooks et ponts vers email ou intégrations externes.', icon: 'alerts' },
    ],
    ressources: [
      { title: 'Réunions récentes', body: 'Retrouver rapidement un lien planifié, relancer ou modifier une réunion existante.', icon: 'scheduler' },
      { title: 'Pré-test audio/vidéo', body: 'Tester caméra, micro et haut-parleurs avant de rejoindre une salle.', icon: 'meetings' },
      { title: 'Paramètres', body: 'Caméra, micro, sous-titres et préférences de réunion centralisés.', icon: 'settings' },
      { title: 'Évolutions IA', body: 'Résumé, transcription enrichie et future traduction temps réel.', icon: 'docs' },
    ],
  };

  const closePanels = () => {
    setOpenMenu('');
    setSearchOpen(false);
  };

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closePanels();
  };

  const openJoinMeeting = () => {
    scrollToSection('meetra-join');
  };

  const openHostMeeting = () => {
    scrollToSection('meetra-planner');
  };

  const joinRecentMeeting = (meeting) => {
    if (!effectiveUserName) {
      setError('Entrez votre nom pour rejoindre la réunion planifiée.');
      closePanels();
      scrollToSection('meetra-planner');
      return;
    }
    closePanels();
    onJoin(meeting.roomId, effectiveUserName);
  };

  const searchItems = [
    { id: 'campus', label: 'Campus Hub', sectionId: 'meetra-campus-hub' },
    { id: 'organiser', label: 'Créer ou planifier une réunion', sectionId: 'meetra-planner' },
    { id: 'participer', label: 'Participer à une réunion', sectionId: 'meetra-join' },
    { id: 'recent', label: 'Mes réunions', menu: 'ressources' },
  ];

  const filteredSearchItems = searchItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

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
      setHubSnapshot({ onlineCount: 0, conversationCount: 0 });
      return;
    }
    loadRecentMeetings();
  }, [auth.token]);

  useEffect(() => {
    if (!auth.token) return;

    const loadHubSnapshot = async () => {
      try {
        const [presenceRes, conversationsRes] = await Promise.all([
          authFetch('/api/hub/presence'),
          authFetch('/api/hub/conversations'),
        ]);

        const presenceData = await presenceRes.json().catch(() => ({ items: [] }));
        const conversationData = await conversationsRes.json().catch(() => ({ items: [] }));

        setHubSnapshot({
          onlineCount: Array.isArray(presenceData.items) ? presenceData.items.length : 0,
          conversationCount: Array.isArray(conversationData.items) ? conversationData.items.length : 0,
        });
      } catch {
        setHubSnapshot({ onlineCount: 0, conversationCount: 0 });
      }
    };

    loadHubSnapshot();
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
          <section className="meetra-surface meetra-accent-panel overflow-hidden rounded-[28px] px-4 py-5 sm:px-6 md:rounded-[36px] md:px-8 md:py-8">
            <header className="relative">
              <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-slate-950/45 px-4 py-4 shadow-[0_22px_44px_rgba(2,6,23,0.18)] sm:px-5 2xl:px-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-blue-300/15 bg-gradient-to-br from-blue-500/18 to-emerald-400/12 text-blue-50 shadow-[0_22px_50px_rgba(37,99,235,0.22)]">
                    <VideoAppIcon size={24} />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Workspace vidéo</div>
                    <div className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-[28px]">Meetra</div>
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
                  <button type="button" onClick={() => {
                    setOpenMenu('');
                    setSearchOpen(true);
                  }} className="meetra-focus-ring whitespace-nowrap rounded-full px-5 py-3 text-[15px] font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-slate-100">
                    Accès rapide
                  </button>
                </nav>

                <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
                  <button type="button" onClick={() => scrollToSection('meetra-campus-hub')} className="meetra-focus-ring whitespace-nowrap rounded-full px-5 py-3 text-[15px] font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-slate-100">
                    Campus Hub
                  </button>
                  <button type="button" onClick={() => scrollToSection('meetra-campus-hub')} className="meetra-button meetra-focus-ring whitespace-nowrap px-5 py-3 text-[15px] font-semibold text-slate-100">
                    Accéder au Hub
                  </button>
                  <button type="button" onClick={() => scrollToSection('meetra-planner')} className="meetra-button meetra-button-primary meetra-focus-ring whitespace-nowrap px-5 py-3 text-[15px] font-semibold text-white">
                    Réunion immédiate
                  </button>
                </div>
                </div>
              </div>

            </header>

            <div className="rounded-[22px] border border-blue-400/14 bg-blue-500/10 px-4 py-3 text-sm text-blue-50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SparkIcon size={16} />
                  <span>Campus Hub, réunion, planification et échanges directs dans une seule interface.</span>
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

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-blue-300/15 bg-gradient-to-br from-blue-500/18 to-emerald-400/12 text-blue-50 shadow-[0_22px_50px_rgba(37,99,235,0.22)]">
                    <VideoAppIcon size={25} />
                  </div>
                  <div>
                    <div className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">Meetra platform</div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl md:text-4xl">Travail connecté, réunions planifiées, salle d’attente intégrée</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-300">
                  {['Campus Hub', 'Réunions', 'Planification', 'Admissions', 'Sous-titres', 'Co-hôte'].map((item) => (
                    <span key={item} className="meetra-badge">{item}</span>
                  ))}
                </div>

                <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base md:text-lg md:leading-8">
                  Ouvrez le Campus Hub, créez ou planifiez une salle, rejoignez avec un lien public et discutez avec les membres connectés sans traverser une page trop longue.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToSection('meetra-campus-hub')}
                    className="meetra-button meetra-button-primary meetra-focus-ring inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white"
                  >
                    Ouvrir le Hub
                    <ArrowRightIcon size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('meetra-planner')}
                    className="meetra-button meetra-focus-ring inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-100"
                  >
                    Créer ou planifier
                    <SparkIcon size={15} />
                  </button>
                </div>
              </div>

              <div className="meetra-hero-panel relative rounded-[24px] p-4 sm:p-5 md:rounded-[32px]">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/18 blur-3xl" />
                <div className="absolute bottom-0 left-10 h-36 w-36 rounded-full bg-emerald-400/12 blur-3xl" />
                <div className="relative grid gap-4">
                  <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-4 sm:p-5">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Démarrage rapide</div>
                    <div className="mt-3 text-lg font-semibold text-slate-50 sm:text-xl">Campus Hub, réunion, accès hôte.</div>
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
            <div className="meetra-card-grid mt-3 grid gap-3 lg:grid-cols-3 lg:gap-4">
            <div className="meetra-surface meetra-subtle-card meetra-shortcut-card rounded-[24px] border-blue-400/20 bg-[linear-gradient(180deg,rgba(37,99,235,0.17),rgba(255,255,255,0.04))] p-4 sm:p-5 md:rounded-[28px]">
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
            <div className="meetra-surface meetra-subtle-card meetra-shortcut-card rounded-[24px] border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.15),rgba(255,255,255,0.04))] p-4 sm:p-5 md:rounded-[28px]">
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
            <div className="meetra-surface meetra-subtle-card meetra-shortcut-card rounded-[24px] border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(255,255,255,0.04))] p-4 sm:p-5 md:rounded-[28px]">
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

        {openMenu && (
          <MenuModal onClose={closePanels}>
            {openMenu === 'lancer' ? (
              <LaunchMeetingDropdown onJoinMeeting={openJoinMeeting} onHostMeeting={openHostMeeting} />
            ) : openMenu === 'plateforme' ? (
              <PlatformOverviewModal
                onOpenHub={() => scrollToSection('meetra-campus-hub')}
                onOpenPlanner={() => scrollToSection('meetra-planner')}
                onOpenJoin={() => scrollToSection('meetra-join')}
                isSignedIn={Boolean(auth.token)}
                recentCount={recentMeetings.length}
                hubSnapshot={hubSnapshot}
              />
            ) : openMenu === 'ressources' ? (
              <ResourcesModal
                auth={auth}
                recentMeetings={recentMeetings}
                loadingRecent={loadingRecent}
                onRefresh={loadRecentMeetings}
                onJoinMeeting={joinRecentMeeting}
                onCopyMeetingLink={copyRecentMeetingLink}
                onOpenPlanner={() => scrollToSection('meetra-planner')}
              />
            ) : (
              <NavDropdown
                title={openMenu}
                items={navMenus[openMenu] || []}
                actions={openMenu === 'produits' ? [
                  {
                    label: 'Ouvrir le Hub',
                    body: 'Accéder directement à Campus Hub pour la connexion et les échanges.',
                    tone: 'blue',
                    onClick: () => scrollToSection('meetra-campus-hub'),
                  },
                  {
                    label: 'Créer une réunion',
                    body: 'Aller immédiatement à la zone de création et de planification.',
                    tone: 'emerald',
                    onClick: () => scrollToSection('meetra-planner'),
                  },
                  {
                    label: 'Rejoindre une salle',
                    body: 'Accéder au formulaire de participation avec un lien ou un ID.',
                    tone: 'amber',
                    onClick: () => scrollToSection('meetra-join'),
                  },
                ] : []}
              />
            )}
          </MenuModal>
        )}

        {searchOpen && (
          <MenuModal onClose={closePanels}>
            <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.98))] p-5 text-slate-900 shadow-[0_34px_90px_rgba(2,6,23,0.28)]">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Accès rapide</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">Ouvrir directement une action clé</div>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une action Meetra"
                className="mt-4 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                autoFocus
              />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {filteredSearchItems.length === 0 ? (
                  <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Aucun résultat pour cette recherche.
                  </div>
                ) : (
                  filteredSearchItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.menu) {
                          setSearchOpen(false);
                          setOpenMenu(item.menu);
                          return;
                        }
                        scrollToSection(item.sectionId);
                      }}
                      className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50/60"
                    >
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </MenuModal>
        )}

        {!prefillRoomId && (
          <CampusHub />
        )}

        <div className="mt-6 grid min-h-full gap-6 xl:grid-cols-[1.08fr_0.92fr] xl:items-start">
          <section id="meetra-planner" className="meetra-surface meetra-accent-panel rounded-[28px] p-4 sm:p-6 md:rounded-[32px] md:p-8">
          {!prefillRoomId && (
            <div className="mb-5">
              <div className="meetra-section-label">Réunions</div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Créer, planifier ou rejoindre</div>
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
          <section className="meetra-surface meetra-subtle-card rounded-[28px] px-4 py-6 sm:px-6 md:rounded-[32px] md:px-8 md:py-8 xl:meetra-sticky-panel">
              <div className="meetra-section-label">Parcours rapide</div>
              <div className="mt-3 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Ordre recommandé</div>
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
