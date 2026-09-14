import path from "node:path";

export type Platform = "posix" | "win32";

export function pathImpl(platform: Platform): path.PlatformPath {
  return platform === "win32" ? path.win32 : path.posix;
}

/**
 * Expand a leading "~" and resolve to an absolute, normalized path
 * using the separator rules of the target platform.
 */
export function resolveAudioPath(input: string, homeDir: string, platform: Platform): string {
  const p = pathImpl(platform);
  const trimmed = input.trim();
  const homeRelative =
    trimmed === "~" ? "" : trimmed.startsWith("~/") || trimmed.startsWith("~\\") ? trimmed.slice(2) : null;
  const expanded = homeRelative === null ? trimmed : p.join(homeDir, homeRelative);
  return p.resolve(expanded);
}

/** `/r/lecture.m4a` -> `/r/lecture.transcript.md`, beside the audio. */
export function transcriptPathFor(audioPath: string, platform: Platform): string {
  const p = pathImpl(platform);
  const ext = p.extname(audioPath);
  const base = p.basename(audioPath, ext);
  return p.join(p.dirname(audioPath), `${base}.transcript.md`);
}

/** Lowercase extension without the dot; "" when there is none. */
export function extensionOf(filePath: string, platform: Platform): string {
  return pathImpl(platform).extname(filePath).slice(1).toLowerCase();
}

/**
 * File name for messages. path.win32.basename understands both "/" and "\",
 * so it is safe for display on any platform.
 */
export function displayName(filePath: string): string {
  return path.win32.basename(filePath);
}
