import express from 'express';
import { getBearerToken } from './authRoutes.js';
import { resolveAuthenticatedUserFromToken } from '../services/auth/authService.js';
import {
  addHubMessage,
  getHubProfile,
  listHubActivity,
  listHubConversations,
  listHubMessages,
  markHubConversationRead,
  searchHubProfiles,
  upsertHubProfile,
} from '../services/hub/hubStore.js';
import { isHubUserOnline, listHubPresence } from '../services/hub/hubPresenceStore.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function resolveHubIdentity(req) {
  const authenticated = await resolveAuthenticatedUserFromToken(getBearerToken(req));
  if (authenticated) return authenticated;

  const email =
    req.body?.email ||
    req.body?.fromEmail ||
    req.query.email ||
    req.query.fromEmail ||
    '';

  if (!email) return null;
  return getHubProfile(email);
}

export function createHubRouter() {
  const router = express.Router();

  router.post('/hub/access', async (req, res) => {
    const authenticated = await resolveAuthenticatedUserFromToken(getBearerToken(req));
    const { email, name, role, presenceStatus } = req.body || {};
    const normalizedEmail = normalizeEmail(authenticated?.email || email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'EMAIL_REQUIRED' });
    }

    const profile = upsertHubProfile({
      email: normalizedEmail,
      name: authenticated?.name || name,
      role: authenticated?.role || role,
      presenceStatus,
    });
    return res.json({ profile });
  });

  router.get('/hub/profile', (req, res) => {
    const profile = getHubProfile(req.query.email);
    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    }
    return res.json({ profile });
  });

  router.get('/hub/directory', (req, res) => {
    const profiles = searchHubProfiles({
      query: req.query.q || '',
      excludeEmail: req.query.email || '',
    }).map((profile) => ({
      ...profile,
      online: isHubUserOnline(profile.email),
    }));
    return res.json({ profiles });
  });

  router.get('/hub/presence', (_req, res) => {
    return res.json({ items: listHubPresence() });
  });

  router.get('/hub/activity', async (req, res) => {
    const identity = await resolveHubIdentity(req);
    if (!identity?.email) {
      return res.status(401).json({ error: 'EMAIL_REQUIRED' });
    }
    return res.json({ items: listHubActivity(identity.email) });
  });

  router.get('/hub/conversations', async (req, res) => {
    const identity = await resolveHubIdentity(req);
    if (!identity?.email) {
      return res.status(401).json({ error: 'EMAIL_REQUIRED' });
    }
    return res.json({ items: listHubConversations(identity.email) });
  });

  router.get('/hub/messages', async (req, res) => {
    const identity = await resolveHubIdentity(req);
    const email = normalizeEmail(identity?.email);
    const peerEmail = normalizeEmail(req.query.peerEmail);
    if (!email || !peerEmail) {
      return res.status(401).json({ error: 'EMAIL_AND_PEER_REQUIRED' });
    }
    markHubConversationRead({ email, peerEmail });
    return res.json({ items: listHubMessages({ email, peerEmail }) });
  });

  router.post('/hub/messages', async (req, res) => {
    const identity = await resolveHubIdentity(req);
    const { fromEmail, fromName, toEmail, content } = req.body || {};
    const normalizedFrom = normalizeEmail(identity?.email || fromEmail);
    const normalizedTo = normalizeEmail(toEmail);

    if (!normalizedFrom || !normalizedTo || !String(content || '').trim()) {
      return res.status(400).json({ error: 'INVALID_MESSAGE_PAYLOAD' });
    }

    upsertHubProfile({ email: normalizedFrom, name: identity?.name || fromName, role: identity?.role || 'member' });
    if (!getHubProfile(normalizedTo)) {
      return res.status(404).json({ error: 'RECIPIENT_NOT_FOUND' });
    }

    const result = addHubMessage({
      fromEmail: normalizedFrom,
      fromName: identity?.name || fromName,
      toEmail: normalizedTo,
      content,
    });

    return res.status(201).json(result);
  });

  return router;
}
