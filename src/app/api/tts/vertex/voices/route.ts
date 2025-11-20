import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

export async function POST(req: NextRequest) {
    try {
        const { credentials } = await req.json();

        if (!credentials) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        const parsedCredentials = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;

        const client = new TextToSpeechClient({
            credentials: parsedCredentials,
            projectId: parsedCredentials.project_id,
        });

        const [response] = await client.listVoices({});

        return NextResponse.json({ voices: response.voices });
    } catch (error: any) {
        console.error('Vertex AI Voices Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
