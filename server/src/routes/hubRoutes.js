import express from 'express';
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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function createHubRouter() {
  const router = express.Router();

  router.post('/hub/access', (req, res) => {
    const { email, name, role } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'EMAIL_REQUIRED' });
    }

    const profile = upsertHubProfile({ email: normalizedEmail, name, role });
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
    });
    return res.json({ profiles });
  });

  router.get('/hub/activity', (req, res) => {
    const email = normalizeEmail(req.query.email);
    if (!email) {
      return res.status(400).json({ error: 'EMAIL_REQUIRED' });
    }
    return res.json({ items: listHubActivity(email) });
  });

  router.get('/hub/conversations', (req, res) => {
    const email = normalizeEmail(req.query.email);
    if (!email) {
      return res.status(400).json({ error: 'EMAIL_REQUIRED' });
    }
    return res.json({ items: listHubConversations(email) });
  });

  router.get('/hub/messages', (req, res) => {
    const email = normalizeEmail(req.query.email);
    const peerEmail = normalizeEmail(req.query.peerEmail);
    if (!email || !peerEmail) {
      return res.status(400).json({ error: 'EMAIL_AND_PEER_REQUIRED' });
    }
    markHubConversationRead({ email, peerEmail });
    return res.json({ items: listHubMessages({ email, peerEmail }) });
  });

  router.post('/hub/messages', (req, res) => {
    const { fromEmail, fromName, toEmail, content } = req.body || {};
    const normalizedFrom = normalizeEmail(fromEmail);
    const normalizedTo = normalizeEmail(toEmail);

    if (!normalizedFrom || !normalizedTo || !String(content || '').trim()) {
      return res.status(400).json({ error: 'INVALID_MESSAGE_PAYLOAD' });
    }

    upsertHubProfile({ email: normalizedFrom, name: fromName });
    if (!getHubProfile(normalizedTo)) {
      return res.status(404).json({ error: 'RECIPIENT_NOT_FOUND' });
    }

    const result = addHubMessage({
      fromEmail: normalizedFrom,
      fromName,
      toEmail: normalizedTo,
      content,
    });

    return res.status(201).json(result);
  });

  return router;
}
