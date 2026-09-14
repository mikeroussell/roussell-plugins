import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { MODEL, type Transcriber } from "./deepgram.js";
import { MESSAGES, TranscribeError } from "./errors.js";
import { renderTranscript } from "./format.js";
import { displayName, resolveAudioPath, transcriptPathFor, type Platform } from "./paths.js";
import { validateAudioFile } from "./validate.js";

export interface TranscribeInput {
  file_path: string;
  overwrite: boolean;
}

export interface TranscribeOutput {
  transcript_path: string;
  audio_path: string;
  /** null when an existing transcript was returned without re-transcribing */
  duration_seconds: number | null;
  model: string;
  already_existed: boolean;
  markdown: string;
}

export interface TranscribeDeps {
  transcriber: Transcriber;
  now: () => Date;
  homeDir: string;
  platform: Platform;
}

/** Returns the existing transcript, null when there is none, and throws for any other read failure. */
async function readExisting(filePath: string, name: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as { code?: unknown })?.code;
    if (code === "ENOENT" || code === "ENOTDIR") return null;
    const reason = err instanceof Error && err.message ? err.message.split(/\r?\n/, 1)[0] : "unknown error";
    throw new TranscribeError(MESSAGES.generic(name, reason));
  }
}

/** Write via a sibling temp file and rename, so a crash never leaves a half-written transcript. */
async function writeAtomic(filePath: string, contents: string): Promise<void> {
  const tmp = `${filePath}.tmp-${process.pid}`;
  try {
    await writeFile(tmp, contents, "utf8");
    await rename(tmp, filePath);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

/**
 * The spec's section 3 behavior, in order:
 * resolve -> validate -> short-circuit on existing transcript -> transcribe -> render -> atomic write.
 */
export async function transcribeAudio(input: TranscribeInput, deps: TranscribeDeps): Promise<TranscribeOutput> {
  const audioPath = resolveAudioPath(input.file_path, deps.homeDir, deps.platform);
  await validateAudioFile(audioPath, deps.platform, stat);

  const transcriptPath = transcriptPathFor(audioPath, deps.platform);
  const name = displayName(audioPath);

  if (!input.overwrite) {
    const existing = await readExisting(transcriptPath, name);
    if (existing !== null) {
      return {
        transcript_path: transcriptPath,
        audio_path: audioPath,
        duration_seconds: null,
        model: MODEL,
        already_existed: true,
        markdown: existing,
      };
    }
  }

  const result = await deps.transcriber(audioPath);
  if (result.paragraphs.length === 0) throw new TranscribeError(MESSAGES.empty(name));

  const markdown = renderTranscript({
    audioName: name,
    date: deps.now(),
    durationSeconds: result.durationSeconds,
    paragraphs: result.paragraphs,
  });
  await writeAtomic(transcriptPath, markdown);

  return {
    transcript_path: transcriptPath,
    audio_path: audioPath,
    duration_seconds: result.durationSeconds,
    model: MODEL,
    already_existed: false,
    markdown,
  };
}
