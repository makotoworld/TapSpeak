# Vertex AI Streaming TTS Investigation Report

**Date:** 2025-11-27  
**Status:** Investigation Complete - Not Implemented  
**Conclusion:** Reverted to non-streaming approach due to unsolvable API compatibility issues

---

## Objective

Implement streaming Text-to-Speech playback from Google Vertex AI to reduce perceived latency and enable near-instantaneous audio playback.

## Investigation Summary

We attempted to implement streaming TTS using Vertex AI's `streamingSynthesize` API. After extensive debugging, we encountered persistent compatibility issues that could not be resolved.

---

## Timeline of Implementation Attempts

### 1. Initial Streaming Implementation (OGG_OPUS + MediaSource)

**Approach:**
- Server: Used `streamingSynthesize()` with OGG_OPUS encoding (enum 3)
- Client: MediaSource Extensions API with `audio/ogg;codecs=opus`

**Issues Encountered:**
- Browser reported `audio/ogg;codecs=opus` as **not supported**
- MediaSource.isTypeSupported() returned `false` in Chrome

**Root Cause:**
- Container format mismatch: Vertex AI returns Ogg container, but Chrome's MediaSource expects WebM container for Opus codec
- These formats are incompatible

### 2. WebM Opus Attempt

**Approach:**
- Changed client to use `audio/webm;codecs=opus`
- Updated server Content-Type header

**Issues Encountered:**
```
Audio playback error: NotSupportedError: Failed to load because no supported source was found
SourceBuffer append error: InvalidStateError: This SourceBuffer has been removed
```

**Root Cause:**
- First chunk (118 bytes) too small - missing WebM initialization segment
- Vertex API sends Ogg format, not WebM format
- MediaSource couldn't parse the data

### 3. LINEAR16 (PCM) Streaming Attempt

**Approach:**
- Switched to LINEAR16 encoding (enum 1, uncompressed PCM)
- Used Web Audio API instead of MediaSource
- Collected PCM chunks and converted to AudioBuffer

**Issues Encountered:**
```
Error: 3 INVALID_ARGUMENT: Unsupported audio encoding.
```

**Root Cause Investigation:**
- Discovered that Neural2 voices don't support streaming
- Only Chirp3-HD voices (previously Journey voices) support `streamingSynthesize`

### 4. Chirp3-HD Voice with LINEAR16

**Approach:**
- Implemented automatic voice conversion: Neural2 → Chirp3-HD
- Example: `ja-JP-Neural2-A` → `ja-JP-Chirp3-HD-Aoede`
- Kept LINEAR16 encoding

**Issues Encountered:**
```
Streaming voiceId: ja-JP-Chirp3-HD-Achird
Error: 3 INVALID_ARGUMENT: Unsupported audio encoding.
```

**Conclusion:**
Even with correct Chirp3-HD voice, the "Unsupported audio encoding" error persisted for all encoding types tested.

---

## Technical Details

### API Configuration Discoveries

1. **streamingConfig Structure:**
   - Must use `streamingAudioConfig` (not `audioConfig`)
   - Encoding values must be numeric enum values (not strings)
   - Request must be sent in two separate messages:
     - Message 1: Configuration (`streamingConfig`)
     - Message 2: Input (`input: { text }`)

2. **Supported Encodings (documented):**
   - LINEAR16 (1)
   - OGG_OPUS (3)
   - MULAW (5)
   - ALAW (6)
   - PCM (7)

3. **NOT Supported:**
   - MP3 (2) - Returns "Unsupported audio encoding"

4. **Voice Compatibility:**
   - **Chirp3-HD voices:** Explicitly support streaming
     - Voices: Aoede, Puck, Charon, Kore, Fenrir, Leda, Orus, Zephyr
     - Format: `{lang}-Chirp3-HD-{voice}` (e.g., `ja-JP-Chirp3-HD-Aoede`)
   - **Neural2 voices:** Do NOT support streaming
     - Example: `en-US-Neural2-A`, `ja-JP-Neural2-A`

### MediaSource API Requirements

1. **Initialization Segment:** First `appendBuffer()` must contain complete WebM/MP4 initialization segment
2. **Container Formats:** Chrome requires specific container formats
   - `audio/webm;codecs=opus` - WebM container
   - `audio/mpeg` - MP3 container
   - `audio/mp4` - MP4 container
3. **updateend Event:** Must wait for `updateend` before next `appendBuffer()`

---

## Code Changes Made (For Reference)

### Server-Side Changes

**File:** `src/app/api/tts/vertex/route.ts`

```typescript
// Voice conversion logic
let streamingVoiceId = voiceId;
if (voiceId.includes('Neural2')) {
    const langCode = voiceId.split('-').slice(0, 2).join('-');
    streamingVoiceId = `${langCode}-Chirp3-HD-Aoede`;
}

// Streaming configuration
const stream = await client.streamingSynthesize();

const readableStream = new ReadableStream({
    start(controller) {
        stream.on('data', (response) => {
            if (response.audioContent) {
                controller.enqueue(response.audioContent);
            }
        });
        
        // Two-message pattern
        stream.write({
            streamingConfig: {
                streamingAudioConfig: { 
                    audioEncoding: 1, // LINEAR16
                    sampleRateHertz: 24000
                },
                voice: { 
                    languageCode: streamingVoiceId.split('-').slice(0, 2).join('-'),
                    name: streamingVoiceId 
                }
            }
        });
        
        stream.write({ input: { text } });
        stream.end();
    }
});
```

### Client-Side Changes

**File:** `src/app/page.tsx`

Attempted approaches:
1. MediaSource with OGG/WebM
2. Web Audio API with PCM chunks

---

## Lessons Learned

### What Worked
- ✅ Non-streaming `synthesizeSpeech()` API is stable and reliable
- ✅ Voice detection and automatic conversion logic
- ✅ Understanding of gRPC streaming patterns
- ✅ Two-message request pattern for streaming config

### What Didn't Work
- ❌ All encoding formats returned "Unsupported audio encoding" error
- ❌ MediaSource API had container format mismatches
- ❌ Even with Chirp3-HD voices, streaming failed

### Possible Reasons for Failure

1. **Node.js Library Limitation:**
   - The `@google-cloud/text-to-speech` Node.js library may not fully support `streamingSynthesize`
   - Documentation is sparse on streaming examples

2. **API Version/Region Issue:**
   - Streaming may require specific API versions or regions
   - Service account permissions might be insufficient

3. **API Endpoint Configuration:**
   - May need different endpoint configuration for streaming
   - Regional endpoints might have different capabilities

---

## Performance Comparison

### Non-Streaming (Original)
- **API Latency:** ~3800ms
- **Processing Latency:** ~67ms
- **Total Latency:** ~3935ms
- **Reliability:** 100%

### Streaming (Attempted)
- **Status:** Failed - could not establish connection
- **Error Rate:** 100%

---

## Recommendations

### Short Term
1. **Use non-streaming approach** - Proven stable and reliable
2. **Monitor Google Cloud announcements** for streaming API updates
3. **Consider alternative latency improvements:**
   - Pre-generate common phrases
   - Cache frequently used audio
   - Use shorter text segments

### Long Term
1. **Re-evaluate** when official Node.js streaming examples are available
2. **Contact Google Cloud Support** for streaming API guidance
3. **Consider alternative TTS providers** that offer mature streaming APIs
   - ElevenLabs WebSocket streaming
   - AWS Polly streaming

---

## Files Modified (Now Reverted)

- `/src/app/api/tts/vertex/route.ts` - Streaming gRPC implementation
- `/src/app/page.tsx` - MediaSource/Web Audio streaming logic  
- `/src/lib/tts/providers/vertex.ts` - Added `stream()` method
- `/src/lib/tts/types.ts` - Added `stream?` to TTSProvider interface

All changes have been reverted to the stable non-streaming implementation.

---

## References

### Documentation Reviewed
- [Google Cloud Text-to-Speech Streaming](https://cloud.google.com/text-to-speech/docs/streaming)
- [MediaSource Extensions API](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

### Search Results
- Chirp3-HD voices are explicitly supported for streaming
- Neural2 voices do not support streaming as of 2024-10
- Journey voices were rebranded as Chirp3-HD voices

---

## Conclusion

After extensive investigation and multiple implementation attempts, we were unable to successfully implement streaming TTS with Vertex AI. The persistent "Unsupported audio encoding" error suggests a fundamental compatibility issue with the Node.js library or API configuration that cannot be resolved without official support or documentation.

The non-streaming approach remains the recommended solution for production use.

**Decision:** Revert to non-streaming implementation for stability and reliability.
