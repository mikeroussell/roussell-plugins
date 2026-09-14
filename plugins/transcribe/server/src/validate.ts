import { MESSAGES, TranscribeError, fromSystemError, isMissingPathError } from "./errors.js";
import { displayName, extensionOf, type Platform } from "./paths.js";

export const SUPPORTED_EXTENSIONS = [
  "mp3",
  "m4a",
  "wav",
  "aac",
  "flac",
  "ogg",
  "opus",
  "webm",
  "mp4",
  "mov",
] as const;

/** Deepgram's pre-recorded upload limit. */
export const MAX_BYTES = 2 * 1024 ** 3;

export interface StatLike {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
}

export type StatFn = (filePath: string) => Promise<StatLike>;

const SUPPORTED = new Set<string>(SUPPORTED_EXTENSIONS);

/**
 * Checks, in order: exists, is a regular file, supported extension, size.
 * Throws TranscribeError with the spec's kid-facing message on the first failure.
 */
export async function validateAudioFile(
  audioPath: string,
  platform: Platform,
  statFn: StatFn,
): Promise<{ sizeBytes: number }> {
  let stat: StatLike;
  try {
    stat = await statFn(audioPath);
  } catch (err) {
    if (isMissingPathError(err)) throw new TranscribeError(MESSAGES.notFound(audioPath));
    throw fromSystemError(err, displayName(audioPath));
  }

  if (stat.isDirectory()) throw new TranscribeError(MESSAGES.isFolder(audioPath));
  if (!stat.isFile()) throw new TranscribeError(MESSAGES.notFound(audioPath));

  const name = displayName(audioPath);
  if (!SUPPORTED.has(extensionOf(audioPath, platform))) {
    throw new TranscribeError(MESSAGES.unsupported(name));
  }
  if (stat.size > MAX_BYTES) throw new TranscribeError(MESSAGES.tooBig(name));

  return { sizeBytes: stat.size };
}
