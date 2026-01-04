'use client';

import React, { useState, useRef } from 'react';
import styles from './page.module.css';
import { SettingsModal } from '../components/SettingsModal';
import { useSettings } from '../context/SettingsContext';
import { getTTSProvider } from '@/lib/tts/factory';
import { CHARACTER_LIMITS, isTextLengthValid, validateVertexAISentences } from '@/lib/tts/types';
import { downloadWAV } from '../lib/audioUtils';
import { Edit3, PlayCircle, Loader2, Download, AlertTriangle } from 'lucide-react';

export default function Home() {
  const { settings } = useSettings();
  const [text, setText] = useState('Welcome to TapSpeak. Click on any word to hear it spoken. You can edit this text by switching to Edit mode.');
  const [isEditing, setIsEditing] = useState(false);
  const [playingWordIndex, setPlayingWordIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMetrics, setLatencyMetrics] = useState<{
    apiLatency: number | null;
    processingLatency: number | null;
    totalLatency: number | null;
  } | null>(null);
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

    // Check if this segment exceeds character limit (for segment validation mode)
    const delimiter = settings.splitDelimiter || 'period_newline';
    const useSegmentValidation = delimiter === 'newline' || delimiter === 'period';

    if (useSegmentValidation) {
      const trimmedWord = word.trim();
      const characterLimit = CHARACTER_LIMITS[settings.activeProvider];
      if (trimmedWord.length > characterLimit) {
        setError(
          `このセグメントは${trimmedWord.length}文字で、${settings.activeProvider}の制限（${characterLimit}文字）を超えています。` +
          `${trimmedWord.length - characterLimit}文字削減してください。`
        );
        return;
      }
    }

    try {
      setError(null);
      setIsLoading(true);
      setPlayingWordIndex(index);
      setLatencyMetrics(null); // Reset metrics

      const clickTime = performance.now();

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

      const apiStartTime = performance.now();
      const audioBuffer = await provider.speak(word, apiKey, voiceId);
      const apiEndTime = performance.now();

      // Decode audio data
      const decodedBuffer = await ctx.decodeAudioData(audioBuffer);

      const source = ctx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(ctx.destination);

      const audioStartTime = performance.now();
      source.start(0);

      const apiLatency = apiEndTime - apiStartTime;
      const processingLatency = audioStartTime - apiEndTime;
      const totalLatency = audioStartTime - clickTime;

      setLatencyMetrics({
        apiLatency,
        processingLatency,
        totalLatency
      });

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

  const handleExportWAV = async () => {
    if (!text.trim()) {
      setError('Please enter some text to export.');
      return;
    }

    try {
      setError(null);
      setIsExporting(true);

      // Initialize/Resume AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const provider = getTTSProvider(settings.activeProvider);
      const apiKey = settings.apiKeys[settings.activeProvider];
      const voiceId = settings.voiceSettings[settings.activeProvider];

      if (!apiKey) {
        throw new Error(`Please set an API key for ${settings.activeProvider} in settings.`);
      }

      // Generate audio for the full text
      const audioBuffer = await provider.speak(text, apiKey, voiceId);

      // Decode audio data
      const decodedBuffer = await ctx.decodeAudioData(audioBuffer);

      // Download as WAV
      downloadWAV(decodedBuffer, `tapspeak-${Date.now()}.wav`);

      setIsExporting(false);
    } catch (err: any) {
      console.error('WAV Export Error:', err);
      setError(err.message || 'Failed to export WAV');
      setIsExporting(false);
    }
  };

  // Character limit validation
  const characterLimit = CHARACTER_LIMITS[settings.activeProvider];
  const delimiter = settings.splitDelimiter || 'period_newline';

  // Check if we should validate per segment or full text
  const useSegmentValidation = delimiter === 'newline' || delimiter === 'period';

  // Segment-level validation
  const segmentValidation = segments.map(segment => {
    const trimmedText = segment.trim();
    let isValid = trimmedText.length === 0 || isTextLengthValid(trimmedText, settings.activeProvider);
    let sentenceIssue = false;

    // Vertex AI: Check sentence-level limits (per-sentence within the segment)
    if (settings.activeProvider === 'vertex' && useSegmentValidation && isValid && trimmedText.length > 0) {
      const sentenceValidation = validateVertexAISentences(trimmedText);
      if (!sentenceValidation.isValid) {
        isValid = false;
        sentenceIssue = true;
      }
    }

    return {
      text: segment,
      length: trimmedText.length,
      isValid,
      sentenceIssue // Vertex AI sentence-specific issue
    };
  });

  // Calculate validation metrics
  const invalidSegmentsCount = segmentValidation.filter(s => s.text.trim() && !s.isValid).length;
  const hasSentenceIssues = segmentValidation.some(s => s.sentenceIssue);
  const maxSegmentLength = Math.max(0, ...segmentValidation.map(s => s.length));
  const currentLength = useSegmentValidation ? maxSegmentLength : text.length;
  const isOverLimit = useSegmentValidation
    ? invalidSegmentsCount > 0
    : !isTextLengthValid(text, settings.activeProvider);
  const charactersOver = isOverLimit ? currentLength - characterLimit : 0;

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
        <button
          className={styles.exportButton}
          onClick={handleExportWAV}
          disabled={isExporting || !text.trim()}
          title="Export full text as WAV file"
        >
          <div className="flex items-center gap-2">
            {isExporting ? <Loader2 size={16} className={styles.spinner} /> : <Download size={16} />}
            {isExporting ? 'Exporting...' : 'Export WAV'}
          </div>
        </button>
        <div className={`${styles.characterCounter} ${isOverLimit ? styles.overLimit : ''}`}>
          {useSegmentValidation ? '最大行: ' : '全文: '}{currentLength} / {characterLimit} chars
        </div>
      </div>

      {latencyMetrics && (
        <div className="mt-4 p-4 bg-gray-100 rounded-lg text-sm font-mono">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-gray-500">API Latency</div>
              <div className="font-bold">{latencyMetrics.apiLatency?.toFixed(0)}ms</div>
            </div>
            <div>
              <div className="text-gray-500">Processing</div>
              <div className="font-bold">{latencyMetrics.processingLatency?.toFixed(0)}ms</div>
            </div>
            <div>
              <div className="text-gray-500">Total</div>
              <div className="font-bold text-blue-600">{latencyMetrics.totalLatency?.toFixed(0)}ms</div>
            </div>
          </div>
        </div>
      )}

      {isOverLimit && (
        <div className={styles.warning}>
          <AlertTriangle size={16} />
          <span>
            {useSegmentValidation ? (
              <>
                {invalidSegmentsCount}個のセグメントが{settings.activeProvider}の文字数制限（{characterLimit}文字）を超えています。
                該当セグメントは赤枠で表示されています。
                {settings.activeProvider === 'vertex' && hasSentenceIssues && (
                  <> セグメント内の文（sentence）が長すぎます。Vertex AIでは"句点で分割"を推奨します。</>
                )}
              </>
            ) : (
              <>
                Text exceeds {settings.activeProvider} character limit by {charactersOver} characters.
                Please reduce text length to use WAV export or click playback.
              </>
            )}
          </span>
        </div>
      )}

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
            {segments.map((word, i) => {
              const validation = segmentValidation[i];
              const isInvalid = validation.text.trim() && !validation.isValid;

              return (
                <span
                  key={i}
                  className={`
                    ${styles.word} 
                    ${playingWordIndex === i ? styles.playing : ''}
                    ${isLoading && playingWordIndex === i ? styles.loading : ''}
                    ${isInvalid ? styles.wordOverLimit : ''}
                  `}
                  onClick={() => handleWordClick(word, i)}
                  title={isInvalid ? `このセグメントは${validation.length}文字で、制限（${characterLimit}文字）を超えています` : undefined}
                >
                  {isInvalid && <AlertTriangle size={12} className={styles.wordOverLimitIcon} />}
                  {word}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <SettingsModal />
    </main>
  );
}
