import { describe, expect, it } from "vitest";
import { MESSAGES, TranscribeError, mapDeepgramError } from "../src/errors.js";

class FakeDeepgramError extends Error {
  constructor(public statusCode: number, public body?: unknown) {
    super(`Status code: ${statusCode}\nBody: ${JSON.stringify(body ?? {})}`);
  }
}

describe("MESSAGES", () => {
  it("uses the exact spec wording for the missing-key case", () => {
    expect(MESSAGES.noKey).toBe(
      "No Deepgram key is set. Ask Dad for your key, then paste it here and I'll save it.",
    );
  });

  it("interpolates the file name", () => {
    expect(MESSAGES.unsupported("notes.txt")).toBe(
      "notes.txt isn't a supported audio type. Try exporting it as MP3 or M4A.",
    );
  });
});

describe("mapDeepgramError", () => {
  it("maps 401 and 403 to a rejected key", () => {
    expect(mapDeepgramError(new FakeDeepgramError(401), "a.m4a").message).toBe(
      "Deepgram rejected your key. Ask Dad to check it.",
    );
    expect(mapDeepgramError(new FakeDeepgramError(403), "a.m4a").message).toBe(
      "Deepgram rejected your key. Ask Dad to check it.",
    );
  });

  it("maps 402 to out of credit", () => {
    expect(mapDeepgramError(new FakeDeepgramError(402), "a.m4a").message).toBe(
      "The Deepgram account is out of credit. Tell Dad.",
    );
  });

  it("maps 5xx to not responding", () => {
    expect(mapDeepgramError(new FakeDeepgramError(503), "a.m4a").message).toBe(
      "Deepgram isn't responding right now. Try again in a few minutes.",
    );
  });

  it("maps network failures to not responding", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    expect(mapDeepgramError(err, "a.m4a").message).toBe(
      "Deepgram isn't responding right now. Try again in a few minutes.",
    );
    const timeout = Object.assign(new Error("timed out"), { name: "DeepgramTimeoutError" });
    expect(mapDeepgramError(timeout, "a.m4a").message).toBe(
      "Deepgram isn't responding right now. Try again in a few minutes.",
    );
  });

  it("falls back to a generic message with the file name and reason", () => {
    const err = new FakeDeepgramError(400, { err_msg: "bad audio" });
    expect(mapDeepgramError(err, "a.m4a").message).toBe(
      "Something went wrong transcribing a.m4a: bad audio. Tell Dad if it keeps happening.",
    );
  });

  it("prefers Deepgram's err_msg over the status line", () => {
    const err = new FakeDeepgramError(400, { err_msg: "failed to process audio: corrupt or unsupported data" });
    expect(mapDeepgramError(err, "a.m4a").message).toBe(
      "Something went wrong transcribing a.m4a: failed to process audio: corrupt or unsupported data. Tell Dad if it keeps happening.",
    );
  });

  it("routes a credit message to out-of-credit regardless of status", () => {
    const err = new FakeDeepgramError(403, { err_msg: "Insufficient credits for this project" });
    expect(mapDeepgramError(err, "a.m4a").message).toBe("The Deepgram account is out of credit. Tell Dad.");
  });

  it("passes TranscribeError through untouched", () => {
    const original = new TranscribeError("custom");
    expect(mapDeepgramError(original, "a.m4a")).toBe(original);
  });

  it("never includes anything that looks like a key in the message", () => {
    const err = new FakeDeepgramError(400, { key: "dg_secret_123" });
    expect(mapDeepgramError(err, "a.m4a").message).not.toContain("dg_secret_123");
  });
});
