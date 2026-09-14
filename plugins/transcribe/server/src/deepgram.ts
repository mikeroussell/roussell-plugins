import { createReadStream } from "node:fs";
import { DeepgramClient } from "@deepgram/sdk";
import { mapDeepgramError } from "./errors.js";
import { displayName } from "./paths.js";

export const MODEL = "nova-3";

export interface TranscriptionResult {
  transcript: string;
  paragraphs: string[];
  durationSeconds: number;
}

export type Transcriber = (audioPath: string) => Promise<TranscriptionResult>;

/** Plugin userConfig injects CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY; DEEPGRAM_API_KEY is the manual fallback. */
export function readApiKey(env: NodeJS.ProcessEnv): string | undefined {
  for (const name of ["CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY", "DEEPGRAM_API_KEY"]) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

interface ListenResponseLike {
  metadata?: { duration?: unknown };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: unknown;
        paragraphs?: { paragraphs?: Array<{ sentences?: Array<{ text?: unknown }> }> };
      }>;
    }>;
  };
}

/** Pull the plain transcript, paragraph texts, and duration out of a Deepgram listen response. */
export function toTranscriptionResult(data: unknown): TranscriptionResult {
  const d = (data ?? {}) as ListenResponseLike;
  const alt = d.results?.channels?.[0]?.alternatives?.[0];
  const transcript = typeof alt?.transcript === "string" ? alt.transcript.trim() : "";
  const durationRaw = d.metadata?.duration;
  const durationSeconds = typeof durationRaw === "number" && Number.isFinite(durationRaw) ? durationRaw : 0;

  const fromParagraphs = (alt?.paragraphs?.paragraphs ?? [])
    .map((p) =>
      (p.sentences ?? [])
        .map((s) => (typeof s.text === "string" ? s.text.trim() : ""))
        .filter((t) => t.length > 0)
        .join(" "),
    )
    .filter((t) => t.length > 0);

  const paragraphs = fromParagraphs.length > 0 ? fromParagraphs : transcript ? [transcript] : [];
  return { transcript, paragraphs, durationSeconds };
}

/**
 * Real Deepgram call. Streams the file so large recordings are never fully buffered.
 * Options are fixed by the spec: nova-3, smart_format, paragraphs, detect_language.
 * timeoutInSeconds/maxRetries live on the SDK's request-options argument (third
 * parameter to transcribeFile), not on the transcription options object itself —
 * see node_modules/@deepgram/sdk/dist/cjs/BaseClient.d.ts (BaseRequestOptions).
 */
export function createDeepgramTranscriber(apiKey: string): Transcriber {
  const client = new DeepgramClient({ apiKey });
  return async (audioPath) => {
    try {
      const data = await client.listen.v1.media.transcribeFile(
        createReadStream(audioPath),
        {
          model: MODEL,
          smart_format: true,
          paragraphs: true,
          detect_language: true,
        },
        {
          timeoutInSeconds: 900,
          maxRetries: 1,
        },
      );
      return toTranscriptionResult(data);
    } catch (err) {
      throw mapDeepgramError(err, displayName(audioPath));
    }
  };
}
