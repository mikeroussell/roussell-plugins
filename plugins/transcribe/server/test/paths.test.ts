import { describe, expect, it } from "vitest";
import {
  displayName,
  extensionOf,
  resolveAudioPath,
  transcriptPathFor,
} from "../src/paths.js";

describe("resolveAudioPath (posix)", () => {
  it("returns absolute paths unchanged after normalization", () => {
    expect(resolveAudioPath("/Users/kid/Recordings/../Recordings/a.m4a", "/Users/kid", "posix")).toBe(
      "/Users/kid/Recordings/a.m4a",
    );
  });

  it("expands a leading ~", () => {
    expect(resolveAudioPath("~/Recordings/a.m4a", "/Users/kid", "posix")).toBe(
      "/Users/kid/Recordings/a.m4a",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(resolveAudioPath("  /tmp/a.mp3  ", "/Users/kid", "posix")).toBe("/tmp/a.mp3");
  });

  it("expands a bare ~ to the home directory", () => {
    expect(resolveAudioPath("~", "/Users/kid", "posix")).toBe("/Users/kid");
  });
});

describe("resolveAudioPath (win32)", () => {
  it("accepts backslash paths", () => {
    expect(resolveAudioPath("C:\\Users\\kid\\Recordings\\a.m4a", "C:\\Users\\kid", "win32")).toBe(
      "C:\\Users\\kid\\Recordings\\a.m4a",
    );
  });

  it("accepts forward-slash Windows paths", () => {
    expect(resolveAudioPath("C:/Users/kid/Recordings/a.m4a", "C:\\Users\\kid", "win32")).toBe(
      "C:\\Users\\kid\\Recordings\\a.m4a",
    );
  });

  it("expands ~ with either separator", () => {
    expect(resolveAudioPath("~\\Recordings\\a.m4a", "C:\\Users\\kid", "win32")).toBe(
      "C:\\Users\\kid\\Recordings\\a.m4a",
    );
    expect(resolveAudioPath("~/Recordings/a.m4a", "C:\\Users\\kid", "win32")).toBe(
      "C:\\Users\\kid\\Recordings\\a.m4a",
    );
  });
});

describe("transcriptPathFor", () => {
  it("replaces the extension beside the audio (posix)", () => {
    expect(transcriptPathFor("/Users/kid/Recordings/lecture.m4a", "posix")).toBe(
      "/Users/kid/Recordings/lecture.transcript.md",
    );
  });

  it("replaces the extension beside the audio (win32)", () => {
    expect(transcriptPathFor("C:\\Users\\kid\\Recordings\\Lecture.M4A", "win32")).toBe(
      "C:\\Users\\kid\\Recordings\\Lecture.transcript.md",
    );
  });

  it("keeps dots inside the base name", () => {
    expect(transcriptPathFor("/r/bio.lecture.3.mp3", "posix")).toBe("/r/bio.lecture.3.transcript.md");
  });
});

describe("extensionOf", () => {
  it("lowercases and strips the dot", () => {
    expect(extensionOf("/r/A.MP3", "posix")).toBe("mp3");
    expect(extensionOf("C:\\r\\a.M4a", "win32")).toBe("m4a");
  });

  it("returns empty for no extension", () => {
    expect(extensionOf("/r/noext", "posix")).toBe("");
  });
});

describe("displayName", () => {
  it("returns the file name for either separator", () => {
    expect(displayName("/Users/kid/a.m4a")).toBe("a.m4a");
    expect(displayName("C:\\Users\\kid\\a.m4a")).toBe("a.m4a");
  });
});
