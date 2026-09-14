import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { TranscribeError } from "../src/errors.js";
import { createServer, type TranscribeFn } from "../src/server.js";

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
}

async function connect(transcribe: TranscribeFn) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ transcribe });
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

const output = {
  transcript_path: "/r/lecture.transcript.md",
  audio_path: "/r/lecture.m4a",
  duration_seconds: 2460,
  model: "nova-3",
  already_existed: false,
  markdown: "# Transcript: lecture.m4a\n\nbody\n",
};

describe("transcribe_audio tool", () => {
  it("is the only tool and documents its inputs", async () => {
    const client = await connect(async () => output);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(["transcribe_audio"]);
    const schema = tools[0].inputSchema as { properties: Record<string, unknown>; required?: string[] };
    expect(Object.keys(schema.properties).sort()).toEqual(["file_path", "overwrite"]);
    expect(schema.required).toEqual(["file_path"]);
  });

  it("returns the saved-path line, the markdown, and structured content", async () => {
    let received: unknown;
    const client = await connect(async (input) => {
      received = input;
      return output;
    });

    const res = (await client.callTool({
      name: "transcribe_audio",
      arguments: { file_path: "/r/lecture.m4a" },
    })) as ToolResult;

    expect(received).toEqual({ file_path: "/r/lecture.m4a", overwrite: false });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toBe(
      "Saved transcript to /r/lecture.transcript.md (41 min, Deepgram Nova-3).\n\n# Transcript: lecture.m4a\n\nbody\n",
    );
    expect(res.structuredContent).toEqual({
      transcript_path: "/r/lecture.transcript.md",
      audio_path: "/r/lecture.m4a",
      duration_seconds: 2460,
      model: "nova-3",
      already_existed: false,
    });
  });

  it("passes overwrite through and explains an already-existing transcript", async () => {
    let received: unknown;
    const client = await connect(async (input) => {
      received = input;
      return { ...output, already_existed: true, duration_seconds: null };
    });

    const res = (await client.callTool({
      name: "transcribe_audio",
      arguments: { file_path: "/r/lecture.m4a", overwrite: true },
    })) as ToolResult;

    expect(received).toEqual({ file_path: "/r/lecture.m4a", overwrite: true });
    expect(res.content[0].text).toBe(
      "A transcript for lecture.m4a already existed at /r/lecture.transcript.md, so I returned it without re-transcribing. Pass overwrite: true to redo it.\n\n# Transcript: lecture.m4a\n\nbody\n",
    );
    expect(res.structuredContent?.duration_seconds).toBeNull();
  });

  it("returns TranscribeError messages verbatim as tool errors", async () => {
    const client = await connect(async () => {
      throw new TranscribeError("Deepgram rejected your key. Ask Dad to check it.");
    });
    const res = (await client.callTool({
      name: "transcribe_audio",
      arguments: { file_path: "/r/lecture.m4a" },
    })) as ToolResult;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe("Deepgram rejected your key. Ask Dad to check it.");
  });

  it("wraps unexpected errors in the generic message with the file name", async () => {
    const client = await connect(async () => {
      throw new Error("disk on fire");
    });
    const res = (await client.callTool({
      name: "transcribe_audio",
      arguments: { file_path: "C:\\r\\lecture.m4a" },
    })) as ToolResult;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe(
      "Something went wrong transcribing lecture.m4a: disk on fire. Tell Dad if it keeps happening.",
    );
  });
});
