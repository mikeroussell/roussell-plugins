/**
 * Transcribe MCP server: process entry.
 *
 * Reads the Deepgram key from CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY (plugin userConfig)
 * or DEEPGRAM_API_KEY, lazily per call, so the server still starts without a key and the
 * kid gets a readable message instead of a dead plugin.
 */
import { homedir } from "node:os";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDeepgramTranscriber, readApiKey } from "./deepgram.js";
import { MESSAGES, TranscribeError } from "./errors.js";
import { createServer } from "./server.js";
import { transcribeAudio } from "./transcribe.js";

const platform = process.platform === "win32" ? "win32" : "posix";

const server = createServer({
  transcribe: async (input) => {
    const apiKey = readApiKey(process.env);
    if (!apiKey) throw new TranscribeError(MESSAGES.noKey);
    return transcribeAudio(input, {
      transcriber: createDeepgramTranscriber(apiKey),
      now: () => new Date(),
      homeDir: homedir(),
      platform,
    });
  },
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Transcribe MCP server running on stdio");
