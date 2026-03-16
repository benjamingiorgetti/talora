import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const MIME_TO_EXT: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'mp4',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/ogg; codecs=opus': 'ogg',
};

export async function transcribeAudio(base64Data: string, mimetype: string): Promise<string | null> {
  // Strip data URI prefix if present
  const raw = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');

  const ext = MIME_TO_EXT[mimetype] || 'ogg';
  const file = new File([buffer], `audio.${ext}`, { type: mimetype });

  const response = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'es',
  });

  const text = response.text?.trim();
  if (!text) return null;

  logger.info(`Audio transcribed (${buffer.length} bytes): "${text.substring(0, 100)}..."`);
  return text;
}
