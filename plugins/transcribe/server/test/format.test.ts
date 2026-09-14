import { describe, expect, it } from "vitest";
import { formatDuration, formatLocalDate, renderTranscript } from "../src/format.js";

describe("formatDuration", () => {
  it("shows seconds under a minute", () => {
    expect(formatDuration(4.6)).toBe("5 s");
    expect(formatDuration(59)).toBe("59 s");
  });

  it("rounds to whole minutes at 60 s and above", () => {
    expect(formatDuration(60)).toBe("1 min");
    expect(formatDuration(2460)).toBe("41 min");
    expect(formatDuration(2489)).toBe("41 min");
    expect(formatDuration(2491)).toBe("42 min");
  });
});

describe("formatLocalDate", () => {
  it("uses local calendar fields, zero-padded", () => {
    expect(formatLocalDate(new Date(2026, 8, 14, 10, 32))).toBe("2026-09-14");
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("renderTranscript", () => {
  it("renders the spec layout with paragraphs separated by blank lines", () => {
    const md = renderTranscript({
      audioName: "bio-lecture-3.m4a",
      date: new Date(2026, 8, 14),
      durationSeconds: 2460,
      paragraphs: ["First paragraph of the recording.", "Second paragraph."],
    });
    expect(md).toBe(
      [
        "# Transcript: bio-lecture-3.m4a",
        "",
        "Transcribed 2026-09-14 · 41 min · Deepgram Nova-3",
        "",
        "First paragraph of the recording.",
        "",
        "Second paragraph.",
        "",
      ].join("\n"),
    );
  });

  it("uses \\n line endings only and ends with exactly one newline", () => {
    const md = renderTranscript({
      audioName: "a.mp3",
      date: new Date(2026, 8, 14),
      durationSeconds: 10,
      paragraphs: ["Hi."],
    });
    expect(md).not.toContain("\r");
    expect(md.endsWith(".\n")).toBe(true);
    expect(md.endsWith("\n\n")).toBe(false);
  });
});
