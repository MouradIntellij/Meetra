import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { translateWithOpenAI } from './providers/openaiTranslationProvider.js';

function normalizeLanguageCode(language) {
  return String(language || '')
    .trim()
    .toLowerCase()
    .split('-')[0];
}

export function getTranslationCapabilities() {
  const available = Boolean(ENV.OPENAI_API_KEY);
  return {
    translationAvailable: available,
    supportedLanguages: ['original', 'fr', 'en'],
    provider: available ? 'openai' : 'none',
  };
}

export async function translateTranscriptSegment({ text, sourceLanguage }) {
  const capabilities = getTranslationCapabilities();
  if (!capabilities.translationAvailable || !text?.trim()) {
    return {};
  }

  try {
    const translations = await translateWithOpenAI({ text, sourceLanguage });
    const normalizedSource = normalizeLanguageCode(sourceLanguage);

    return {
      fr: normalizedSource === 'fr' ? text : (translations.fr || ''),
      en: normalizedSource === 'en' ? text : (translations.en || ''),
    };
  } catch (error) {
    logger.warn('Live translation failed:', error?.message);
    return {};
  }
}
