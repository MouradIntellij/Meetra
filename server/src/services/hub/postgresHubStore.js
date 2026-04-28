import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

let pool = null;
let initialized = false;

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!hasDatabase()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('render.com')
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return pool;
}

export function isPostgresHubStoreEnabled() {
  return hasDatabase();
}

export async function initHubTables() {
  if (initialized || !isPostgresHubStoreEnabled()) return;
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS hub_profiles (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      presence_status TEXT NOT NULL DEFAULT 'available',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      last_seen_at BIGINT NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS hub_messages (
      id TEXT PRIMARY KEY,
      conversation_key TEXT NOT NULL,
      from_email TEXT NOT NULL,
      from_name TEXT NOT NULL,
      to_email TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      read_at BIGINT NULL
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS hub_messages_conversation_created_idx
    ON hub_messages(conversation_key, created_at);
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS hub_activities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      target_email TEXT NOT NULL,
      actor_email TEXT NULL,
      actor_name TEXT NULL,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at BIGINT NOT NULL
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS hub_activities_target_created_idx
    ON hub_activities(target_email, created_at DESC);
  `);

  initialized = true;
  logger.info('Hub Postgres tables ready');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function buildConversationKey(a, b) {
  return [normalizeEmail(a), normalizeEmail(b)].sort().join('::');
}

export async function upsertHubProfileInDb({ email, name, role = 'member', presenceStatus = 'available' }) {
  if (!isPostgresHubStoreEnabled()) return null;
  await initHubTables();
  const db = getPool();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const now = Date.now();

  await db.query(
    `INSERT INTO hub_profiles (email, name, role, presence_status, created_at, updated_at, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (email)
     DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       presence_status = EXCLUDED.presence_status,
       updated_at = EXCLUDED.updated_at,
       last_seen_at = EXCLUDED.last_seen_at`,
    [normalizedEmail, name || normalizedEmail, role || 'member', presenceStatus || 'available', now, now, now]
  );

  return getHubProfileFromDb(normalizedEmail);
}

export async function getHubProfileFromDb(email) {
  if (!isPostgresHubStoreEnabled()) return null;
  await initHubTables();
  const db = getPool();
  const normalizedEmail = normalizeEmail(email);
  const result = await db.query(
    `SELECT email, name, role, presence_status, created_at, updated_at, last_seen_at
     FROM hub_profiles
     WHERE email = $1`,
    [normalizedEmail]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    email: row.email,
    name: row.name,
    role: row.role,
    presenceStatus: row.presence_status,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastSeenAt: Number(row.last_seen_at),
  };
}

export async function searchHubProfilesFromDb({ query = '', excludeEmail = '' } = {}) {
  if (!isPostgresHubStoreEnabled()) return [];
  await initHubTables();
  const db = getPool();
  const normalizedQuery = `%${String(query || '').trim().toLowerCase()}%`;
  const normalizedExclude = normalizeEmail(excludeEmail);
  const result = await db.query(
    `SELECT email, name, role, presence_status, created_at, updated_at, last_seen_at
     FROM hub_profiles
     WHERE ($1 = '%%' OR LOWER(email) LIKE $1 OR LOWER(name) LIKE $1)
       AND ($2 = '' OR email <> $2)
     ORDER BY last_seen_at DESC`,
    [normalizedQuery, normalizedExclude]
  );
  return result.rows.map((row) => ({
    email: row.email,
    name: row.name,
    role: row.role,
    presenceStatus: row.presence_status,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastSeenAt: Number(row.last_seen_at),
  }));
}

export async function appendHubActivityInDb({ type, title, body, targetEmail, actorEmail = '', actorName = '', meta = {} }) {
  if (!isPostgresHubStoreEnabled()) return null;
  await initHubTables();
  const db = getPool();
  const item = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: String(type || 'info'),
    title: String(title || 'Activité'),
    body: String(body || ''),
    targetEmail: normalizeEmail(targetEmail),
    actorEmail: normalizeEmail(actorEmail),
    actorName: String(actorName || '').trim(),
    meta,
    createdAt: Date.now(),
  };

  await db.query(
    `INSERT INTO hub_activities (id, type, title, body, target_email, actor_email, actor_name, meta, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [item.id, item.type, item.title, item.body, item.targetEmail, item.actorEmail || null, item.actorName || null, item.meta || {}, item.createdAt]
  );
  return item;
}

export async function listHubActivityFromDb(email, limit = 20) {
  if (!isPostgresHubStoreEnabled()) return [];
  await initHubTables();
  const db = getPool();
  const result = await db.query(
    `SELECT id, type, title, body, target_email, actor_email, actor_name, meta, created_at
     FROM hub_activities
     WHERE target_email = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [normalizeEmail(email), limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    targetEmail: row.target_email,
    actorEmail: row.actor_email,
    actorName: row.actor_name,
    meta: row.meta || {},
    createdAt: Number(row.created_at),
  }));
}

export async function addHubMessageInDb({ fromEmail, fromName, toEmail, content }) {
  if (!isPostgresHubStoreEnabled()) return null;
  await initHubTables();
  const db = getPool();
  const message = {
    id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversationKey: buildConversationKey(fromEmail, toEmail),
    fromEmail: normalizeEmail(fromEmail),
    fromName: String(fromName || fromEmail).trim(),
    toEmail: normalizeEmail(toEmail),
    content: String(content || '').trim(),
    createdAt: Date.now(),
    readAt: null,
  };
  if (!message.fromEmail || !message.toEmail || !message.content) return null;

  await db.query(
    `INSERT INTO hub_messages (id, conversation_key, from_email, from_name, to_email, content, created_at, read_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [message.id, message.conversationKey, message.fromEmail, message.fromName, message.toEmail, message.content, message.createdAt, null]
  );

  const activity = await appendHubActivityInDb({
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

export async function listHubMessagesFromDb({ email, peerEmail, limit = 100 }) {
  if (!isPostgresHubStoreEnabled()) return [];
  await initHubTables();
  const db = getPool();
  const result = await db.query(
    `SELECT id, conversation_key, from_email, from_name, to_email, content, created_at, read_at
     FROM hub_messages
     WHERE conversation_key = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [buildConversationKey(email, peerEmail), limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    conversationKey: row.conversation_key,
    fromEmail: row.from_email,
    fromName: row.from_name,
    toEmail: row.to_email,
    content: row.content,
    createdAt: Number(row.created_at),
    readAt: row.read_at ? Number(row.read_at) : null,
  }));
}

export async function listHubConversationsFromDb(email) {
  if (!isPostgresHubStoreEnabled()) return [];
  await initHubTables();
  const db = getPool();
  const normalizedEmail = normalizeEmail(email);
  const result = await db.query(
    `SELECT DISTINCT ON (peer_email)
        peer_email,
        from_email,
        from_name,
        to_email,
        content,
        created_at,
        COALESCE(unread_counts.unread_count, 0) AS unread_count,
        profile.name AS peer_name,
        profile.role AS peer_role,
        profile.presence_status AS peer_presence_status
     FROM (
        SELECT
          CASE WHEN from_email = $1 THEN to_email ELSE from_email END AS peer_email,
          from_email,
          from_name,
          to_email,
          content,
          created_at
        FROM hub_messages
        WHERE from_email = $1 OR to_email = $1
     ) latest
     LEFT JOIN (
        SELECT from_email AS peer_email, COUNT(*) AS unread_count
        FROM hub_messages
        WHERE to_email = $1 AND read_at IS NULL
        GROUP BY from_email
     ) unread_counts ON unread_counts.peer_email = latest.peer_email
     LEFT JOIN hub_profiles profile ON profile.email = latest.peer_email
     ORDER BY peer_email, created_at DESC`,
    [normalizedEmail]
  );

  return result.rows.map((row) => ({
    peer: {
      email: row.peer_email,
      name: row.peer_name || row.peer_email,
      role: row.peer_role || 'member',
      presenceStatus: row.peer_presence_status || 'available',
    },
    lastMessage: {
      fromEmail: row.from_email,
      fromName: row.from_name,
      toEmail: row.to_email,
      content: row.content,
      createdAt: Number(row.created_at),
    },
    unreadCount: Number(row.unread_count || 0),
  }));
}

export async function markHubConversationReadInDb({ email, peerEmail }) {
  if (!isPostgresHubStoreEnabled()) return 0;
  await initHubTables();
  const db = getPool();
  const now = Date.now();
  const result = await db.query(
    `UPDATE hub_messages
     SET read_at = $3
     WHERE to_email = $1
       AND from_email = $2
       AND read_at IS NULL`,
    [normalizeEmail(email), normalizeEmail(peerEmail), now]
  );
  return result.rowCount || 0;
}
