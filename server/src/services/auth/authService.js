import crypto from 'node:crypto';
import { ENV } from '../../config/env.js';
import { generateId } from '../../utils/uuid.js';
import { createUser, findUserByEmail, updateUserLogin } from './userStore.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expectedHash] = String(storedHash || '').split(':');
  if (!salt || !expectedHash) return false;
  const candidateHash = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(expectedHash));
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signTokenPayload(payload) {
  return crypto
    .createHmac('sha256', ENV.SESSION_SECRET)
    .update(payload)
    .digest('base64url');
}

function createSessionToken(profile) {
  const payload = {
    sub: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000),
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = signTokenPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || !String(token).includes('.')) return null;
  const [encodedPayload, signature] = String(token).split('.');
  const expectedSignature = signTokenPayload(encodedPayload);
  if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload?.email || !payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function registerUser({ name, email, password, role = 'member' }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !String(name || '').trim() || String(password || '').length < 6) {
    return { error: 'INVALID_REGISTRATION_PAYLOAD' };
  }

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    return { error: 'EMAIL_ALREADY_EXISTS' };
  }

  const now = Date.now();
  const user = await createUser({
    id: generateId(),
    email: normalizedEmail,
    name: String(name || '').trim(),
    role: String(role || 'member').trim(),
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  });

  const profile = sanitizeUser(user);
  return {
    profile,
    token: createSessionToken(profile),
  };
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByEmail(normalizedEmail);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: 'INVALID_CREDENTIALS' };
  }

  await updateUserLogin(normalizedEmail);
  const refreshed = await findUserByEmail(normalizedEmail);
  const profile = sanitizeUser(refreshed || user);
  return {
    profile,
    token: createSessionToken(profile),
  };
}

export async function resolveAuthenticatedUserFromToken(token) {
  const payload = verifySessionToken(token);
  if (!payload?.email) return null;
  const user = await findUserByEmail(payload.email);
  return user ? sanitizeUser(user) : null;
}

export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'member',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}
