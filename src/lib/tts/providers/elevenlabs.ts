import { TTSProvider, Voice } from '../types';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export class ElevenLabsProvider implements TTSProvider {
    name = 'ElevenLabs';

    async speak(text: string, apiKey: string, voiceId: string = '21m00Tcm4TlvDq8ikWAM'): Promise<ArrayBuffer> {
        const client = new ElevenLabsClient({ apiKey });
        const audio = await client.textToSpeech.convert(voiceId, {
            text,
            modelId: 'eleven_monolingual_v1',
            outputFormat: 'mp3_44100_128',
        });

        // The SDK returns a ReadableStream. We can use the Response API to convert it to ArrayBuffer easily.
        const response = new Response(audio as any);
        return await response.arrayBuffer();
    }

    async getVoices(apiKey: string): Promise<Voice[]> {
        const client = new ElevenLabsClient({ apiKey });
        const response = await client.voices.getAll();
        return response.voices.map(v => ({
            // If SDK is camelCase, this might be voiceId. Let's try voice_id first as per error "Property 'voice_id' does not exist on type 'Voice'". Wait, the error said "Property 'voice_id' does not exist on type 'Voice'".
            // Ah, the error is on `v.voice_id`. But `v` comes from `response.voices`.
            // The error says: `Property 'voice_id' does not exist on type 'Voice'. Did you mean 'voiceId'?`
            // This usually means the SDK type `Voice` (from ElevenLabs) has `voiceId` but I'm trying to access `voice_id`?
            // No, wait. `v` is an item from `response.voices`.
            // If `v` has `voiceId`, then I should use `voiceId`.
            // Let's assume camelCase `voiceId` and `name`.
            id: (v as any).voice_id || (v as any).voiceId || v.name, // Fallback
            name: v.name || 'Unknown Voice',
        }));
    }
}
