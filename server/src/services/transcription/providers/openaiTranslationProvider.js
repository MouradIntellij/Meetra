import { ENV } from '../../../config/env.js';

function buildPrompt({ text, sourceLanguage }) {
  return [
    'Traduis ce segment de réunion et retourne exclusivement un JSON valide.',
    'Schéma JSON attendu:',
    '{"fr":"string","en":"string"}',
    'Contraintes:',
    '- Garder le sens professionnel et concis',
    '- Ne pas ajouter d’explication',
    '- Si le texte source est déjà en français, la valeur "fr" peut rester très proche du texte source',
    '- Si le texte source est déjà en anglais, la valeur "en" peut rester très proche du texte source',
    '',
    `Langue source probable: ${sourceLanguage || 'auto'}`,
    `Texte: ${text}`,
  ].join('\n');
}

export async function translateWithOpenAI({ text, sourceLanguage }) {
  const response = await fetch(ENV.OPENAI_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ENV.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: ENV.OPENAI_TRANSLATION_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Tu traduis des segments de réunion et réponds exclusivement en JSON valide.',
        },
        {
          role: 'user',
          content: buildPrompt({ text, sourceLanguage }),
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`OpenAI translation failed: ${response.status} ${payload}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;

  return {
    fr: parsed?.fr || '',
    en: parsed?.en || '',
    provider: 'openai',
  };
}
