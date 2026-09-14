import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { readStoredKey, resolveApiKey, storeKey } from "../src/keystore.js";

let home: string;

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), "keystore-"));
});

describe("key store", () => {
  it("stores a key and reads it back", async () => {
    const saved = await storeKey(home, "dg_abc123");
    expect(saved).toBe(path.join(home, ".transcribe", "deepgram-key"));
    expect(await readStoredKey(home)).toBe("dg_abc123");
    expect(await readFile(saved, "utf8")).toBe("dg_abc123\n");
  });

  it("returns undefined when nothing is stored", async () => {
    expect(await readStoredKey(home)).toBeUndefined();
  });
});

describe("storeKey validation", () => {
  it("trims whitespace a kid pasted around the key", async () => {
    await storeKey(home, "  dg_abc123 \n");
    expect(await readStoredKey(home)).toBe("dg_abc123");
  });

  it("rejects a blank key with the kid-facing message and stores nothing", async () => {
    await expect(storeKey(home, "   ")).rejects.toThrow(
      "That doesn't look like a Deepgram key. Ask Dad to send it again.",
    );
    expect(await readStoredKey(home)).toBeUndefined();
  });

  it("rejects a key with spaces inside it", async () => {
    await expect(storeKey(home, "dg abc")).rejects.toThrow(
      "That doesn't look like a Deepgram key. Ask Dad to send it again.",
    );
  });

  it.skipIf(process.platform === "win32")("writes the file readable only by the user", async () => {
    const saved = await storeKey(home, "dg_abc123");
    expect((await stat(saved)).mode & 0o777).toBe(0o600);
  });
});

describe("resolveApiKey", () => {
  it("prefers the stored key over environment variables", async () => {
    await storeKey(home, "dg_stored");
    expect(await resolveApiKey({ DEEPGRAM_API_KEY: "dg_env" }, home)).toBe("dg_stored");
  });

  it("falls back to the environment when nothing is stored", async () => {
    expect(await resolveApiKey({ DEEPGRAM_API_KEY: "dg_env" }, home)).toBe("dg_env");
  });

  it("is undefined when neither is set", async () => {
    expect(await resolveApiKey({}, home)).toBeUndefined();
  });
});
