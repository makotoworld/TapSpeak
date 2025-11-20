import { TTSProvider, Voice } from '../types';
import OpenAI from 'openai';

export class OpenAIProvider implements TTSProvider {
    name = 'OpenAI';

    async speak(text: string, apiKey: string, voiceId: string = 'alloy'): Promise<ArrayBuffer> {
        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true }); // Note: In a real app, we should proxy this through backend to hide key, but for this client-side demo we allow it or use a proxy route.
        // However, the user asked for API key settings in the UI, implying client-side usage or client-provided key.
        // To avoid CORS issues with OpenAI direct calls from browser, we might need a server action or route handler.
        // For now, I'll implement it as a direct call but we might hit CORS. OpenAI usually requires server-side.
        // Let's assume we'll use Next.js Server Actions or Route Handlers to proxy the request.
        // But for simplicity in this "Text Editor" app, maybe we can use a route handler.

        // Actually, to keep it simple and secure, let's pass the key to a server action?
        // Or just use the client for now and see if it works (OpenAI blocks browser requests by default unless dangerouslyAllowBrowser is true, which I added).

        const response = await openai.audio.speech.create({
            model: 'tts-1',
            voice: voiceId as any,
            input: text,
        });

        return await response.arrayBuffer();
    }

    async getVoices(apiKey: string): Promise<Voice[]> {
        // OpenAI has fixed voices
        return [
            { id: 'alloy', name: 'Alloy' },
            { id: 'echo', name: 'Echo' },
            { id: 'fable', name: 'Fable' },
            { id: 'onyx', name: 'Onyx' },
            { id: 'nova', name: 'Nova' },
            { id: 'shimmer', name: 'Shimmer' },
        ];
    }
}
