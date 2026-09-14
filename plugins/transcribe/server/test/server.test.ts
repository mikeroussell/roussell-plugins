import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { TranscribeError } from "../src/errors.js";
import { createServer, type StoreKeyFn, type TranscribeFn } from "../src/server.js";

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
}

const storeKeyUnused: StoreKeyFn = async () => {
  throw new Error("storeKey should not be called in this test");
};

async function connect(transcribe: TranscribeFn, storeKey: StoreKeyFn = storeKeyUnused) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ transcribe, storeKey });
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
  it("is listed alongside set_deepgram_key and documents its inputs", async () => {
    const client = await connect(async () => output);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["set_deepgram_key", "transcribe_audio"]);
    const transcribe = tools.find((t) => t.name === "transcribe_audio")!;
    const schema = transcribe.inputSchema as { properties: Record<string, unknown>; required?: string[] };
    expect(Object.keys(schema.properties).sort()).toEqual(["file_path", "overwrite"]);
    expect(schema.required).toEqual(["file_path"]);
    expect(transcribe.annotations?.idempotentHint).toBe(false);
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

describe("set_deepgram_key tool", () => {
  it("saves the key through the store and confirms without echoing it", async () => {
    let stored: string | undefined;
    const client = await connect(
      async () => output,
      async (key) => {
        stored = key;
        return "/Users/kid/.transcribe/deepgram-key";
      },
    );

    const res = (await client.callTool({
      name: "set_deepgram_key",
      arguments: { api_key: "dg_secret_123" },
    })) as ToolResult;

    expect(stored).toBe("dg_secret_123");
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toBe(
      "Saved your Deepgram key to /Users/kid/.transcribe/deepgram-key. You're all set. Ask me to transcribe a recording.",
    );
    expect(res.content[0].text).not.toContain("dg_secret_123");
    expect(res.structuredContent).toEqual({ saved_to: "/Users/kid/.transcribe/deepgram-key" });
  });

  it("relays a TranscribeError from the store as a tool error", async () => {
    const client = await connect(
      async () => output,
      async () => {
        throw new TranscribeError("That doesn't look like a Deepgram key. Ask Dad to send it again.");
      },
    );
    const res = (await client.callTool({ name: "set_deepgram_key", arguments: { api_key: "   " } })) as ToolResult;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe("That doesn't look like a Deepgram key. Ask Dad to send it again.");
  });

  it("wraps an unexpected store failure without leaking the key", async () => {
    const client = await connect(
      async () => output,
      async () => {
        throw new Error("EACCES: permission denied");
      },
    );
    const res = (await client.callTool({ name: "set_deepgram_key", arguments: { api_key: "dg_secret_123" } })) as ToolResult;
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe(
      "I couldn't save your key: EACCES: permission denied. Tell Dad if it keeps happening.",
    );
    expect(res.content[0].text).not.toContain("dg_secret_123");
  });
});
