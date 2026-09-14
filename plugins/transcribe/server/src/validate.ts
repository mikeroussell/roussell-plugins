import { MESSAGES, TranscribeError } from "./errors.js";
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
    const code = (err as { code?: unknown })?.code;
    if (code === "ENOENT" || code === "ENOTDIR") throw new TranscribeError(MESSAGES.notFound(audioPath));
    const reason = err instanceof Error && err.message ? err.message.split(/\r?\n/, 1)[0] : "unknown error";
    throw new TranscribeError(MESSAGES.generic(displayName(audioPath), reason));
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
