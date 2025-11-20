'use client';

import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { TTSProviderType, Voice } from '../lib/tts/types';
import { getTTSProvider } from '../lib/tts/factory';
import { X, Settings as SettingsIcon, Save, Loader2, Info } from 'lucide-react';
import styles from './SettingsModal.module.css';

export function SettingsModal() {
    const { settings, updateSettings, updateApiKey, updateVoice, updateSplitDelimiter } = useSettings();
    const [isOpen, setIsOpen] = useState(false);
    const [voices, setVoices] = useState<Voice[]>([]);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [voiceFilter, setVoiceFilter] = useState('');

    useEffect(() => {
        if (isOpen && settings.activeProvider && settings.apiKeys[settings.activeProvider]) {
            fetchVoices();
        }
    }, [isOpen, settings.activeProvider, settings.apiKeys[settings.activeProvider]]);

    const fetchVoices = async () => {
        try {
            setIsLoadingVoices(true);
            setVoiceError(null);
            const provider = getTTSProvider(settings.activeProvider);
            const fetchedVoices = await provider.getVoices(settings.apiKeys[settings.activeProvider]);
            setVoices(fetchedVoices.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (err) {
            console.error('Failed to fetch voices:', err);
            setVoiceError('Failed to load voices. Check API Key.');
            setVoices([]);
        } finally {
            setIsLoadingVoices(false);
        }
    };

    const filteredVoices = voices.filter(v =>
        v.name.toLowerCase().includes(voiceFilter.toLowerCase()) ||
        v.id.toLowerCase().includes(voiceFilter.toLowerCase())
    );

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={styles.triggerButton}
            >
                <SettingsIcon size={24} />
            </button>
        );
    }

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Settings</h2>
                    <button onClick={() => setIsOpen(false)} className={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Text Splitting Preferences */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Text Splitting Mode</label>
                        <select
                            value={settings.splitDelimiter}
                            onChange={(e) => updateSplitDelimiter(e.target.value as any)}
                            className={styles.select}
                        >
                            <option value="period_newline">Period & Newline (Recommended)</option>
                            <option value="period">
                                Period Only{settings.activeProvider === 'vertex' ? ' ⭐ Vertex AI推奨' : ''}
                            </option>
                            <option value="newline">Newline Only</option>
                        </select>

                        {settings.activeProvider === 'vertex' && settings.splitDelimiter !== 'period' && (
                            <div className={styles.recommendation}>
                                <Info size={16} />
                                <span>
                                    Vertex AIは文（sentence）単位で制限があるため、"Period Only"を推奨します。
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Provider Selection */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Active Provider</label>
                        <select
                            value={settings.activeProvider}
                            onChange={(e) => updateSettings({ activeProvider: e.target.value as TTSProviderType })}
                            className={styles.select}
                        >
                            <option value="openai">OpenAI</option>
                            <option value="elevenlabs">ElevenLabs</option>
                            <option value="vertex">Google Vertex AI</option>
                        </select>
                    </div>

                    {/* API Keys */}
                    <div className={styles.formGroup}>
                        <h3 className={styles.sectionTitle}>API Keys</h3>

                        <div className={styles.inputGroup}>
                            <label className={styles.subLabel}>OpenAI API Key</label>
                            <input
                                type="password"
                                value={settings.apiKeys.openai}
                                onChange={(e) => updateApiKey('openai', e.target.value)}
                                placeholder="sk-..."
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.subLabel}>ElevenLabs API Key</label>
                            <input
                                type="password"
                                value={settings.apiKeys.elevenlabs}
                                onChange={(e) => updateApiKey('elevenlabs', e.target.value)}
                                placeholder="..."
                                className={styles.input}
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.subLabel}>Google Vertex AI Service Account (JSON)</label>
                            <textarea
                                value={settings.apiKeys.vertex}
                                onChange={(e) => updateApiKey('vertex', e.target.value)}
                                placeholder='Paste your Service Account JSON here...'
                                className={`${styles.input} h-24 resize-none`}
                            />
                        </div>
                    </div>

                    {/* Voice Selection */}
                    <div className={styles.formGroup}>
                        <div className="flex justify-between items-center mb-2">
                            <label className={styles.label}>Voice</label>
                            {isLoadingVoices && <Loader2 className="animate-spin w-4 h-4 text-blue-500" />}
                        </div>

                        {/* Voice Filter */}
                        <input
                            type="text"
                            value={voiceFilter}
                            onChange={(e) => setVoiceFilter(e.target.value)}
                            placeholder="Filter voices (e.g. 'Chirp', 'Japanese')..."
                            className={`${styles.input} mb-2`}
                        />

                        {voiceError ? (
                            <p className="text-red-500 text-xs">{voiceError}</p>
                        ) : (
                            <select
                                value={settings.voiceSettings[settings.activeProvider] || ''}
                                onChange={(e) => updateVoice(settings.activeProvider, e.target.value)}
                                className={styles.select}
                                disabled={isLoadingVoices || voices.length === 0}
                            >
                                <option value="">Select a voice...</option>
                                {filteredVoices.map(voice => (
                                    <option key={voice.id} value={voice.id}>
                                        {voice.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                            {filteredVoices.length} voices found
                        </p>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button
                        onClick={() => setIsOpen(false)}
                        className={styles.saveButton}
                    >
                        <Save size={16} />
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
