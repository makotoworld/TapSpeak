import { TTSProvider, TTSProviderType } from './types';
import { OpenAIProvider } from './providers/openai';
import { ElevenLabsProvider } from './providers/elevenlabs';
import { VertexAIProvider } from './providers/vertex';

const providers: Record<TTSProviderType, TTSProvider> = {
    openai: new OpenAIProvider(),
    elevenlabs: new ElevenLabsProvider(),
    vertex: new VertexAIProvider(),
};

export function getTTSProvider(type: TTSProviderType): TTSProvider {
    return providers[type];
}
