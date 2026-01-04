export interface TTSProvider {
  name: string;
  speak(text: string, apiKey: string, voiceId?: string): Promise<ArrayBuffer>;
  stream?(text: string, apiKey: string, voiceId?: string): Promise<ReadableStream<Uint8Array>>;
  getVoices(apiKey: string): Promise<Voice[]>;
}

export interface Voice {
  id: string;
  name: string;
  languageCode?: string;
  gender?: string;
}

export type TTSProviderType = 'vertex' | 'elevenlabs' | 'openai';

/**
 * Character limits for each TTS provider
 */
export const CHARACTER_LIMITS: Record<TTSProviderType, number> = {
  openai: 4096,      // OpenAI TTS API limit
  elevenlabs: 3000,  // ElevenLabs Eleven v3 Alpha limit
  vertex: 500,       // Practical limit for Vertex AI Neural2 voices
};

/**
 * Validate text length against provider's character limit
 * @throws Error if text exceeds the limit
 */
export function validateTextLength(text: string, provider: TTSProviderType): void {
  const limit = CHARACTER_LIMITS[provider];
  const length = text.length;

  if (length > limit) {
    throw new Error(
      `Text length (${length} characters) exceeds ${provider} limit of ${limit} characters. ` +
      `Please reduce the text length by ${length - limit} characters.`
    );
  }
}

/**
 * Check if text length is within provider's limit (non-throwing version)
 */
export function isTextLengthValid(text: string, provider: TTSProviderType): boolean {
  const limit = CHARACTER_LIMITS[provider];
  return text.length <= limit;
}

/**
 * Validates Vertex AI sentence-level limits.
 * Vertex AI has both a per-request limit AND a per-sentence limit.
 * This function checks if individual sentences within the text exceed the limit.
 */
export function validateVertexAISentences(text: string): {
  isValid: boolean;
  invalidSentenceCount: number;
  maxSentenceLength: number;
} {
  // Split by period (both English and Japanese)
  const sentences = text.split(/[。.]+/).filter(s => s.trim());
  const lengths = sentences.map(s => s.trim().length);
  const maxLength = Math.max(0, ...lengths);
  const invalidCount = lengths.filter(len => len > CHARACTER_LIMITS.vertex).length;

  return {
    isValid: invalidCount === 0,
    invalidSentenceCount: invalidCount,
    maxSentenceLength: maxLength
  };
}
