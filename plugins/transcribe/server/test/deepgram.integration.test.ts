import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDeepgramTranscriber, readApiKey } from "../src/deepgram.js";

const apiKey = readApiKey(process.env);
const enabled = process.env.RUN_DEEPGRAM_INTEGRATION === "1" && Boolean(apiKey);

// Same public clip the Anthropic/Deepgram cookbook uses.
const SAMPLE_URL = "https://static.deepgram.com/examples/nasa-spacewalk-interview.wav";

describe("Deepgram integration", () => {
  it.runIf(enabled)(
    "transcribes a real clip",
    async () => {
      const dir = await mkdtemp(path.join(tmpdir(), "transcribe-it-"));
      const audioPath = path.join(dir, "nasa.wav");
      const res = await fetch(SAMPLE_URL);
      await writeFile(audioPath, Buffer.from(await res.arrayBuffer()));

      const transcribe = createDeepgramTranscriber(apiKey as string);
      const result = await transcribe(audioPath);

      expect(result.transcript.length).toBeGreaterThan(50);
      expect(result.paragraphs.length).toBeGreaterThan(0);
      expect(result.durationSeconds).toBeGreaterThan(5);
    },
    120_000,
  );

  it.skipIf(enabled)("is skipped without RUN_DEEPGRAM_INTEGRATION=1 and a key", () => {
    expect(enabled).toBe(false);
  });
});
