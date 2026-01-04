import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

export async function POST(req: NextRequest) {
    try {
        const { text, voiceId, credentials } = await req.json();

        if (!text || !credentials) {
            return NextResponse.json({ error: 'Missing text or credentials' }, { status: 400 });
        }

        // Parse credentials if it's a string
        const parsedCredentials = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;

        const client = new TextToSpeechClient({
            credentials: parsedCredentials,
            projectId: parsedCredentials.project_id,
        });

        const [response] = await client.synthesizeSpeech({
            input: { text },
            voice: { languageCode: voiceId.split('-').slice(0, 2).join('-'), name: voiceId },
            audioConfig: { audioEncoding: 'MP3' },
        });

        if (!response.audioContent) {
            throw new Error('No audio content received');
        }

        return new NextResponse(response.audioContent as any, {
            headers: {
                'Content-Type': 'audio/mpeg',
            },
        });
    } catch (error: any) {
        console.error('Vertex AI TTS Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
