import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..', '..');
const projectRoot = path.resolve(serverRoot, '..');

[
  path.join(serverRoot, '.env.local'),
  path.join(projectRoot, '.env.local'),
  path.join(serverRoot, '.env'),
  path.join(projectRoot, '.env'),
].forEach((candidate) => {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
  }
});

export const ENV = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || '',
  MEETING_STORE_BACKEND: process.env.MEETING_STORE_BACKEND || 'auto',
  MEETING_STORE_DIR: process.env.MEETING_STORE_DIR || 'server/data/meetings',
  TRANSCRIPT_STORE_DIR: process.env.TRANSCRIPT_STORE_DIR || 'server/data/transcripts',
  TRANSCRIPT_STORE_BACKEND: process.env.TRANSCRIPT_STORE_BACKEND || 'local',
  SUMMARY_PROVIDER: process.env.SUMMARY_PROVIDER || 'heuristic',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  OPENAI_TRANSLATION_MODEL: process.env.OPENAI_TRANSLATION_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
  TRANSCRIPT_RETENTION_DAYS: Number(process.env.TRANSCRIPT_RETENTION_DAYS || 30),
  TRANSCRIPT_AUDIT_FILE: process.env.TRANSCRIPT_AUDIT_FILE || 'server/data/transcripts/audit.log',
  TRANSCRIPTION_PROVIDER: process.env.TRANSCRIPTION_PROVIDER || 'browser',
  OPENAI_TRANSCRIPTION_MODEL: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
  OPENAI_TRANSCRIPTION_URL: process.env.OPENAI_TRANSCRIPTION_URL || 'https://api.openai.com/v1/audio/transcriptions',
  HOST_ALERT_EMAIL_WEBHOOK_URL: process.env.HOST_ALERT_EMAIL_WEBHOOK_URL || '',
  HOST_ALERT_SMS_WEBHOOK_URL: process.env.HOST_ALERT_SMS_WEBHOOK_URL || '',
  HOST_ALERT_WEBHOOK_SECRET: process.env.HOST_ALERT_WEBHOOK_SECRET || '',
};
