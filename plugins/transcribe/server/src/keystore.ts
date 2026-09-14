import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { readApiKey } from "./deepgram.js";
import { MESSAGES, TranscribeError, isMissingPathError } from "./errors.js";

/** Where a kid's pasted key lives: ~/.transcribe/deepgram-key, readable only by that user. */
export function keyFilePath(homeDir: string): string {
  return path.join(homeDir, ".transcribe", "deepgram-key");
}

/** The stored key, or undefined when none has been saved. */
export async function readStoredKey(homeDir: string): Promise<string | undefined> {
  try {
    const value = (await readFile(keyFilePath(homeDir), "utf8")).trim();
    return value || undefined;
  } catch (err) {
    if (isMissingPathError(err)) return undefined;
    throw err;
  }
}

/** Save the key with user-only permissions. Returns the file path it was written to. */
export async function storeKey(homeDir: string, key: string): Promise<string> {
  const trimmed = key.trim();
  if (!trimmed || /\s/.test(trimmed)) throw new TranscribeError(MESSAGES.badKey);
  const target = keyFilePath(homeDir);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    await writeFile(tmp, `${trimmed}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(tmp, target);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
  return target;
}

/** The key to use: a pasted-and-saved key wins, then the plugin/env variables. */
export async function resolveApiKey(env: NodeJS.ProcessEnv, homeDir: string): Promise<string | undefined> {
  return (await readStoredKey(homeDir)) ?? readApiKey(env);
}
