# Transcribe Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude Cowork plugin, distributed from a public GitHub marketplace, that transcribes a local audio file with Deepgram and saves the transcript as Markdown beside the audio.

**Architecture:** A marketplace repo holds one plugin, `transcribe`. The plugin bundles a Node stdio MCP server exposing one tool, `transcribe_audio`. The server is split into small pure modules (paths, validation, formatting, error mapping, Deepgram wrapper) orchestrated by `transcribe.ts`, with the MCP wiring in `server.ts` and the process entry in `index.ts`. A single esbuild bundle is committed so a kid's install needs only Node.

**Tech Stack:** TypeScript (ES2022, NodeNext, strict), `@modelcontextprotocol/sdk` ^1.30, `@deepgram/sdk` ^5.11 (v5 API: `client.listen.v1.media.transcribeFile`), `zod` ^3.25, `esbuild` ^0.28, `vitest` ^5, Node >= 18.

**Spec:** `docs/superpowers/specs/2026-09-14-transcribe-plugin-design.md`

## Global Constraints

- Node engine floor: `>=18.0.0`. esbuild target `node18` (Mike's Mac runs 18; kids install current LTS).
- Deepgram call options exactly: `model: "nova-3"`, `smart_format: true`, `paragraphs: true`, `detect_language: true`. No `diarize`, no `utterances`.
- API key read from `CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY`, then `DEEPGRAM_API_KEY`. The key is never logged, never written to disk, never included in an error message.
- Supported extensions, case-insensitive: `mp3, m4a, wav, aac, flac, ogg, opus, webm, mp4, mov`.
- Size limit: 2 GB = `2 * 1024 ** 3` bytes.
- Transcript file: same directory as the audio, name = audio name with extension replaced by `.transcript.md`.
- Output written UTF-8 with `\n` line endings, via temp file + rename.
- All user-facing error strings are the exact strings in the spec's error table (section 4). "Dad" is intentional.
- Path handling uses Node's `path.posix` / `path.win32`; no manual splitting on separators.
- Marketplace name `roussell-plugins`, plugin name `transcribe`, tool name `transcribe_audio`.
- Never add `---` horizontal rules to Markdown files in this repo.
- Commit after every task. Run `npm test` and `npm run typecheck` in `plugins/transcribe/server` before each commit.

## File Structure

```
roussell-plugins/
  .claude-plugin/marketplace.json
  .github/workflows/ci.yml                  typecheck, test, build, fail if dist/ is stale
  .gitignore
  README.md                                 kid setup guide
  docs/superpowers/specs/…, docs/superpowers/plans/…
  plugins/transcribe/
    .claude-plugin/plugin.json
    .mcp.json
    skills/transcribe/SKILL.md
    server/
      package.json
      tsconfig.json
      build.mjs                             esbuild bundle script
      src/errors.ts                         TranscribeError, MESSAGES, mapDeepgramError
      src/paths.ts                          resolveAudioPath, transcriptPathFor, extensionOf, displayName
      src/validate.ts                       validateAudioFile (exists, regular, extension, size)
      src/format.ts                         formatDuration, renderTranscript
      src/deepgram.ts                       readApiKey, toTranscriptionResult, createDeepgramTranscriber
      src/transcribe.ts                     transcribeAudio orchestration
      src/server.ts                         createServer (MCP tool registration)
      src/index.ts                          process entry: wire deps, connect stdio
      test/*.test.ts                        one test file per module
      dist/index.js                         committed bundle
```

### Task 1: Scaffold the marketplace, plugin manifests, and server toolchain

**Files:**
- Create: `.claude-plugin/marketplace.json`
- Create: `.gitignore`
- Create: `plugins/transcribe/.claude-plugin/plugin.json`
- Create: `plugins/transcribe/.mcp.json`
- Create: `plugins/transcribe/server/package.json`
- Create: `plugins/transcribe/server/tsconfig.json`
- Create: `plugins/transcribe/server/build.mjs`
- Create: `plugins/transcribe/server/src/index.ts` (placeholder entry, replaced in Task 8)
- Test: `plugins/transcribe/server/test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: the npm scripts every later task runs: `npm test`, `npm run typecheck`, `npm run build`

- [ ] **Step 1: Write the marketplace manifest**

`.claude-plugin/marketplace.json`:

```json
{
  "name": "roussell-plugins",
  "owner": {
    "name": "Mike Roussell"
  },
  "plugins": [
    {
      "name": "transcribe",
      "source": "./plugins/transcribe",
      "description": "Turn audio recordings into text transcripts with Deepgram",
      "version": "0.1.0"
    }
  ]
}
```

- [ ] **Step 2: Write the plugin manifest and MCP config**

`plugins/transcribe/.claude-plugin/plugin.json`:

```json
{
  "name": "transcribe",
  "version": "0.1.0",
  "description": "Turn audio recordings into text transcripts with Deepgram",
  "author": {
    "name": "Mike Roussell"
  },
  "userConfig": {
    "deepgram_api_key": {
      "type": "string",
      "title": "Deepgram API Key",
      "description": "The key Dad gave you. Paste it here once.",
      "sensitive": true,
      "required": true
    }
  }
}
```

`plugins/transcribe/.mcp.json`:

```json
{
  "mcpServers": {
    "transcribe": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/dist/index.js"]
    }
  }
}
```

- [ ] **Step 3: Write the server package files**

`plugins/transcribe/server/package.json`:

```json
{
  "name": "transcribe-mcp-server",
  "version": "0.1.0",
  "private": true,
  "description": "MCP server that transcribes local audio files with Deepgram",
  "type": "module",
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "node build.mjs",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:integration": "RUN_DEEPGRAM_INTEGRATION=1 vitest run test/deepgram.integration.test.ts"
  },
  "dependencies": {
    "@deepgram/sdk": "^5.11.0",
    "@modelcontextprotocol/sdk": "^1.30.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "esbuild": "^0.28.2",
    "typescript": "^5.5.0",
    "vitest": "^5.0.0"
  }
}
```

`plugins/transcribe/server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "noEmit": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*", "test/**/*", "build.mjs"],
  "exclude": ["node_modules", "dist"]
}
```

`plugins/transcribe/server/build.mjs`:

```js
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: "dist/index.js",
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});
```

The banner is required: bundling CommonJS dependencies into an ESM output otherwise fails at runtime with "Dynamic require is not supported".

`.gitignore` at repo root:

```
node_modules/
*.tmp-*
.DS_Store
```

Note: `dist/` is deliberately NOT ignored.

- [ ] **Step 4: Write a placeholder entry and a smoke test**

`plugins/transcribe/server/src/index.ts`:

```ts
export const PLUGIN_NAME = "transcribe";
```

`plugins/transcribe/server/test/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PLUGIN_NAME } from "../src/index.js";

describe("toolchain", () => {
  it("runs TypeScript tests", () => {
    expect(PLUGIN_NAME).toBe("transcribe");
  });
});
```

- [ ] **Step 5: Install and run everything**

Run from `plugins/transcribe/server`:

```bash
npm install
npm run typecheck
npm test
npm run build
node -e "import('./dist/index.js').then(m => console.log(m.PLUGIN_NAME))"
```

Expected: typecheck clean, 1 test passing, `dist/index.js` created, last command prints `transcribe`.

- [ ] **Step 6: Validate the plugin structure**

Run from the repo root:

```bash
claude plugin validate .
```

Expected: validation passes for the marketplace and the `transcribe` plugin. If it reports an unknown field, fix the manifest rather than the validator.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold roussell-plugins marketplace and transcribe server toolchain

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 2: Error types and Deepgram error mapping

**Files:**
- Create: `plugins/transcribe/server/src/errors.ts`
- Test: `plugins/transcribe/server/test/errors.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `class TranscribeError extends Error` (message is the kid-facing text)
  - `const MESSAGES` with functions/strings for every spec error row
  - `function mapDeepgramError(err: unknown, fileName: string): TranscribeError`

- [ ] **Step 1: Write the failing tests**

`plugins/transcribe/server/test/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MESSAGES, TranscribeError, mapDeepgramError } from "../src/errors.js";

class FakeDeepgramError extends Error {
  constructor(public statusCode: number, public body?: unknown) {
    super(`HTTP ${statusCode}`);
  }
}

describe("MESSAGES", () => {
  it("uses the exact spec wording for the missing-key case", () => {
    expect(MESSAGES.noKey).toBe(
      "No Deepgram key is set. Ask Dad for your key, then re-enable the Transcribe plugin.",
    );
  });

  it("interpolates the file name", () => {
    expect(MESSAGES.unsupported("notes.txt")).toBe(
      "notes.txt isn't a supported audio type. Try exporting it as MP3 or M4A.",
    );
  });
});

describe("mapDeepgramError", () => {
  it("maps 401 and 403 to a rejected key", () => {
    expect(mapDeepgramError(new FakeDeepgramError(401), "a.m4a").message).toBe(
      "Deepgram rejected your key. Ask Dad to check it.",
    );
    expect(mapDeepgramError(new FakeDeepgramError(403), "a.m4a").message).toBe(
      "Deepgram rejected your key. Ask Dad to check it.",
    );
  });

  it("maps 402 to out of credit", () => {
    expect(mapDeepgramError(new FakeDeepgramError(402), "a.m4a").message).toBe(
      "The Deepgram account is out of credit. Tell Dad.",
    );
  });

  it("maps 5xx to not responding", () => {
    expect(mapDeepgramError(new FakeDeepgramError(503), "a.m4a").message).toBe(
      "Deepgram isn't responding right now. Try again in a few minutes.",
    );
  });

  it("maps network failures to not responding", () => {
    const err = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    expect(mapDeepgramError(err, "a.m4a").message).toBe(
      "Deepgram isn't responding right now. Try again in a few minutes.",
    );
    const timeout = Object.assign(new Error("timed out"), { name: "DeepgramTimeoutError" });
    expect(mapDeepgramError(timeout, "a.m4a").message).toBe(
      "Deepgram isn't responding right now. Try again in a few minutes.",
    );
  });

  it("falls back to a generic message with the file name and reason", () => {
    const err = new FakeDeepgramError(400, { err_msg: "bad audio" });
    expect(mapDeepgramError(err, "a.m4a").message).toBe(
      "Something went wrong transcribing a.m4a: HTTP 400. Tell Dad if it keeps happening.",
    );
  });

  it("passes TranscribeError through untouched", () => {
    const original = new TranscribeError("custom");
    expect(mapDeepgramError(original, "a.m4a")).toBe(original);
  });

  it("never includes anything that looks like a key in the message", () => {
    const err = new FakeDeepgramError(400, { key: "dg_secret_123" });
    expect(mapDeepgramError(err, "a.m4a").message).not.toContain("dg_secret_123");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `plugins/transcribe/server`: `npx vitest run test/errors.test.ts`
Expected: FAIL, cannot find module `../src/errors.js`.

- [ ] **Step 3: Write the implementation**

`plugins/transcribe/server/src/errors.ts`:

```ts
/**
 * Every message here is shown to a kid by Claude, nearly verbatim.
 * Keep them plain, short, and actionable. "Dad" is intentional.
 */
export class TranscribeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscribeError";
  }
}

export const MESSAGES = {
  noKey:
    "No Deepgram key is set. Ask Dad for your key, then re-enable the Transcribe plugin.",
  keyRejected: "Deepgram rejected your key. Ask Dad to check it.",
  outOfCredit: "The Deepgram account is out of credit. Tell Dad.",
  notResponding: "Deepgram isn't responding right now. Try again in a few minutes.",
  notFound: (path: string) =>
    `I couldn't find a file at ${path}. Check the name and folder.`,
  isFolder: (path: string) => `${path} is a folder, not a file.`,
  unsupported: (name: string) =>
    `${name} isn't a supported audio type. Try exporting it as MP3 or M4A.`,
  tooBig: (name: string) =>
    `${name} is too big to transcribe (over 2 GB). Try splitting it or exporting a smaller version.`,
  empty: (name: string) =>
    `Deepgram didn't hear any speech in ${name}. Check that it recorded properly.`,
  generic: (name: string, reason: string) =>
    `Something went wrong transcribing ${name}: ${reason}. Tell Dad if it keeps happening.`,
} as const;

const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const TIMEOUT_NAMES = new Set(["DeepgramTimeoutError", "AbortError", "TimeoutError"]);

interface ErrorLike {
  statusCode?: unknown;
  code?: unknown;
  name?: unknown;
  message?: unknown;
}

function firstLine(text: string): string {
  return text.split(/\r?\n/, 1)[0].trim();
}

/**
 * Turn anything thrown by the Deepgram SDK (or the network under it)
 * into a TranscribeError with a kid-readable message.
 */
export function mapDeepgramError(err: unknown, fileName: string): TranscribeError {
  if (err instanceof TranscribeError) return err;

  const e = (err ?? {}) as ErrorLike;
  const status = typeof e.statusCode === "number" ? e.statusCode : undefined;
  const code = typeof e.code === "string" ? e.code : undefined;
  const name = typeof e.name === "string" ? e.name : undefined;
  const message = typeof e.message === "string" && e.message ? e.message : "unknown error";

  if (status === 401 || status === 403) return new TranscribeError(MESSAGES.keyRejected);
  if (status === 402) return new TranscribeError(MESSAGES.outOfCredit);
  if (status !== undefined && status >= 500) return new TranscribeError(MESSAGES.notResponding);
  if (code && NETWORK_CODES.has(code)) return new TranscribeError(MESSAGES.notResponding);
  if (name && TIMEOUT_NAMES.has(name)) return new TranscribeError(MESSAGES.notResponding);

  return new TranscribeError(MESSAGES.generic(fileName, firstLine(message)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/errors.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/transcribe/server/src/errors.ts plugins/transcribe/server/test/errors.test.ts
git commit -m "Add kid-facing error messages and Deepgram error mapping

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 3: Cross-platform path handling

**Files:**
- Create: `plugins/transcribe/server/src/paths.ts`
- Test: `plugins/transcribe/server/test/paths.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Platform = "posix" | "win32"`
  - `function pathImpl(platform: Platform): path.PlatformPath`
  - `function resolveAudioPath(input: string, homeDir: string, platform: Platform): string`
  - `function transcriptPathFor(audioPath: string, platform: Platform): string`
  - `function extensionOf(filePath: string, platform: Platform): string` (lowercase, no dot)
  - `function displayName(filePath: string): string` (basename, either separator)

- [ ] **Step 1: Write the failing tests**

`plugins/transcribe/server/test/paths.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/paths.test.ts`
Expected: FAIL, cannot find module `../src/paths.js`.

- [ ] **Step 3: Write the implementation**

`plugins/transcribe/server/src/paths.ts`:

```ts
import path from "node:path";

export type Platform = "posix" | "win32";

export function pathImpl(platform: Platform): path.PlatformPath {
  return platform === "win32" ? path.win32 : path.posix;
}

/**
 * Expand a leading "~" and resolve to an absolute, normalized path
 * using the separator rules of the target platform.
 */
export function resolveAudioPath(input: string, homeDir: string, platform: Platform): string {
  const p = pathImpl(platform);
  const trimmed = input.trim();
  const homeRelative =
    trimmed === "~" ? "" : trimmed.startsWith("~/") || trimmed.startsWith("~\\") ? trimmed.slice(2) : null;
  const expanded = homeRelative === null ? trimmed : p.join(homeDir, homeRelative);
  return p.resolve(expanded);
}

/** `/r/lecture.m4a` -> `/r/lecture.transcript.md`, beside the audio. */
export function transcriptPathFor(audioPath: string, platform: Platform): string {
  const p = pathImpl(platform);
  const ext = p.extname(audioPath);
  const base = p.basename(audioPath, ext);
  return p.join(p.dirname(audioPath), `${base}.transcript.md`);
}

/** Lowercase extension without the dot; "" when there is none. */
export function extensionOf(filePath: string, platform: Platform): string {
  return pathImpl(platform).extname(filePath).slice(1).toLowerCase();
}

/**
 * File name for messages. path.win32.basename understands both "/" and "\",
 * so it is safe for display on any platform.
 */
export function displayName(filePath: string): string {
  return path.win32.basename(filePath);
}
```

Note on `p.resolve` with `win32` on a Mac host: `path.win32.resolve` treats `C:\...` and `C:/...` as absolute and normalizes to backslashes without consulting the host's cwd, which is why the tests pass on macOS.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/paths.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/transcribe/server/src/paths.ts plugins/transcribe/server/test/paths.test.ts
git commit -m "Add cross-platform audio and transcript path helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 4: Audio file validation

**Files:**
- Create: `plugins/transcribe/server/src/validate.ts`
- Test: `plugins/transcribe/server/test/validate.test.ts`

**Interfaces:**
- Consumes: `TranscribeError`, `MESSAGES` from `errors.ts`; `extensionOf`, `displayName`, `Platform` from `paths.ts`
- Produces:
  - `const SUPPORTED_EXTENSIONS: readonly string[]`
  - `const MAX_BYTES: number`
  - `interface StatLike { isFile(): boolean; isDirectory(): boolean; size: number }`
  - `type StatFn = (filePath: string) => Promise<StatLike>`
  - `async function validateAudioFile(audioPath: string, platform: Platform, statFn: StatFn): Promise<{ sizeBytes: number }>`

- [ ] **Step 1: Write the failing tests**

`plugins/transcribe/server/test/validate.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/validate.test.ts`
Expected: FAIL, cannot find module `../src/validate.js`.

- [ ] **Step 3: Write the implementation**

`plugins/transcribe/server/src/validate.ts`:

```ts
import { MESSAGES, TranscribeError } from "./errors.js";
import { displayName, extensionOf, type Platform } from "./paths.js";

export const SUPPORTED_EXTENSIONS = [
  "mp3",
  "m4a",
  "wav",
  "aac",
  "flac",
  "ogg",
  "opus",
  "webm",
  "mp4",
  "mov",
] as const;

/** Deepgram's pre-recorded upload limit. */
export const MAX_BYTES = 2 * 1024 ** 3;

export interface StatLike {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
}

export type StatFn = (filePath: string) => Promise<StatLike>;

const SUPPORTED = new Set<string>(SUPPORTED_EXTENSIONS);

/**
 * Checks, in order: exists, is a regular file, supported extension, size.
 * Throws TranscribeError with the spec's kid-facing message on the first failure.
 */
export async function validateAudioFile(
  audioPath: string,
  platform: Platform,
  statFn: StatFn,
): Promise<{ sizeBytes: number }> {
  let stat: StatLike;
  try {
    stat = await statFn(audioPath);
  } catch {
    throw new TranscribeError(MESSAGES.notFound(audioPath));
  }

  if (stat.isDirectory()) throw new TranscribeError(MESSAGES.isFolder(audioPath));
  if (!stat.isFile()) throw new TranscribeError(MESSAGES.notFound(audioPath));

  const name = displayName(audioPath);
  if (!SUPPORTED.has(extensionOf(audioPath, platform))) {
    throw new TranscribeError(MESSAGES.unsupported(name));
  }
  if (stat.size > MAX_BYTES) throw new TranscribeError(MESSAGES.tooBig(name));

  return { sizeBytes: stat.size };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/validate.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/transcribe/server/src/validate.ts plugins/transcribe/server/test/validate.test.ts
git commit -m "Validate audio files before upload: existence, type, extension, size

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 5: Markdown rendering

**Files:**
- Create: `plugins/transcribe/server/src/format.ts`
- Test: `plugins/transcribe/server/test/format.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `function formatDuration(seconds: number): string`
  - `function formatLocalDate(date: Date): string` (YYYY-MM-DD, local time)
  - `function renderTranscript(opts: { audioName: string; date: Date; durationSeconds: number; paragraphs: string[] }): string`

- [ ] **Step 1: Write the failing tests**

`plugins/transcribe/server/test/format.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/format.test.ts`
Expected: FAIL, cannot find module `../src/format.js`.

- [ ] **Step 3: Write the implementation**

`plugins/transcribe/server/src/format.ts`:

```ts
export const MODEL_LABEL = "Deepgram Nova-3";

/** Whole minutes at 60 s and above, otherwise whole seconds. */
export function formatDuration(seconds: number): string {
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds)} s`;
}

/** YYYY-MM-DD in the machine's local time zone. */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface RenderOptions {
  audioName: string;
  date: Date;
  durationSeconds: number;
  paragraphs: string[];
}

/** The saved transcript file, exactly as specified in the design spec section 3. */
export function renderTranscript(opts: RenderOptions): string {
  const header = [
    `# Transcript: ${opts.audioName}`,
    "",
    `Transcribed ${formatLocalDate(opts.date)} · ${formatDuration(opts.durationSeconds)} · ${MODEL_LABEL}`,
  ];
  const body = opts.paragraphs.map((p) => p.trim()).filter((p) => p.length > 0);
  return [...header, "", ...body.flatMap((p) => [p, ""])].join("\n");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/format.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add plugins/transcribe/server/src/format.ts plugins/transcribe/server/test/format.test.ts
git commit -m "Render transcripts as Markdown with duration and date header

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 6: Deepgram wrapper

**Files:**
- Create: `plugins/transcribe/server/src/deepgram.ts`
- Test: `plugins/transcribe/server/test/deepgram.test.ts`
- Test: `plugins/transcribe/server/test/deepgram.integration.test.ts`

**Interfaces:**
- Consumes: `mapDeepgramError` from `errors.ts`
- Produces:
  - `const MODEL = "nova-3"`
  - `interface TranscriptionResult { transcript: string; paragraphs: string[]; durationSeconds: number }`
  - `type Transcriber = (audioPath: string) => Promise<TranscriptionResult>`
  - `function readApiKey(env: NodeJS.ProcessEnv): string | undefined`
  - `function toTranscriptionResult(data: unknown): TranscriptionResult`
  - `function createDeepgramTranscriber(apiKey: string): Transcriber`

- [ ] **Step 1: Write the failing unit tests**

`plugins/transcribe/server/test/deepgram.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/deepgram.test.ts`
Expected: FAIL, cannot find module `../src/deepgram.js`.

- [ ] **Step 3: Write the implementation**

`plugins/transcribe/server/src/deepgram.ts`:

```ts
import { createReadStream } from "node:fs";
import { DeepgramClient } from "@deepgram/sdk";
import { mapDeepgramError } from "./errors.js";
import { displayName } from "./paths.js";

export const MODEL = "nova-3";

export interface TranscriptionResult {
  transcript: string;
  paragraphs: string[];
  durationSeconds: number;
}

export type Transcriber = (audioPath: string) => Promise<TranscriptionResult>;

/** Plugin userConfig injects CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY; DEEPGRAM_API_KEY is the manual fallback. */
export function readApiKey(env: NodeJS.ProcessEnv): string | undefined {
  for (const name of ["CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY", "DEEPGRAM_API_KEY"]) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

interface ListenResponseLike {
  metadata?: { duration?: unknown };
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: unknown;
        paragraphs?: { paragraphs?: Array<{ sentences?: Array<{ text?: unknown }> }> };
      }>;
    }>;
  };
}

/** Pull the plain transcript, paragraph texts, and duration out of a Deepgram listen response. */
export function toTranscriptionResult(data: unknown): TranscriptionResult {
  const d = (data ?? {}) as ListenResponseLike;
  const alt = d.results?.channels?.[0]?.alternatives?.[0];
  const transcript = typeof alt?.transcript === "string" ? alt.transcript.trim() : "";
  const durationRaw = d.metadata?.duration;
  const durationSeconds = typeof durationRaw === "number" && Number.isFinite(durationRaw) ? durationRaw : 0;

  const fromParagraphs = (alt?.paragraphs?.paragraphs ?? [])
    .map((p) =>
      (p.sentences ?? [])
        .map((s) => (typeof s.text === "string" ? s.text.trim() : ""))
        .filter((t) => t.length > 0)
        .join(" "),
    )
    .filter((t) => t.length > 0);

  const paragraphs = fromParagraphs.length > 0 ? fromParagraphs : transcript ? [transcript] : [];
  return { transcript, paragraphs, durationSeconds };
}

/**
 * Real Deepgram call. Streams the file so large recordings are never fully buffered.
 * Options are fixed by the spec: nova-3, smart_format, paragraphs, detect_language.
 */
export function createDeepgramTranscriber(apiKey: string): Transcriber {
  const client = new DeepgramClient({ apiKey });
  return async (audioPath) => {
    try {
      const data = await client.listen.v1.media.transcribeFile(createReadStream(audioPath), {
        model: MODEL,
        smart_format: true,
        paragraphs: true,
        detect_language: true,
        timeoutInSeconds: 900,
        maxRetries: 1,
      });
      return toTranscriptionResult(data);
    } catch (err) {
      throw mapDeepgramError(err, displayName(audioPath));
    }
  };
}
```

If `tsc` rejects `timeoutInSeconds` / `maxRetries` inside the options object for this SDK version, move them to a third argument `{ timeoutInSeconds: 900, maxRetries: 1 }` per the SDK's request-options signature, and keep the four transcription options where they are. Check `node_modules/@deepgram/sdk/api/resources/listen/resources/v1/resources/media/client/Client.d.ts` for the exact signature rather than guessing.

- [ ] **Step 4: Run the unit tests and typecheck**

Run: `npx vitest run test/deepgram.test.ts && npm run typecheck`
Expected: PASS, 8 tests; typecheck clean.

- [ ] **Step 5: Write the gated integration test**

`plugins/transcribe/server/test/deepgram.integration.test.ts`:

```ts
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
```

- [ ] **Step 6: Run the integration test for real**

Mike supplies a key for this step only (a key from his Deepgram project, exported in the shell, never written to a file):

```bash
DEEPGRAM_API_KEY=<key> npm run test:integration
```

Expected: PASS, the real clip transcribes. Then run plain `npm test` and confirm the integration test shows as skipped, not failed.

- [ ] **Step 7: Commit**

```bash
git add plugins/transcribe/server/src/deepgram.ts plugins/transcribe/server/test/deepgram.test.ts plugins/transcribe/server/test/deepgram.integration.test.ts
git commit -m "Wrap Deepgram v5 prerecorded transcription with key lookup and result extraction

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 7: Orchestration with short-circuit and atomic write

**Files:**
- Create: `plugins/transcribe/server/src/transcribe.ts`
- Test: `plugins/transcribe/server/test/transcribe.test.ts`

**Interfaces:**
- Consumes: `TranscribeError`, `MESSAGES` (errors.ts); `resolveAudioPath`, `transcriptPathFor`, `displayName`, `Platform` (paths.ts); `validateAudioFile` (validate.ts); `renderTranscript` (format.ts); `Transcriber`, `MODEL` (deepgram.ts)
- Produces:
  - `interface TranscribeInput { file_path: string; overwrite: boolean }`
  - `interface TranscribeOutput { transcript_path: string; audio_path: string; duration_seconds: number | null; model: string; already_existed: boolean; markdown: string }`
  - `interface TranscribeDeps { transcriber: Transcriber; now: () => Date; homeDir: string; platform: Platform }`
  - `async function transcribeAudio(input: TranscribeInput, deps: TranscribeDeps): Promise<TranscribeOutput>` (throws `TranscribeError`)

- [ ] **Step 1: Write the failing tests**

`plugins/transcribe/server/test/transcribe.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/transcribe.test.ts`
Expected: FAIL, cannot find module `../src/transcribe.js`.

- [ ] **Step 3: Write the implementation**

`plugins/transcribe/server/src/transcribe.ts`:

```ts
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { MODEL, type Transcriber } from "./deepgram.js";
import { MESSAGES, TranscribeError } from "./errors.js";
import { renderTranscript } from "./format.js";
import { displayName, resolveAudioPath, transcriptPathFor, type Platform } from "./paths.js";
import { validateAudioFile } from "./validate.js";

export interface TranscribeInput {
  file_path: string;
  overwrite: boolean;
}

export interface TranscribeOutput {
  transcript_path: string;
  audio_path: string;
  /** null when an existing transcript was returned without re-transcribing */
  duration_seconds: number | null;
  model: string;
  already_existed: boolean;
  markdown: string;
}

export interface TranscribeDeps {
  transcriber: Transcriber;
  now: () => Date;
  homeDir: string;
  platform: Platform;
}

async function readExisting(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/** Write via a sibling temp file and rename, so a crash never leaves a half-written transcript. */
async function writeAtomic(filePath: string, contents: string): Promise<void> {
  const tmp = `${filePath}.tmp-${process.pid}`;
  try {
    await writeFile(tmp, contents, "utf8");
    await rename(tmp, filePath);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

/**
 * The spec's section 3 behavior, in order:
 * resolve -> validate -> short-circuit on existing transcript -> transcribe -> render -> atomic write.
 */
export async function transcribeAudio(input: TranscribeInput, deps: TranscribeDeps): Promise<TranscribeOutput> {
  const audioPath = resolveAudioPath(input.file_path, deps.homeDir, deps.platform);
  await validateAudioFile(audioPath, deps.platform, stat);

  const transcriptPath = transcriptPathFor(audioPath, deps.platform);
  const name = displayName(audioPath);

  if (!input.overwrite) {
    const existing = await readExisting(transcriptPath);
    if (existing !== null) {
      return {
        transcript_path: transcriptPath,
        audio_path: audioPath,
        duration_seconds: null,
        model: MODEL,
        already_existed: true,
        markdown: existing,
      };
    }
  }

  const result = await deps.transcriber(audioPath);
  if (result.paragraphs.length === 0) throw new TranscribeError(MESSAGES.empty(name));

  const markdown = renderTranscript({
    audioName: name,
    date: deps.now(),
    durationSeconds: result.durationSeconds,
    paragraphs: result.paragraphs,
  });
  await writeAtomic(transcriptPath, markdown);

  return {
    transcript_path: transcriptPath,
    audio_path: audioPath,
    duration_seconds: result.durationSeconds,
    model: MODEL,
    already_existed: false,
    markdown,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/transcribe.test.ts && npm run typecheck`
Expected: PASS, 8 tests; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add plugins/transcribe/server/src/transcribe.ts plugins/transcribe/server/test/transcribe.test.ts
git commit -m "Orchestrate transcription with existing-transcript short circuit and atomic write

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 8: MCP server, entry point, and bundle

**Files:**
- Create: `plugins/transcribe/server/src/server.ts`
- Modify: `plugins/transcribe/server/src/index.ts` (replace the Task 1 placeholder entirely)
- Delete: `plugins/transcribe/server/test/smoke.test.ts`
- Test: `plugins/transcribe/server/test/server.test.ts`
- Create: `plugins/transcribe/server/dist/index.js` (build output, committed)

**Interfaces:**
- Consumes: `TranscribeInput`, `TranscribeOutput`, `transcribeAudio`, `TranscribeDeps` (transcribe.ts); `TranscribeError`, `MESSAGES` (errors.ts); `formatDuration` (format.ts); `displayName` (paths.ts); `readApiKey`, `createDeepgramTranscriber` (deepgram.ts)
- Produces:
  - `type TranscribeFn = (input: TranscribeInput) => Promise<TranscribeOutput>`
  - `function createServer(deps: { transcribe: TranscribeFn }): McpServer`
  - MCP tool `transcribe_audio` with input `{ file_path: string; overwrite?: boolean }` and structured output `{ transcript_path, audio_path, duration_seconds, model, already_existed }`

- [ ] **Step 1: Write the failing tests**

`plugins/transcribe/server/test/server.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/server.test.ts`
Expected: FAIL, cannot find module `../src/server.js`.

- [ ] **Step 3: Write the server module**

`plugins/transcribe/server/src/server.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MESSAGES, TranscribeError } from "./errors.js";
import { MODEL_LABEL, formatDuration } from "./format.js";
import { displayName } from "./paths.js";
import type { TranscribeInput, TranscribeOutput } from "./transcribe.js";

export type TranscribeFn = (input: TranscribeInput) => Promise<TranscribeOutput>;

export interface ServerDeps {
  transcribe: TranscribeFn;
}

const inputSchema = {
  file_path: z
    .string()
    .min(1)
    .describe("Path to the audio or video file to transcribe. Absolute, or starting with ~ for the home folder."),
  overwrite: z
    .boolean()
    .optional()
    .describe("Re-transcribe even if a transcript file already exists beside the audio. Default false."),
};

const outputSchema = {
  transcript_path: z.string(),
  audio_path: z.string(),
  duration_seconds: z.number().nullable(),
  model: z.string(),
  already_existed: z.boolean(),
};

const DESCRIPTION = `Transcribe a local audio or video recording to text with Deepgram and save the transcript as a Markdown file beside the recording.

Use this when the user mentions a recording, voice memo, lecture, interview, or audio file they want turned into text, notes, or a summary.

Supported types: mp3, m4a, wav, aac, flac, ogg, opus, webm, mp4, mov. Files up to 2 GB.

If a transcript already exists beside the audio it is returned without re-transcribing (pass overwrite: true to redo it).

Returns a line saying where the transcript was saved, followed by the full transcript. Do not paste the whole transcript back to the user; tell them where it was saved and then do what they asked (notes, summary, answer a question).`;

function successText(out: TranscribeOutput): string {
  const name = displayName(out.audio_path);
  const head = out.already_existed
    ? `A transcript for ${name} already existed at ${out.transcript_path}, so I returned it without re-transcribing. Pass overwrite: true to redo it.`
    : `Saved transcript to ${out.transcript_path} (${formatDuration(out.duration_seconds ?? 0)}, ${MODEL_LABEL}).`;
  return `${head}\n\n${out.markdown}`;
}

function errorText(err: unknown, filePath: string): string {
  if (err instanceof TranscribeError) return err.message;
  const reason = err instanceof Error && err.message ? err.message : "unknown error";
  return MESSAGES.generic(displayName(filePath), reason);
}

export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({ name: "transcribe", version: "0.1.0" });

  server.registerTool(
    "transcribe_audio",
    {
      title: "Transcribe Audio",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ file_path, overwrite }) => {
      try {
        const out = await deps.transcribe({ file_path, overwrite: overwrite ?? false });
        return {
          content: [{ type: "text" as const, text: successText(out) }],
          structuredContent: {
            transcript_path: out.transcript_path,
            audio_path: out.audio_path,
            duration_seconds: out.duration_seconds,
            model: out.model,
            already_existed: out.already_existed,
          },
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: errorText(err, file_path) }],
        };
      }
    },
  );

  return server;
}
```

- [ ] **Step 4: Replace the entry point**

`plugins/transcribe/server/src/index.ts` (full replacement):

```ts
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
```

Delete `plugins/transcribe/server/test/smoke.test.ts` (it imported the placeholder export).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass (errors 8, paths 11, validate 7, format 5, deepgram 8, transcribe 8, server 5; integration skipped), typecheck clean.

- [ ] **Step 6: Build the bundle and smoke-run it over stdio**

```bash
npm run build
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | node dist/index.js 2>/dev/null
```

Expected: two JSON-RPC responses on stdout; the second lists exactly one tool named `transcribe_audio`. Then confirm the missing-key path end to end:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"transcribe_audio","arguments":{"file_path":"/tmp/nothing.m4a"}}}\n' | env -u DEEPGRAM_API_KEY -u CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY node dist/index.js 2>/dev/null
```

Expected: the tools/call response has `isError: true` and the text "No Deepgram key is set. Ask Dad for your key, then re-enable the Transcribe plugin."

- [ ] **Step 7: Commit including the bundle**

```bash
git add -A plugins/transcribe/server
git commit -m "Expose transcribe_audio over MCP stdio and commit the esbuild bundle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 9: Skill, kid README, CI, GitHub, and the acceptance checklist

**Files:**
- Create: `plugins/transcribe/skills/transcribe/SKILL.md`
- Create: `README.md`
- Create: `.github/workflows/ci.yml`
- Create: `docs/acceptance-checklist.md`

**Interfaces:**
- Consumes: the `transcribe_audio` tool contract from Task 8
- Produces: an installable, documented plugin on GitHub

- [ ] **Step 1: Write the skill**

`plugins/transcribe/skills/transcribe/SKILL.md`:

```markdown
---
name: transcribe
description: Turn an audio or video recording (voice memo, lecture, interview, MP3/M4A/WAV file) into a text transcript saved beside the file, then summarize it, make study notes, or answer questions about it. Use whenever the user mentions a recording or audio file.
---

# Transcribe a recording

## When to use

The user mentions a recording, voice memo, lecture, interview, podcast file, or any audio/video file and wants text, notes, a summary, or answers from it.

## How

1. Find the file path. If the user gave a name but not a folder, look in the folders you can see (Recordings, Documents, Downloads, Desktop) before asking.
2. Call the `transcribe_audio` tool with `file_path`. Leave `overwrite` unset unless the user explicitly asks to redo a transcript.
3. The tool returns one line saying where the transcript was saved, then the full transcript.

## After it returns

- Say in one short sentence where the transcript was saved.
- Do not paste the whole transcript into the chat. It is already in the file.
- Then do what the user actually asked: study notes, a summary, key points, or an answer to their question, using the transcript text you received.
- If the tool says a transcript already existed, mention that briefly and continue with the saved text.

## If it fails

The tool's error text is written for the user. Relay it as is, in one or two sentences, without technical detail. Do not retry automatically more than once.
```

- [ ] **Step 2: Write the kid-facing README**

`README.md`:

```markdown
# Roussell family Claude plugins

Plugins for the Claude app that Dad built for the family.

## Transcribe

Turns a recording (a voice memo, a recorded class, an MP3 or M4A file) into text you can search, study from, or ask Claude about. The transcript is saved next to the recording as a `.transcript.md` file.

### Set it up once

You need three things: Node, the plugin, and your key from Dad.

**1. Install Node**

Go to https://nodejs.org and download the LTS version.

- Mac: open the `.pkg` and click through with the defaults.
- Windows: open the `.msi` and click through with the defaults. Leave "Add to PATH" checked.

**2. Add the plugin in Claude**

In the Claude app, open Plugins, choose Add marketplace, and enter:

    mikeroussell/roussell-plugins

Then install **Transcribe** from the list.

**3. Paste your key**

When you enable Transcribe, it asks for a Deepgram API Key. Paste the key Dad gave you. You only do this once.

If you don't get asked for a key, tell Dad. He'll help you put it in a settings file instead.

### Use it

Put your recordings somewhere Claude can see, like a `Recordings` folder in Documents. Then just ask:

- "Transcribe the lecture I recorded today."
- "Make study notes from bio-lecture-3.m4a."
- "What did the teacher say about the essay deadline in this recording?"

Claude transcribes the file, saves the transcript beside it, and then does what you asked. A typical class recording takes about a minute.

If you ask about the same recording again later, Claude uses the saved transcript instead of transcribing it again.

### Supported files

mp3, m4a, wav, aac, flac, ogg, opus, webm, mp4, mov. Up to 2 GB.

### Something went wrong?

Claude will tell you what happened in plain words. If it says to tell Dad, tell Dad.

## For Dad

- Create one Deepgram API key per kid in the Deepgram console, named after the kid. Usage in the console is broken out per key. Revoke a key to cut one kid off without affecting the others.
- Fallback if the key prompt doesn't appear: set `DEEPGRAM_API_KEY` in the kid's Claude settings file `env` block, then restart the app.
- Development lives in `plugins/transcribe/server`. Run `npm test`, `npm run typecheck`, and `npm run build` before committing. The `dist/` bundle is committed on purpose; CI fails if it is stale.
- Local install for testing: `claude plugin marketplace add /path/to/roussell-plugins` then `claude plugin install transcribe@roussell-plugins`.
```

- [ ] **Step 3: Write the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  server:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: plugins/transcribe/server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: plugins/transcribe/server/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: Fail if the committed bundle is stale
        run: git diff --exit-code -- dist/
```

- [ ] **Step 4: Write the acceptance checklist**

`docs/acceptance-checklist.md`:

```markdown
# Transcribe plugin acceptance checklist

Run these in order. Each one answers a question the spec left open.

## 1. Claude Code on Mike's Mac, local marketplace

    claude plugin marketplace add /Users/mikeroussell/Documents/development/apps/roussell-plugins
    claude plugin install transcribe@roussell-plugins

- [ ] Enabling the plugin prompts for the Deepgram API Key (userConfig works in Claude Code)
- [ ] "Transcribe ~/Recordings/test.m4a" produces `test.transcript.md` beside the file
- [ ] Asking again does not add usage in the Deepgram console
- [ ] Renaming the transcript file and asking again re-transcribes

## 2. Cowork on Mike's Mac, GitHub marketplace

- [ ] Marketplace `mikeroussell/roussell-plugins` can be added from the Cowork plugins UI
- [ ] Transcribe installs and the key prompt appears (userConfig works in Cowork)
- [ ] The Node server launches (Cowork finds `node` on PATH)
- [ ] A real voice memo transcribes and Claude summarizes it without dumping the transcript

If the key prompt does not appear: document the settings-file `env` fallback in the README's "For Dad" section with the exact file path Cowork uses, and re-test.
If `node` is not found: change `.mcp.json` `command` to an absolute path per platform and re-test.

## 3. Windows kid's PC, GitHub marketplace

- [ ] Node LTS installs with defaults and `node --version` works in a new terminal
- [ ] Marketplace add + Transcribe install + key prompt all work in Cowork for Windows
- [ ] A file with a `C:\Users\...` path and an uppercase `.MP3` extension transcribes
- [ ] The transcript lands beside the audio with a Windows path

## 4. Kid-language errors

- [ ] Remove the key, ask to transcribe: Claude relays the "Ask Dad for your key" message
- [ ] Ask to transcribe a `.txt` file: Claude relays the "isn't a supported audio type" message
- [ ] Ask to transcribe a file that doesn't exist: Claude relays the "couldn't find a file" message
```

- [ ] **Step 5: Validate, create the GitHub repo, and push**

From the repo root:

```bash
claude plugin validate .
git add -A
git commit -m "Add transcribe skill, kid setup README, CI, and acceptance checklist

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git branch -M main
gh repo create mikeroussell/roussell-plugins --public --source=. --remote=origin --push
```

Expected: validation passes; the repo appears at https://github.com/mikeroussell/roussell-plugins with CI running on the first push. Confirm CI is green before handing the checklist to Mike.

- [ ] **Step 6: Hand off**

Report to Mike: the repo URL, the CI status, and the acceptance checklist path. Steps 1 and 2 of the checklist are his to run (they need his Deepgram key and Cowork); step 3 needs the Windows PC.

## Self-review notes

- Spec coverage: section 2 layout → Tasks 1, 8, 9; section 3 tool behavior → Tasks 3, 4, 6, 7, 8; section 3 file format → Task 5; section 4 errors → Tasks 2, 4, 7, 8 and checklist step 4; section 5 distribution → Tasks 1 and 9; section 6 tests → every task plus checklist; section 7 risks → checklist steps 2 and 3 with fallbacks written into the README.
- Type consistency: `Platform`, `Transcriber`, `TranscriptionResult`, `TranscribeInput`, `TranscribeOutput`, `TranscribeDeps`, `TranscribeFn`, `StatFn`, `MESSAGES` keys and `MODEL` / `MODEL_LABEL` are used with the same names and shapes across Tasks 2 through 8.
- Deviation from spec, recorded: esbuild target is `node18` not `node20`, because the first acceptance test runs on Mike's Node 18 Mac. `duration_seconds` is nullable in the structured output because the short-circuit path has no duration.
