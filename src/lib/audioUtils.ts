/**
 * Audio utility functions for WAV encoding and manipulation
 */

/**
 * Encode an AudioBuffer to WAV format
 */
export function encodeWAV(audioBuffer: AudioBuffer): ArrayBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * numberOfChannels * 2; // 16-bit samples
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    // WAV header
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // file length minus RIFF identifier and file length
    view.setUint32(4, 36 + length, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (1 = PCM)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, numberOfChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numberOfChannels * 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, length, true);

    // Write interleaved audio data
    const offset = 44;
    const channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }

    let index = offset;
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channels[channel][i]));
            view.setInt16(index, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            index += 2;
        }
    }

    return buffer;
}

/**
 * Write a string to a DataView
 */
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Download a WAV file
 */
export function downloadWAV(audioBuffer: AudioBuffer, filename: string = 'tapspeak-export.wav') {
    const wavData = encodeWAV(audioBuffer);
    const blob = new Blob([wavData], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Concatenate multiple AudioBuffers into a single AudioBuffer
 * Useful for future implementation if we need to split text into chunks
 */
export function concatenateAudioBuffers(
    audioContext: AudioContext,
    buffers: AudioBuffer[]
): AudioBuffer {
    if (buffers.length === 0) {
        throw new Error('No buffers to concatenate');
    }

    const numberOfChannels = buffers[0].numberOfChannels;
    const sampleRate = buffers[0].sampleRate;

    // Calculate total length
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);

    // Create new buffer
    const result = audioContext.createBuffer(
        numberOfChannels,
        totalLength,
        sampleRate
    );

    // Copy data from all buffers
    let offset = 0;
    for (const buffer of buffers) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            result.getChannelData(channel).set(buffer.getChannelData(channel), offset);
        }
        offset += buffer.length;
    }

    return result;
}
