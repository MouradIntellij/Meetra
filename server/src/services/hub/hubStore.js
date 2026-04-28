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

function ensureStore() {
  ensureBaseDir();
  if (!fs.existsSync(storeFile)) {
    fs.writeFileSync(storeFile, JSON.stringify({
      profiles: {},
      messages: [],
      activities: [],
    }, null, 2), 'utf8');
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  } catch (error) {
    logger.warn('Hub store read failed:', error?.message);
    return { profiles: {}, messages: [], activities: [] };
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), 'utf8');
}

function buildConversationKey(a, b) {
  return [normalizeEmail(a), normalizeEmail(b)].sort().join('::');
}

export function upsertHubProfile({ email, name, role = 'member' }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const store = readStore();
  const existing = store.profiles[normalizedEmail];
  const now = Date.now();
  const profile = {
    email: normalizedEmail,
    name: String(name || existing?.name || normalizedEmail.split('@')[0] || 'Membre').trim(),
    role: String(role || existing?.role || 'member').trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastSeenAt: now,
  };

  store.profiles[normalizedEmail] = profile;
  writeStore(store);
  return profile;
}

export function getHubProfile(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  return readStore().profiles[normalizedEmail] || null;
}

export function searchHubProfiles({ query = '', excludeEmail = '' } = {}) {
  const normalizedExclude = normalizeEmail(excludeEmail);
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const profiles = Object.values(readStore().profiles || {});

  return profiles
    .filter((profile) => profile.email !== normalizedExclude)
    .filter((profile) => {
      if (!normalizedQuery) return true;
      return profile.email.includes(normalizedQuery) || profile.name.toLowerCase().includes(normalizedQuery);
    })
    .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
}

export function appendHubActivity({ type, title, body, targetEmail, actorEmail = '', actorName = '', meta = {} }) {
  const normalizedTarget = normalizeEmail(targetEmail);
  if (!normalizedTarget) return null;

  const store = readStore();
  const item = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: String(type || 'info'),
    title: String(title || 'Activité'),
    body: String(body || ''),
    targetEmail: normalizedTarget,
    actorEmail: normalizeEmail(actorEmail),
    actorName: String(actorName || '').trim(),
    createdAt: Date.now(),
    meta,
  };

  store.activities.unshift(item);
  store.activities = store.activities.slice(0, 500);
  writeStore(store);
  return item;
}

export function listHubActivity(email, limit = 20) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];
  return (readStore().activities || [])
    .filter((item) => item.targetEmail === normalizedEmail)
    .slice(0, limit);
}

export function addHubMessage({ fromEmail, fromName, toEmail, content }) {
  const normalizedFrom = normalizeEmail(fromEmail);
  const normalizedTo = normalizeEmail(toEmail);
  const trimmedContent = String(content || '').trim();
  if (!normalizedFrom || !normalizedTo || !trimmedContent) return null;

  const store = readStore();
  const now = Date.now();
  const message = {
    id: `dm-${now}-${Math.random().toString(36).slice(2, 8)}`,
    conversationKey: buildConversationKey(normalizedFrom, normalizedTo),
    fromEmail: normalizedFrom,
    fromName: String(fromName || store.profiles[normalizedFrom]?.name || normalizedFrom).trim(),
    toEmail: normalizedTo,
    content: trimmedContent,
    createdAt: now,
    readAt: null,
  };

  store.messages.push(message);
  writeStore(store);

  const activity = appendHubActivity({
    type: 'message',
    title: 'Nouveau message direct',
    body: `${message.fromName} vous a envoyé un message.`,
    targetEmail: normalizedTo,
    actorEmail: normalizedFrom,
    actorName: message.fromName,
    meta: {
      conversationWith: normalizedFrom,
      messageId: message.id,
    },
  });

  return { message, activity };
}

export function listHubMessages({ email, peerEmail, limit = 100 }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPeer = normalizeEmail(peerEmail);
  if (!normalizedEmail || !normalizedPeer) return [];

  const conversationKey = buildConversationKey(normalizedEmail, normalizedPeer);
  return (readStore().messages || [])
    .filter((message) => message.conversationKey === conversationKey)
    .slice(-limit);
}

export function listHubConversations(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const store = readStore();
  const latestByPeer = new Map();

  for (const message of store.messages || []) {
    if (message.fromEmail !== normalizedEmail && message.toEmail !== normalizedEmail) continue;
    const peerEmail = message.fromEmail === normalizedEmail ? message.toEmail : message.fromEmail;
    const current = latestByPeer.get(peerEmail);
    if (!current || (message.createdAt || 0) > (current.lastMessage?.createdAt || 0)) {
      latestByPeer.set(peerEmail, {
        peer: store.profiles[peerEmail] || {
          email: peerEmail,
          name: peerEmail.split('@')[0] || peerEmail,
          role: 'member',
        },
        lastMessage: message,
        unreadCount: 0,
      });
    }

    if (message.toEmail === normalizedEmail && !message.readAt) {
      const target = latestByPeer.get(peerEmail);
      target.unreadCount += 1;
    }
  }

  return Array.from(latestByPeer.values()).sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0));
}

export function markHubConversationRead({ email, peerEmail }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPeer = normalizeEmail(peerEmail);
  if (!normalizedEmail || !normalizedPeer) return 0;

  const store = readStore();
  let updated = 0;

  for (const message of store.messages || []) {
    if (message.toEmail === normalizedEmail && message.fromEmail === normalizedPeer && !message.readAt) {
      message.readAt = Date.now();
      updated += 1;
    }
  }

  if (updated > 0) {
    writeStore(store);
  }

  return updated;
}
