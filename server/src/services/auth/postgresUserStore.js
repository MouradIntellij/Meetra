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

export function isPostgresUserStoreEnabled() {
  return hasDatabase();
}

export async function initUserTables() {
  if (initialized || !isPostgresUserStoreEnabled()) return;
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      password_hash TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      last_login_at BIGINT NULL
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS users_email_idx
    ON users(email);
  `);

  initialized = true;
  logger.info('User Postgres tables ready');
}

export async function findUserByEmailFromDb(email) {
  if (!isPostgresUserStoreEnabled()) return null;
  await initUserTables();
  const db = getPool();
  const result = await db.query(
    `SELECT id, email, name, role, password_hash, created_at, updated_at, last_login_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastLoginAt: row.last_login_at ? Number(row.last_login_at) : null,
  };
}

export async function createUserInDb(user) {
  if (!isPostgresUserStoreEnabled()) return null;
  await initUserTables();
  const db = getPool();
  await db.query(
    `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at, last_login_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      user.id,
      user.email,
      user.name,
      user.role,
      user.passwordHash,
      user.createdAt,
      user.updatedAt,
      user.lastLoginAt ?? null,
    ]
  );
  return user;
}

export async function updateUserLoginInDb(email) {
  if (!isPostgresUserStoreEnabled()) return false;
  await initUserTables();
  const db = getPool();
  const now = Date.now();
  await db.query(
    `UPDATE users
     SET last_login_at = $2, updated_at = $2
     WHERE email = $1`,
    [email, now]
  );
  return true;
}
