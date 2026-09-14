/**
 * Every message here is shown to a kid by Claude, nearly verbatim.
 * Keep them plain, short, and actionable. "Dad" is intentional.
 */
export class TranscribeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscribeError";
  }
}

export const MESSAGES = {
  noKey:
    "No Deepgram key is set. Ask Dad for your key, then re-enable the Transcribe plugin.",
  keyRejected: "Deepgram rejected your key. Ask Dad to check it.",
  outOfCredit: "The Deepgram account is out of credit. Tell Dad.",
  notResponding: "Deepgram isn't responding right now. Try again in a few minutes.",
  notFound: (path: string) =>
    `I couldn't find a file at ${path}. Check the name and folder.`,
  isFolder: (path: string) => `${path} is a folder, not a file.`,
  unsupported: (name: string) =>
    `${name} isn't a supported audio type. Try exporting it as MP3 or M4A.`,
  tooBig: (name: string) =>
    `${name} is too big to transcribe (over 2 GB). Try splitting it or exporting a smaller version.`,
  empty: (name: string) =>
    `Deepgram didn't hear any speech in ${name}. Check that it recorded properly.`,
  generic: (name: string, reason: string) =>
    `Something went wrong transcribing ${name}: ${reason}. Tell Dad if it keeps happening.`,
} as const;

const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const TIMEOUT_NAMES = new Set(["DeepgramTimeoutError", "AbortError", "TimeoutError"]);

interface ErrorLike {
  statusCode?: unknown;
  code?: unknown;
  name?: unknown;
  message?: unknown;
}

function firstLine(text: string): string {
  return text.split(/\r?\n/, 1)[0].trim();
}

/**
 * Turn anything thrown by the Deepgram SDK (or the network under it)
 * into a TranscribeError with a kid-readable message.
 */
export function mapDeepgramError(err: unknown, fileName: string): TranscribeError {
  if (err instanceof TranscribeError) return err;

  const e = (err ?? {}) as ErrorLike;
  const status = typeof e.statusCode === "number" ? e.statusCode : undefined;
  const code = typeof e.code === "string" ? e.code : undefined;
  const name = typeof e.name === "string" ? e.name : undefined;
  const message = typeof e.message === "string" && e.message ? e.message : "unknown error";

  if (status === 401 || status === 403) return new TranscribeError(MESSAGES.keyRejected);
  if (status === 402) return new TranscribeError(MESSAGES.outOfCredit);
  if (status !== undefined && status >= 500) return new TranscribeError(MESSAGES.notResponding);
  if (code && NETWORK_CODES.has(code)) return new TranscribeError(MESSAGES.notResponding);
  if (name && TIMEOUT_NAMES.has(name)) return new TranscribeError(MESSAGES.notResponding);

  return new TranscribeError(MESSAGES.generic(fileName, firstLine(message)));
}
