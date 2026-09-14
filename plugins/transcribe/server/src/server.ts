import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MESSAGES, TranscribeError } from "./errors.js";
import { MODEL_LABEL, formatDuration } from "./format.js";
import { displayName } from "./paths.js";
import type { TranscribeInput, TranscribeOutput } from "./transcribe.js";

export type TranscribeFn = (input: TranscribeInput) => Promise<TranscribeOutput>;
/** Persist a pasted key; resolves to the path it was saved at. */
export type StoreKeyFn = (apiKey: string) => Promise<string>;

export interface ServerDeps {
  transcribe: TranscribeFn;
  storeKey: StoreKeyFn;
}

const inputSchema = {
  file_path: z
    .string()
    .min(1)
    .describe("Path to the audio or video file to transcribe. Absolute, or starting with ~ for the home folder."),
  overwrite: z
    .boolean()
    .optional()
    .describe("Re-transcribe even if a transcript file already exists beside the audio. Default false."),
};

const outputSchema = {
  transcript_path: z.string(),
  audio_path: z.string(),
  duration_seconds: z.number().nullable(),
  model: z.string(),
  already_existed: z.boolean(),
};

const DESCRIPTION = `Transcribe a local audio or video recording to text with Deepgram and save the transcript as a Markdown file beside the recording.

Use this when the user mentions a recording, voice memo, lecture, interview, or audio file they want turned into text, notes, or a summary.

Supported types: mp3, m4a, wav, aac, flac, ogg, opus, webm, mp4, mov. Files up to 2 GB.

If a transcript already exists beside the audio it is returned without re-transcribing (pass overwrite: true to redo it).

Returns a line saying where the transcript was saved, followed by the full transcript. Do not paste the whole transcript back to the user; tell them where it was saved and then do what they asked (notes, summary, answer a question).`;

function successText(out: TranscribeOutput): string {
  const name = displayName(out.audio_path);
  const head = out.already_existed
    ? `A transcript for ${name} already existed at ${out.transcript_path}, so I returned it without re-transcribing. Pass overwrite: true to redo it.`
    : `Saved transcript to ${out.transcript_path} (${formatDuration(out.duration_seconds ?? 0)}, ${MODEL_LABEL}).`;
  return `${head}\n\n${out.markdown}`;
}

const KEY_DESCRIPTION = `Save the user's Deepgram API key so transcribe_audio can use it. Call this when the user pastes a Deepgram key or says Dad gave them a key. Ask for the key only if transcribe_audio reported that no key is set. Never repeat the key back to the user.`;

function reasonOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "unknown error";
}

function keyErrorText(err: unknown): string {
  if (err instanceof TranscribeError) return err.message;
  return MESSAGES.keySaveFailed(reasonOf(err));
}

function errorText(err: unknown, filePath: string): string {
  if (err instanceof TranscribeError) return err.message;
  return MESSAGES.generic(displayName(filePath), reasonOf(err));
}

export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({ name: "transcribe", version: "0.2.0" });

  server.registerTool(
    "transcribe_audio",
    {
      title: "Transcribe Audio",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        // Not idempotent: overwrite: true re-transcribes (re-bills) and rewrites the file.
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ file_path, overwrite }) => {
      try {
        const out = await deps.transcribe({ file_path, overwrite: overwrite ?? false });
        return {
          content: [{ type: "text" as const, text: successText(out) }],
          structuredContent: {
            transcript_path: out.transcript_path,
            audio_path: out.audio_path,
            duration_seconds: out.duration_seconds,
            model: out.model,
            already_existed: out.already_existed,
          },
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: errorText(err, file_path) }],
        };
      }
    },
  );

  server.registerTool(
    "set_deepgram_key",
    {
      title: "Save Deepgram Key",
      description: KEY_DESCRIPTION,
      inputSchema: {
        api_key: z.string().min(1).describe("The Deepgram API key exactly as the user pasted it."),
      },
      outputSchema: { saved_to: z.string() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ api_key }) => {
      try {
        const savedTo = await deps.storeKey(api_key);
        return {
          content: [{ type: "text" as const, text: MESSAGES.keySaved(savedTo) }],
          structuredContent: { saved_to: savedTo },
        };
      } catch (err) {
        return { isError: true, content: [{ type: "text" as const, text: keyErrorText(err) }] };
      }
    },
  );

  return server;
}
