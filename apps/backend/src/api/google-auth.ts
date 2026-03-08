import crypto from 'crypto';
import { Router } from 'express';
import { oauth2Client, saveRefreshToken } from '../calendar/client';
import { logger } from '../utils/logger';

export const googleAuthRouter = Router();

// State tokens with TTL for CSRF protection
const pendingStates = new Map<string, number>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, createdAt] of pendingStates) {
    if (now - createdAt > STATE_TTL_MS) {
      pendingStates.delete(state);
    }
  }
}, 5 * 60 * 1000);

// GET /auth/google — redirect to Google OAuth consent screen
googleAuthRouter.get('/google', (_req, res) => {
  const state = crypto.randomUUID();
  pendingStates.set(state, Date.now());

  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state,
  });
  res.redirect(url);
});

// GET /auth/google/callback — handle OAuth callback
googleAuthRouter.get('/google/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  if (!state || !pendingStates.has(state)) {
    res.status(403).json({ error: 'Invalid or expired OAuth state' });
    return;
  }

  const createdAt = pendingStates.get(state)!;
  pendingStates.delete(state);

  if (Date.now() - createdAt > STATE_TTL_MS) {
    res.status(403).json({ error: 'OAuth state expired' });
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (tokens.refresh_token) {
      await saveRefreshToken(tokens.refresh_token);
      logger.info('Google Calendar refresh token saved successfully');
    }
    oauth2Client.setCredentials(tokens);
    res.json({ success: true, message: 'Google Calendar connected successfully' });
  } catch (err) {
    logger.error('Google OAuth error:', err);
    res.status(500).json({ error: 'Failed to exchange authorization code' });
  }
});
