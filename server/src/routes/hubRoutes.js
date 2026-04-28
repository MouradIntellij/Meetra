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

function handleHubError(res, error) {
  if (error?.message === 'HUB_DATABASE_REQUIRED') {
    return res.status(503).json({ error: 'HUB_DATABASE_REQUIRED' });
  }
  return res.status(500).json({ error: 'HUB_REQUEST_FAILED' });
}

export function createHubRouter() {
  const router = express.Router();

  router.use(async (req, res, next) => {
    const authenticated = await resolveAuthenticatedUserFromToken(getBearerToken(req));
    if (!authenticated) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    req.hubUser = authenticated;
    next();
  });

  router.post('/hub/access', async (req, res) => {
    try {
      const { presenceStatus } = req.body || {};
      const normalizedEmail = normalizeEmail(req.hubUser?.email);

      if (!normalizedEmail) {
        return res.status(400).json({ error: 'EMAIL_REQUIRED' });
      }

      const profile = await upsertHubProfile({
        email: normalizedEmail,
        name: req.hubUser.name,
        role: req.hubUser.role,
        presenceStatus,
      });
      return res.json({ profile });
    } catch (error) {
      return handleHubError(res, error);
    }
  });

  router.get('/hub/profile', async (req, res) => {
    try {
      const profile = await getHubProfile(req.hubUser.email);
      if (!profile) {
        return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
      }
      return res.json({ profile });
    } catch (error) {
      return handleHubError(res, error);
    }
  });

  router.get('/hub/directory', async (req, res) => {
    try {
      const profiles = (await searchHubProfiles({
        query: req.query.q || '',
        excludeEmail: req.hubUser.email || '',
      })).map((profile) => ({
        ...profile,
        online: isHubUserOnline(profile.email),
      }));
      return res.json({ profiles });
    } catch (error) {
      return handleHubError(res, error);
    }
  });

  router.get('/hub/presence', (_req, res) => {
    return res.json({ items: listHubPresence() });
  });

  router.get('/hub/activity', async (req, res) => {
    try {
      return res.json({ items: await listHubActivity(req.hubUser.email) });
    } catch (error) {
      return handleHubError(res, error);
    }
  });

  router.get('/hub/conversations', async (req, res) => {
    try {
      return res.json({ items: await listHubConversations(req.hubUser.email) });
    } catch (error) {
      return handleHubError(res, error);
    }
  });

  router.get('/hub/messages', async (req, res) => {
    try {
      const email = normalizeEmail(req.hubUser?.email);
      const peerEmail = normalizeEmail(req.query.peerEmail);
      if (!email || !peerEmail) {
        return res.status(401).json({ error: 'EMAIL_AND_PEER_REQUIRED' });
      }
      await markHubConversationRead({ email, peerEmail });
      return res.json({ items: await listHubMessages({ email, peerEmail }) });
    } catch (error) {
      return handleHubError(res, error);
    }
  });

  router.post('/hub/messages', async (req, res) => {
    try {
      const { toEmail, content } = req.body || {};
      const normalizedFrom = normalizeEmail(req.hubUser?.email);
      const normalizedTo = normalizeEmail(toEmail);

      if (!normalizedFrom || !normalizedTo || !String(content || '').trim()) {
        return res.status(400).json({ error: 'INVALID_MESSAGE_PAYLOAD' });
      }

      await upsertHubProfile({ email: normalizedFrom, name: req.hubUser.name, role: req.hubUser.role });
      if (!(await getHubProfile(normalizedTo))) {
        return res.status(404).json({ error: 'RECIPIENT_NOT_FOUND' });
      }

      const result = await addHubMessage({
        fromEmail: normalizedFrom,
        fromName: req.hubUser.name,
        toEmail: normalizedTo,
        content,
      });

      return res.status(201).json(result);
    } catch (error) {
      return handleHubError(res, error);
    }
  });

  return router;
}
