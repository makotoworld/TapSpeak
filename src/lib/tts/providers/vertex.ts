import { TTSProvider, Voice } from '../types';

// Vertex AI (Google Cloud TTS) usually requires a Service Account Key JSON.
// Passing a raw API key is possible for some Google APIs but TTS usually needs OAuth2 or Service Account.
// However, we can use the API Key if restricted properly, or we might need to pass the JSON content.
// The user said "API Key setting".
// For Google Cloud, it's often an API Key (string) for simple access if enabled.
// Let's assume API Key for now. If we need Service Account JSON, the UI will need a text area.
// We will use the REST API directly to avoid Node.js specific gRPC deps in the browser if possible,
// or use a Server Action.

export class VertexAIProvider implements TTSProvider {
    name = 'Vertex AI';

    async speak(text: string, apiKey: string, voiceId: string = 'en-US-Neural2-A'): Promise<ArrayBuffer> {
        // Using Internal API Route to avoid exposing credentials and handle Service Account auth
        const response = await fetch('/api/tts/vertex', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                voiceId,
                credentials: apiKey, // apiKey here is actually the JSON string
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Vertex AI Error: ${error.error}`);
        }

        return await response.arrayBuffer();
    }

    async getVoices(apiKey: string): Promise<Voice[]> {
        // We need a separate endpoint or query param for voices.
        // Let's assume POST to /api/tts/vertex/voices for simplicity or reuse the same route with a different method/param.
        // I'll create a new route /api/tts/vertex/voices

        const response = await fetch('/api/tts/vertex/voices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                credentials: apiKey,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch voices');
        }

        const data = await response.json();
        return data.voices.map((v: any) => ({
            id: v.name,
            name: `${v.name} (${v.ssmlGender})`,
            languageCode: v.languageCodes[0],
            gender: v.ssmlGender,
        }));
    }
}
