import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transcriber } from "../src/deepgram.js";
import { transcribeAudio, type TranscribeDeps } from "../src/transcribe.js";

let dir: string;
let audioPath: string;

const fixedNow = () => new Date(2026, 8, 14, 10, 30);

function deps(transcriber: Transcriber): TranscribeDeps {
  return { transcriber, now: fixedNow, homeDir: dir, platform: "posix" };
}

const happy: Transcriber = vi.fn(async () => ({
  transcript: "Hello class. Today we cover cells.",
  paragraphs: ["Hello class.", "Today we cover cells."],
  durationSeconds: 125,
}));

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "transcribe-"));
  audioPath = path.join(dir, "bio-lecture-3.m4a");
  await writeFile(audioPath, Buffer.from("not really audio"));
  vi.clearAllMocks();
});

describe("transcribeAudio", () => {
  it("writes the transcript beside the audio and returns it", async () => {
    const out = await transcribeAudio({ file_path: audioPath, overwrite: false }, deps(happy));

    const expectedPath = path.join(dir, "bio-lecture-3.transcript.md");
    expect(out).toEqual({
      transcript_path: expectedPath,
      audio_path: audioPath,
      duration_seconds: 125,
      model: "nova-3",
      already_existed: false,
      markdown: [
        "# Transcript: bio-lecture-3.m4a",
        "",
        "Transcribed 2026-09-14 · 2 min · Deepgram Nova-3",
        "",
        "Hello class.",
        "",
        "Today we cover cells.",
        "",
      ].join("\n"),
    });
    expect(await readFile(expectedPath, "utf8")).toBe(out.markdown);
    expect(happy).toHaveBeenCalledWith(audioPath);
  });

  it("expands ~ relative to homeDir", async () => {
    const out = await transcribeAudio({ file_path: "~/bio-lecture-3.m4a", overwrite: false }, deps(happy));
    expect(out.audio_path).toBe(audioPath);
  });

  it("returns an existing transcript without calling Deepgram", async () => {
    const existing = path.join(dir, "bio-lecture-3.transcript.md");
    await writeFile(existing, "# Transcript: bio-lecture-3.m4a\n\nold\n");

    const out = await transcribeAudio({ file_path: audioPath, overwrite: false }, deps(happy));

    expect(happy).not.toHaveBeenCalled();
    expect(out.already_existed).toBe(true);
    expect(out.duration_seconds).toBeNull();
    expect(out.markdown).toBe("# Transcript: bio-lecture-3.m4a\n\nold\n");
    expect(out.transcript_path).toBe(existing);
  });

  it("re-transcribes when overwrite is true", async () => {
    const existing = path.join(dir, "bio-lecture-3.transcript.md");
    await writeFile(existing, "old\n");

    const out = await transcribeAudio({ file_path: audioPath, overwrite: true }, deps(happy));

    expect(happy).toHaveBeenCalledTimes(1);
    expect(out.already_existed).toBe(false);
    expect(await readFile(existing, "utf8")).toContain("Hello class.");
  });

  it("rejects an empty transcript with the spec message and writes nothing", async () => {
    const silent: Transcriber = async () => ({ transcript: "", paragraphs: [], durationSeconds: 9 });

    await expect(transcribeAudio({ file_path: audioPath, overwrite: false }, deps(silent))).rejects.toThrow(
      "Deepgram didn't hear any speech in bio-lecture-3.m4a. Check that it recorded properly.",
    );
    expect(await readdir(dir)).toEqual(["bio-lecture-3.m4a"]);
  });

  it("leaves no partial or temp file when the transcriber throws", async () => {
    const failing: Transcriber = async () => {
      throw new Error("boom");
    };

    await expect(transcribeAudio({ file_path: audioPath, overwrite: false }, deps(failing))).rejects.toThrow("boom");
    expect(await readdir(dir)).toEqual(["bio-lecture-3.m4a"]);
  });

  it("surfaces validation errors before touching Deepgram", async () => {
    await expect(
      transcribeAudio({ file_path: path.join(dir, "missing.m4a"), overwrite: false }, deps(happy)),
    ).rejects.toThrow("I couldn't find a file at");
    expect(happy).not.toHaveBeenCalled();
  });

  it("leaves no temp file behind after a successful write", async () => {
    await transcribeAudio({ file_path: audioPath, overwrite: false }, deps(happy));
    const names = await readdir(dir);
    expect(names.sort()).toEqual(["bio-lecture-3.m4a", "bio-lecture-3.transcript.md"]);
  });
});
