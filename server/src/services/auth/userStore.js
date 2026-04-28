import fs from 'node:fs';
import path from 'node:path';
import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import {
  createUserInDb,
  findUserByEmailFromDb,
  isPostgresUserStoreEnabled,
  updateUserLoginInDb,
} from './postgresUserStore.js';

const baseDir = path.resolve(process.cwd(), ENV.AUTH_STORE_DIR);
const filePath = path.join(baseDir, 'users.json');

function ensureStore() {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    logger.warn('User store read failed:', error?.message);
    return { users: [] };
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
}

export async function findUserByEmail(email) {
  if (isPostgresUserStoreEnabled()) {
    return findUserByEmailFromDb(email);
  }
  return (readStore().users || []).find((user) => user.email === email) || null;
}

export async function createUser(user) {
  if (isPostgresUserStoreEnabled()) {
    return createUserInDb(user);
  }
  const store = readStore();
  store.users.push(user);
  writeStore(store);
  return user;
}

export async function updateUserLogin(email) {
  if (isPostgresUserStoreEnabled()) {
    return updateUserLoginInDb(email);
  }
  const store = readStore();
  const user = (store.users || []).find((entry) => entry.email === email);
  if (!user) return false;
  user.lastLoginAt = Date.now();
  user.updatedAt = Date.now();
  writeStore(store);
  return true;
}
