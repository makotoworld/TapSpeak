'use client';

import React, { useState, useRef } from 'react';
import styles from './page.module.css';
import { SettingsModal } from '../components/SettingsModal';
import { useSettings } from '../context/SettingsContext';
import { getTTSProvider } from '../lib/tts/factory';
import { Edit3, PlayCircle, Loader2 } from 'lucide-react';

export default function Home() {
  const { settings } = useSettings();
  const [text, setText] = useState('Welcome to TapSpeak. Click on any word to hear it spoken. You can edit this text by switching to Edit mode.');
  const [isEditing, setIsEditing] = useState(false);
  const [playingWordIndex, setPlayingWordIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Unlock AudioContext on first user interaction (for iOS)
  React.useEffect(() => {
    const unlockAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          // Create and play a silent buffer to fully unlock
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
          console.log('AudioContext unlocked');
        });
      }
      // Remove listeners after first interaction
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Split text based on settings
  const splitText = (text: string) => {
    const delimiter = settings.splitDelimiter || 'period_newline';

    if (delimiter === 'newline') {
      // Split by newline, keeping the newline
      return text.split(/(\n+)/).filter(Boolean);
    } else if (delimiter === 'period') {
      // Split by period (English . or Japanese 。), keeping the period
      return text.split(/([。.])/).filter(Boolean);
    } else {
      // period_newline (default)
      // Split by period or newline
      return text.split(/([。. \n]+)/).filter(Boolean);
    }
  };

  const segments = splitText(text);

  const handleWordClick = async (word: string, index: number) => {
    if (isEditing || !word.trim()) return;

    try {
      setError(null);
      setIsLoading(true);
      setPlayingWordIndex(index);

      // Initialize/Resume AudioContext IMMEDIATELY on user gesture
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Play a silent buffer immediately to keep the audio session active on iOS
      // while we wait for the network request.
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const silentSource = ctx.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.connect(ctx.destination);
      silentSource.start(0);

      const provider = getTTSProvider(settings.activeProvider);
      const apiKey = settings.apiKeys[settings.activeProvider];
      const voiceId = settings.voiceSettings[settings.activeProvider];

      if (!apiKey) {
        throw new Error(`Please set an API key for ${settings.activeProvider} in settings.`);
      }

      const audioBuffer = await provider.speak(word, apiKey, voiceId);

      // Decode audio data
      const decodedBuffer = await ctx.decodeAudioData(audioBuffer);

      const source = ctx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(ctx.destination);
      source.start(0);

      source.onended = () => {
        setPlayingWordIndex(null);
        setIsLoading(false);
      };

    } catch (err: any) {
      console.error('TTS Error:', err);
      setError(err.message || 'Failed to play audio');
      setPlayingWordIndex(null);
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>TapSpeak</h1>
        <p className={styles.subtitle}>Interactive Text-to-Speech Editor</p>
      </div>

      <div className={styles.controls}>
        <button
          className={`${styles.modeButton} ${isEditing ? styles.modeButtonActive : ''}`}
          onClick={() => setIsEditing(true)}
        >
          <div className="flex items-center gap-2">
            <Edit3 size={16} />
            Edit
          </div>
        </button>
        <button
          className={`${styles.modeButton} ${!isEditing ? styles.modeButtonActive : ''}`}
          onClick={() => setIsEditing(false)}
        >
          <div className="flex items-center gap-2">
            <PlayCircle size={16} />
            Interactive
          </div>
        </button>
      </div>

      <div className={styles.editorContainer}>
        {isEditing ? (
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your text here..."
          />
        ) : (
          <div className={styles.interactiveMode}>
            {segments.map((word, i) => (
              <span
                key={i}
                className={`
                  ${styles.word} 
                  ${playingWordIndex === i ? styles.playing : ''}
                  ${isLoading && playingWordIndex === i ? styles.loading : ''}
                `}
                onClick={() => handleWordClick(word, i)}
              >
                {word}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <SettingsModal />
    </main>
  );
}
