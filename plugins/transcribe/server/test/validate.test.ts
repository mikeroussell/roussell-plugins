import { describe, expect, it } from "vitest";
import { MAX_BYTES, SUPPORTED_EXTENSIONS, validateAudioFile, type StatFn } from "../src/validate.js";

function fileStat(size: number): StatFn {
  return async () => ({ isFile: () => true, isDirectory: () => false, size });
}

const dirStat: StatFn = async () => ({ isFile: () => false, isDirectory: () => true, size: 0 });

const missingStat: StatFn = async () => {
  throw Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
};

describe("validateAudioFile", () => {
  it("accepts every supported extension regardless of case", async () => {
    for (const ext of SUPPORTED_EXTENSIONS) {
      const upper = `/r/clip.${ext.toUpperCase()}`;
      await expect(validateAudioFile(upper, "posix", fileStat(1000))).resolves.toEqual({ sizeBytes: 1000 });
    }
  });

  it("rejects a missing file with the spec message", async () => {
    await expect(validateAudioFile("/r/nope.m4a", "posix", missingStat)).rejects.toThrow(
      "I couldn't find a file at /r/nope.m4a. Check the name and folder.",
    );
  });

  it("rejects a directory", async () => {
    await expect(validateAudioFile("/r/folder", "posix", dirStat)).rejects.toThrow(
      "/r/folder is a folder, not a file.",
    );
  });

  it("rejects an unsupported extension by file name", async () => {
    await expect(validateAudioFile("C:\\r\\notes.txt", "win32", fileStat(10))).rejects.toThrow(
      "notes.txt isn't a supported audio type. Try exporting it as MP3 or M4A.",
    );
  });

  it("rejects a file with no extension", async () => {
    await expect(validateAudioFile("/r/noext", "posix", fileStat(10))).rejects.toThrow(
      "noext isn't a supported audio type. Try exporting it as MP3 or M4A.",
    );
  });

  it("accepts exactly 2 GB and rejects one byte more", async () => {
    await expect(validateAudioFile("/r/big.mp3", "posix", fileStat(MAX_BYTES))).resolves.toEqual({
      sizeBytes: MAX_BYTES,
    });
    await expect(validateAudioFile("/r/big.mp3", "posix", fileStat(MAX_BYTES + 1))).rejects.toThrow(
      "big.mp3 is too big to transcribe (over 2 GB). Try splitting it or exporting a smaller version.",
    );
  });

  it("checks existence before extension", async () => {
    await expect(validateAudioFile("/r/nope.txt", "posix", missingStat)).rejects.toThrow(
      "I couldn't find a file at /r/nope.txt. Check the name and folder.",
    );
  });

  it("treats something that is neither a file nor a folder as missing", async () => {
    const oddStat: StatFn = async () => ({ isFile: () => false, isDirectory: () => false, size: 0 });
    await expect(validateAudioFile("/r/pipe.m4a", "posix", oddStat)).rejects.toThrow(
      "I couldn't find a file at /r/pipe.m4a. Check the name and folder.",
    );
  });

  it("reports a permissions failure as a generic error, not as missing", async () => {
    const deniedStat: StatFn = async () => {
      throw Object.assign(new Error("EACCES: permission denied, stat '/r/locked.m4a'"), { code: "EACCES" });
    };
    await expect(validateAudioFile("/r/locked.m4a", "posix", deniedStat)).rejects.toThrow(
      "Something went wrong transcribing locked.m4a: EACCES: permission denied, stat '/r/locked.m4a'. Tell Dad if it keeps happening.",
    );
  });
});
