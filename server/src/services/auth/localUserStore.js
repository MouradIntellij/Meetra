import fs from 'node:fs';
import path from 'node:path';
import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const baseDir = path.resolve(process.cwd(), ENV.AUTH_STORE_DIR);
const storeFile = path.join(baseDir, 'users.json');

function ensureBaseDir() {
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
}

function readUsers() {
  ensureBaseDir();
  if (!fs.existsSync(storeFile)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.warn('Local auth store read failed:', error?.message);
    return [];
  }
}

function writeUsers(users) {
  ensureBaseDir();
  fs.writeFileSync(storeFile, JSON.stringify(users, null, 2), 'utf8');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function findUserByEmailFromLocal(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  return readUsers().find((user) => user.email === normalizedEmail) || null;
}

export async function createUserInLocal(user) {
  const users = readUsers();
  if (users.some((entry) => entry.email === user.email)) {
    return null;
  }

  users.push(user);
  writeUsers(users);
  return user;
}

export async function updateUserLoginInLocal(email) {
  const normalizedEmail = normalizeEmail(email);
  const users = readUsers();
  const index = users.findIndex((user) => user.email === normalizedEmail);
  if (index < 0) return false;

  const now = Date.now();
  users[index] = {
    ...users[index],
    lastLoginAt: now,
    updatedAt: now,
  };
  writeUsers(users);
  return true;
}
