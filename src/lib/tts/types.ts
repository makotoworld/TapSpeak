export interface TTSProvider {
  name: string;
  speak(text: string, apiKey: string, voiceId?: string): Promise<ArrayBuffer>;
  getVoices(apiKey: string): Promise<Voice[]>;
}

export interface Voice {
  id: string;
  name: string;
  languageCode?: string;
  gender?: string;
}

export type TTSProviderType = 'vertex' | 'elevenlabs' | 'openai';
