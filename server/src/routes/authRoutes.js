import express from 'express';
import { loginUser, registerUser, resolveAuthenticatedUserFromToken } from '../services/auth/authService.js';

export function getBearerToken(req) {
  const authHeader = req.header('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return authHeader.slice(7).trim();
}

export function createAuthRouter() {
  const router = express.Router();

  router.post('/auth/register', async (req, res) => {
    try {
      const result = await registerUser(req.body || {});
      if (result.error) {
        return res.status(result.error === 'EMAIL_ALREADY_EXISTS' ? 409 : 400).json({ error: result.error });
      }
      return res.status(201).json(result);
    } catch (error) {
      return res.status(error?.message === 'AUTH_DATABASE_REQUIRED' ? 503 : 500).json({
        error: error?.message === 'AUTH_DATABASE_REQUIRED' ? 'AUTH_DATABASE_REQUIRED' : 'AUTH_REQUEST_FAILED',
      });
    }
  });

  router.post('/auth/login', async (req, res) => {
    try {
      const result = await loginUser(req.body || {});
      if (result.error) {
        return res.status(401).json({ error: result.error });
      }
      return res.json(result);
    } catch (error) {
      return res.status(error?.message === 'AUTH_DATABASE_REQUIRED' ? 503 : 500).json({
        error: error?.message === 'AUTH_DATABASE_REQUIRED' ? 'AUTH_DATABASE_REQUIRED' : 'AUTH_REQUEST_FAILED',
      });
    }
  });

  router.get('/auth/me', async (req, res) => {
    try {
      const user = await resolveAuthenticatedUserFromToken(getBearerToken(req));
      if (!user) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }
      return res.json({ profile: user });
    } catch (error) {
      return res.status(error?.message === 'AUTH_DATABASE_REQUIRED' ? 503 : 500).json({
        error: error?.message === 'AUTH_DATABASE_REQUIRED' ? 'AUTH_DATABASE_REQUIRED' : 'AUTH_REQUEST_FAILED',
      });
    }
  });

  return router;
}
