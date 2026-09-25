import { TTSProvider, Voice } from '../types';

const GEMINI_TTS_MODEL = 'gemini-3.8-flash-tts';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// Preset voices are shared across all supported languages (including Japanese)
const GEMINI_VOICES: Voice[] = [
    { id: 'Zephyr', name: 'Zephyr (Bright)' },
    { id: 'Puck', name: 'Puck (Upbeat)' },
    { id: 'Charon', name: 'Charon (Informative)' },
    { id: 'Kore', name: 'Kore (Firm)' },
    { id: 'Fenrir', name: 'Fenrir (Excitable)' },
    { id: 'Leda', name: 'Leda (Youthful)' },
    { id: 'Orus', name: 'Orus (Firm)' },
    { id: 'Aoede', name: 'Aoede (Breezy)' },
    { id: 'Callirrhoe', name: 'Callirrhoe (Easy-going)' },
    { id: 'Autonoe', name: 'Autonoe (Bright)' },
    { id: 'Enceladus', name: 'Enceladus (Breathy)' },
    { id: 'Iapetus', name: 'Iapetus (Clear)' },
    { id: 'Umbriel', name: 'Umbriel (Easy-going)' },
    { id: 'Algieba', name: 'Algieba (Smooth)' },
    { id: 'Despina', name: 'Despina (Smooth)' },
    { id: 'Erinome', name: 'Erinome (Clear)' },
    { id: 'Algenib', name: 'Algenib (Gravelly)' },
    { id: 'Rasalgethi', name: 'Rasalgethi (Informative)' },
    { id: 'Laomedeia', name: 'Laomedeia (Upbeat)' },
    { id: 'Achernar', name: 'Achernar (Soft)' },
    { id: 'Alnilam', name: 'Alnilam (Firm)' },
    { id: 'Schedar', name: 'Schedar (Even)' },
    { id: 'Gacrux', name: 'Gacrux (Mature)' },
    { id: 'Pulcherrima', name: 'Pulcherrima (Forward)' },
    { id: 'Achird', name: 'Achird (Friendly)' },
    { id: 'Zubenelgenubi', name: 'Zubenelgenubi (Casual)' },
    { id: 'Vindemiatrix', name: 'Vindemiatrix (Gentle)' },
    { id: 'Sadachbia', name: 'Sadachbia (Lively)' },
    { id: 'Sadaltager', name: 'Sadaltager (Knowledgeable)' },
    { id: 'Sulafat', name: 'Sulafat (Warm)' },
];

export class GeminiProvider implements TTSProvider {
    name = 'Gemini';

    async speak(text: string, apiKey: string, voiceId: string = 'Kore'): Promise<ArrayBuffer> {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: GEMINI_TTS_MODEL,
                input: [{
                    type: 'user_input',
                    content: [{ type: 'text', text }],
                }],
                response_format: { type: 'audio' },
                generation_config: {
                    speech_config: [{ voice: voiceId }],
                },
            }),
        });

        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try {
                const err = await response.json();
                message = err?.error?.message || message;
            } catch {
                // Non-JSON error body; keep the HTTP status message
            }
            throw new Error(`Gemini Error: ${message}`);
        }

        const data = await response.json();
        // Audio arrives base64-encoded (WAV) in the last audio content of the model_output steps
        const audioParts = (data.steps || [])
            .filter((step: { type?: string }) => step.type === 'model_output')
            .flatMap((step: { content?: Array<{ type?: string; data?: string }> }) => step.content || [])
            .filter((part: { type?: string; data?: string }) => part.type === 'audio' && part.data);

        if (audioParts.length === 0) {
            throw new Error('Gemini Error: No audio data in response');
        }

        const base64: string = audioParts[audioParts.length - 1].data;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    async getVoices(apiKey: string): Promise<Voice[]> {
        // Gemini has fixed preset voices; no API call needed
        void apiKey;
        return GEMINI_VOICES;
    }
}
