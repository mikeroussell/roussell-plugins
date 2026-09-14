import { describe, expect, it } from "vitest";
import { readApiKey, toTranscriptionResult } from "../src/deepgram.js";

describe("readApiKey", () => {
  it("prefers the plugin option variable", () => {
    expect(
      readApiKey({ CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY: "opt", DEEPGRAM_API_KEY: "env" }),
    ).toBe("opt");
  });

  it("falls back to DEEPGRAM_API_KEY", () => {
    expect(readApiKey({ DEEPGRAM_API_KEY: "env" })).toBe("env");
  });

  it("treats blank values as unset", () => {
    expect(readApiKey({ CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY: "  ", DEEPGRAM_API_KEY: "" })).toBeUndefined();
    expect(readApiKey({})).toBeUndefined();
  });

  it("trims whitespace a kid pasted around the key", () => {
    expect(readApiKey({ DEEPGRAM_API_KEY: " abc \n" })).toBe("abc");
  });
});

describe("toTranscriptionResult", () => {
  const response = {
    metadata: { duration: 2460.4 },
    results: {
      channels: [
        {
          alternatives: [
            {
              transcript: "First sentence. Second sentence. Third.",
              paragraphs: {
                paragraphs: [
                  { sentences: [{ text: "First sentence." }, { text: "Second sentence." }] },
                  { sentences: [{ text: "Third." }] },
                ],
              },
            },
          ],
        },
      ],
    },
  };

  it("joins sentences within a paragraph with spaces", () => {
    expect(toTranscriptionResult(response)).toEqual({
      transcript: "First sentence. Second sentence. Third.",
      paragraphs: ["First sentence. Second sentence.", "Third."],
      durationSeconds: 2460.4,
    });
  });

  it("falls back to the flat transcript when paragraphs are absent", () => {
    const short = {
      metadata: { duration: 3 },
      results: { channels: [{ alternatives: [{ transcript: "Hello there." }] }] },
    };
    expect(toTranscriptionResult(short).paragraphs).toEqual(["Hello there."]);
  });

  it("returns no paragraphs for an empty transcript", () => {
    const silent = {
      metadata: { duration: 3 },
      results: { channels: [{ alternatives: [{ transcript: "" }] }] },
    };
    expect(toTranscriptionResult(silent)).toEqual({ transcript: "", paragraphs: [], durationSeconds: 3 });
  });

  it("tolerates a malformed response", () => {
    expect(toTranscriptionResult({})).toEqual({ transcript: "", paragraphs: [], durationSeconds: 0 });
    expect(toTranscriptionResult(null)).toEqual({ transcript: "", paragraphs: [], durationSeconds: 0 });
  });
});
