/**
 * Transcribe MCP server: process entry.
 *
 * Reads the Deepgram key lazily per call: a key the kid pasted in chat (saved by the
 * set_deepgram_key tool to ~/.transcribe/deepgram-key) wins, then the plugin userConfig
 * variable CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY, then DEEPGRAM_API_KEY. The server still
 * starts without a key so the kid gets a readable message instead of a dead plugin.
 */
import { homedir } from "node:os";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDeepgramTranscriber } from "./deepgram.js";
import { MESSAGES, TranscribeError } from "./errors.js";
import { resolveApiKey, storeKey } from "./keystore.js";
import { createServer } from "./server.js";
import { transcribeAudio } from "./transcribe.js";

const platform = process.platform === "win32" ? "win32" : "posix";

const server = createServer({
  transcribe: async (input) => {
    const apiKey = await resolveApiKey(process.env, homedir());
    if (!apiKey) throw new TranscribeError(MESSAGES.noKey);
    return transcribeAudio(input, {
      transcriber: createDeepgramTranscriber(apiKey),
      now: () => new Date(),
      homeDir: homedir(),
      platform,
    });
  },
  storeKey: (apiKey) => storeKey(homedir(), apiKey),
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Transcribe MCP server running on stdio");
