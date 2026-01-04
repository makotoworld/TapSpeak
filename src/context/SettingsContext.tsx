'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { TTSProviderType } from '../lib/tts/types';

interface Settings {
    apiKeys: {
        openai: string;
        elevenlabs: string;
        vertex: string;
    };
    activeProvider: TTSProviderType;
    // Map provider name to selected voice ID
    voiceSettings: Record<TTSProviderType, string>;
    splitDelimiter: 'period_newline' | 'period' | 'newline';
}

interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
    updateApiKey: (provider: TTSProviderType, key: string) => void;
    updateVoice: (provider: TTSProviderType, voiceId: string) => void;
    updateSplitDelimiter: (delimiter: 'period_newline' | 'period' | 'newline') => void;
}

const defaultSettings: Settings = {
    apiKeys: {
        openai: '',
        elevenlabs: '',
        vertex: '',
    },
    activeProvider: 'openai',
    voiceSettings: {
        openai: 'alloy',
        elevenlabs: '21m00Tcm4TlvDq8ikWAM', // Rachel
        vertex: 'en-US-Neural2-A',
    },
    splitDelimiter: 'period_newline',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<Settings>(defaultSettings);

    useEffect(() => {
        const stored = localStorage.getItem('tapspeak_settings');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Deep merge with defaults to ensure all keys exist
                setSettings(prev => ({
                    ...prev,
                    ...parsed,
                    apiKeys: {
                        ...prev.apiKeys,
                        ...(parsed.apiKeys || {}),
                    },
                    voiceSettings: {
                        ...prev.voiceSettings,
                        ...(parsed.voiceSettings || {}),
                    },
                    splitDelimiter: parsed.splitDelimiter || prev.splitDelimiter || 'period_newline',
                }));
            } catch (e) {
                console.error('Failed to parse settings', e);
            }
        }
    }, []);

    const updateSettings = (newSettings: Partial<Settings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem('tapspeak_settings', JSON.stringify(updated));
            return updated;
        });
    };

    const updateApiKey = (provider: TTSProviderType, key: string) => {
        setSettings(prev => {
            const updated = {
                ...prev,
                apiKeys: {
                    ...prev.apiKeys,
                    [provider]: key,
                },
            };
            localStorage.setItem('tapspeak_settings', JSON.stringify(updated));
            return updated;
        });
    };



    const updateVoice = (provider: TTSProviderType, voiceId: string) => {
        setSettings(prev => {
            const updated = {
                ...prev,
                voiceSettings: {
                    ...prev.voiceSettings,
                    [provider]: voiceId,
                },
            };
            localStorage.setItem('tapspeak_settings', JSON.stringify(updated));
            return updated;
        });
    };

    const updateSplitDelimiter = (delimiter: 'period_newline' | 'period' | 'newline') => {
        setSettings(prev => {
            const updated = {
                ...prev,
                splitDelimiter: delimiter,
            };
            localStorage.setItem('tapspeak_settings', JSON.stringify(updated));
            return updated;
        });
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, updateApiKey, updateVoice, updateSplitDelimiter }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
