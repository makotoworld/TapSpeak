# Gemini TTSプロバイダー追加 設計書

日付: 2026-09-25

## 目的

TapSpeakの4つ目のTTSプロバイダーとして、Gemini 3.8 Flash TTS（`gemini-3.8-flash-tts`）を追加する。日本語に正式対応（130言語サポート）しており、Google AI StudioのAPIキー1本で利用できるため、Vertex AI（サービスアカウントJSON必須・1文500文字制限）より設定が簡単。

## 決定事項

- **追加方式**: 既存3プロバイダー（OpenAI / ElevenLabs / Vertex）はそのまま残し、4つ目として追加する
- **モデル**: `gemini-3.8-flash-tts` 固定（Flash-Lite切替はYAGNI。必要になったら後で追加）
- **ストリーミング**: 初版では実装しない。`page.tsx` は `stream` 未実装のプロバイダーでは自動的に `speak()` にフォールバックする
- **デフォルト音声**: `Kore`
- **文字数制限**: 8,000文字（Geminiのコンテキストは大きく、他プロバイダーのような厳しい制限がないため余裕を持たせる）

## API仕様（実装の根拠）

- エンドポイント: `POST https://generativelanguage.googleapis.com/v1beta/interactions`
- 認証: `x-goog-api-key` ヘッダーにAPIキー（ブラウザから直接呼び出し可能）
- リクエスト: `model`, `input`（`user_input` / `text`）, `response_format: {type: "audio"}`, `generation_config.speech_config: [{voice: "<音声名>"}]`
- レスポンス: `steps[]` のうち `type === "model_output"` の `content[]` に `type === "audio"` の要素があり、`data` フィールドにbase64エンコードされたWAV（24kHz・モノラル・16bit）が入る
- プリセット音声: 30種類（Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat）。全音声が全対応言語で使える

## 変更ファイル

1. **`src/lib/tts/providers/gemini.ts`（新規）** — `GeminiProvider implements TTSProvider`
   - `speak(text, apiKey, voiceId)`: 上記APIへfetchでPOSTし、base64をデコードしてWAVの `ArrayBuffer` を返す
   - `getVoices(apiKey)`: プリセット30音声をハードコードで返す（OpenAIと同方式）
   - エラー時はレスポンスの `error.message` を含む `Error` をthrow
2. **`src/lib/tts/types.ts`** — `TTSProviderType` に `'gemini'` を追加、`CHARACTER_LIMITS.gemini = 8000`
3. **`src/lib/tts/factory.ts`** — `gemini: new GeminiProvider()` を登録
4. **`src/context/SettingsContext.tsx`** — `apiKeys.gemini`（デフォルト空文字）、`voiceSettings.gemini = 'Kore'` を追加
5. **`src/components/SettingsModal.tsx`** — プロバイダー選択に「Gemini」を追加、「Gemini API Key」入力欄を追加

## エラー処理

他プロバイダーと同様、HTTPエラーやレスポンスに音声データがない場合は日本語で状況が分かるメッセージ付きの `Error` をthrowし、既存のエラー表示UIに乗せる。

## 検証

- `npm run build` と `npm run lint` が通ること（リポジトリにテスト基盤はないため）
- ユーザーのGemini APIキーで日本語テキストの読み上げを実機確認
