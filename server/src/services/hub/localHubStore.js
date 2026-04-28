import fs from 'node:fs';
import path from 'node:path';
import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const baseDir = path.resolve(process.cwd(), ENV.HUB_STORE_DIR);
const storeFile = path.join(baseDir, 'hub.json');

function ensureBaseDir() {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
}

function emptyStore() {
  return {
    profiles: [],
    messages: [],
    activities: [],
  };
}

function readStore() {
  ensureBaseDir();
  if (!fs.existsSync(storeFile)) return emptyStore();

  try {
    const parsed = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    return {
      profiles: Array.isArray(parsed?.profiles) ? parsed.profiles : [],
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
      activities: Array.isArray(parsed?.activities) ? parsed.activities : [],
    };
  } catch (error) {
    logger.warn('Local hub store read failed:', error?.message);
    return emptyStore();
  }
}

function writeStore(store) {
  ensureBaseDir();
  fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function buildConversationKey(a, b) {
  return [normalizeEmail(a), normalizeEmail(b)].sort().join('::');
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function upsertHubProfileInLocal({ email, name, role = 'member', presenceStatus = 'available' }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const store = readStore();
  const now = Date.now();
  const index = store.profiles.findIndex((profile) => profile.email === normalizedEmail);
  const current = index >= 0 ? store.profiles[index] : null;
  const nextProfile = {
    email: normalizedEmail,
    name: name || current?.name || normalizedEmail,
    role: role || current?.role || 'member',
    presenceStatus: presenceStatus || current?.presenceStatus || 'available',
    createdAt: current?.createdAt || now,
    updatedAt: now,
    lastSeenAt: now,
  };

  if (index >= 0) store.profiles[index] = nextProfile;
  else store.profiles.push(nextProfile);

  writeStore(store);
  return nextProfile;
}

export async function getHubProfileFromLocal(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  return readStore().profiles.find((profile) => profile.email === normalizedEmail) || null;
}

export async function searchHubProfilesFromLocal({ query = '', excludeEmail = '' } = {}) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const normalizedExclude = normalizeEmail(excludeEmail);

  return readStore().profiles
    .filter((profile) => profile.email !== normalizedExclude)
    .filter((profile) => (
      !normalizedQuery
      || profile.email.toLowerCase().includes(normalizedQuery)
      || String(profile.name || '').toLowerCase().includes(normalizedQuery)
    ))
    .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
}

export async function appendHubActivityInLocal({ type, title, body, targetEmail, actorEmail = '', actorName = '', meta = {} }) {
  const normalizedTarget = normalizeEmail(targetEmail);
  if (!normalizedTarget) return null;

  const store = readStore();
  const item = {
    id: makeId('act'),
    type: String(type || 'info'),
    title: String(title || 'Activité'),
    body: String(body || ''),
    targetEmail: normalizedTarget,
    actorEmail: normalizeEmail(actorEmail),
    actorName: String(actorName || '').trim(),
    meta,
    createdAt: Date.now(),
  };

  store.activities.push(item);
  writeStore(store);
  return item;
}

export async function listHubActivityFromLocal(email, limit = 20) {
  const normalizedEmail = normalizeEmail(email);
  return readStore().activities
    .filter((item) => item.targetEmail === normalizedEmail)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

export async function addHubMessageInLocal({ fromEmail, fromName, toEmail, content }) {
  const normalizedFrom = normalizeEmail(fromEmail);
  const normalizedTo = normalizeEmail(toEmail);
  const normalizedContent = String(content || '').trim();
  if (!normalizedFrom || !normalizedTo || !normalizedContent) return null;

  const store = readStore();
  const message = {
    id: makeId('dm'),
    conversationKey: buildConversationKey(normalizedFrom, normalizedTo),
    fromEmail: normalizedFrom,
    fromName: String(fromName || normalizedFrom).trim(),
    toEmail: normalizedTo,
    content: normalizedContent,
    createdAt: Date.now(),
    readAt: null,
  };

  store.messages.push(message);
  writeStore(store);

  const activity = await appendHubActivityInLocal({
    type: 'message',
    title: 'Nouveau message direct',
    body: `${message.fromName} vous a envoyé un message.`,
    targetEmail: message.toEmail,
    actorEmail: message.fromEmail,
    actorName: message.fromName,
    meta: {
      conversationWith: message.fromEmail,
      messageId: message.id,
    },
  });

  return { message, activity };
}

export async function listHubMessagesFromLocal({ email, peerEmail, limit = 100 }) {
  const conversationKey = buildConversationKey(email, peerEmail);
  return readStore().messages
    .filter((message) => message.conversationKey === conversationKey)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .slice(0, limit);
}

export async function listHubConversationsFromLocal(email) {
  const normalizedEmail = normalizeEmail(email);
  const store = readStore();
  const profiles = new Map(store.profiles.map((profile) => [profile.email, profile]));
  const byPeer = new Map();

  for (const message of store.messages) {
    if (message.fromEmail !== normalizedEmail && message.toEmail !== normalizedEmail) continue;
    const peerEmail = message.fromEmail === normalizedEmail ? message.toEmail : message.fromEmail;
    const current = byPeer.get(peerEmail);
    if (!current || (message.createdAt || 0) > (current.lastMessage?.createdAt || 0)) {
      byPeer.set(peerEmail, { peerEmail, lastMessage: message });
    }
  }

  return Array.from(byPeer.values())
    .map(({ peerEmail, lastMessage }) => {
      const peerProfile = profiles.get(peerEmail);
      const unreadCount = store.messages.filter((message) => (
        message.fromEmail === peerEmail
        && message.toEmail === normalizedEmail
        && !message.readAt
      )).length;

      return {
        peer: {
          email: peerEmail,
          name: peerProfile?.name || peerEmail,
          role: peerProfile?.role || 'member',
          presenceStatus: peerProfile?.presenceStatus || 'available',
        },
        lastMessage: {
          fromEmail: lastMessage.fromEmail,
          fromName: lastMessage.fromName,
          toEmail: lastMessage.toEmail,
          content: lastMessage.content,
          createdAt: lastMessage.createdAt,
        },
        unreadCount,
      };
    })
    .sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0));
}

export async function markHubConversationReadInLocal({ email, peerEmail }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPeer = normalizeEmail(peerEmail);
  const store = readStore();
  const now = Date.now();
  let updated = 0;

  store.messages = store.messages.map((message) => {
    if (message.toEmail === normalizedEmail && message.fromEmail === normalizedPeer && !message.readAt) {
      updated += 1;
      return { ...message, readAt: now };
    }
    return message;
  });

  if (updated > 0) {
    writeStore(store);
  }
  return updated;
}
