# Transcribe Plugin: Design Spec

Date: 2026-09-14
Status: Implemented 2026-09-14; amended same day for Cowork key handling (see section 2)
Repo: `roussell-plugins` (personal GitHub account, public), local checkout `apps/roussell-plugins`

## 1. Purpose

A Claude Cowork plugin that lets Mike's kids turn audio recordings they already have (voice memos, recorded lectures, downloaded MP3/M4A files) into text transcripts using Deepgram, then use Claude to summarize, make study notes, or answer questions about the recording.

Each kid runs Cowork on their own machine (Mac or Windows) under their own Claude account, and uses their own Deepgram API key that Mike creates for them in his Deepgram project.

### Success criteria

1. A kid completes setup in about ten minutes with Mike nearby: install Node, add the marketplace, install the plugin, paste one key.
2. Everyday use is a plain request in Cowork ("transcribe the lecture I recorded today"). No commands, no terminals, nothing to keep running.
3. The transcript is saved as a Markdown file beside the audio, so it survives the chat.
4. Asking about the same recording again does not re-bill Deepgram.
5. Every failure comes back in plain language a teenager can act on.
6. Mike can see usage per kid in the Deepgram console and revoke one kid's key without affecting the others.

### Out of scope (YAGNI)

- Live microphone recording or streaming transcription
- Fetching audio from URLs (YouTube, podcasts, Drive links)
- Speaker labels (diarization) and timestamps in the saved file
- Summaries generated inside the tool (Claude does that in the conversation)
- Any hosted service; everything runs on the kid's machine

## 2. Architecture

```
roussell-plugins/                          public GitHub repo = family plugin marketplace
  .claude-plugin/marketplace.json          lists plugins/transcribe
  README.md                                kid-facing setup guide (Mac + Windows)
  docs/superpowers/specs/                  this spec and future ones
  plugins/transcribe/
    .claude-plugin/plugin.json             name, version, description, userConfig
    .mcp.json                              stdio server: node ${CLAUDE_PLUGIN_ROOT}/server/dist/index.js
    skills/transcribe/SKILL.md             when to use the tool, how to present results
    server/
      package.json                         @modelcontextprotocol/sdk, @deepgram/sdk v5, zod; esbuild, vitest, typescript (dev)
      tsconfig.json                        ES2022, NodeNext, strict (matches apps/nano-banana-mcp)
      src/index.ts                         MCP server bootstrap, registers the one tool
      src/transcribe.ts                    orchestration: validate → short-circuit → Deepgram → write → return
      src/paths.ts                         cross-platform path handling (posix + win32)
      src/format.ts                        Markdown rendering of the transcript
      src/errors.ts                        maps failures to kid-readable messages
      src/deepgram.ts                      thin wrapper around the SDK call (mockable seam)
      test/                                vitest unit tests + one gated integration test
      dist/index.js                        single-file esbuild bundle, COMMITTED, so install needs no npm
```

### Components and their contracts

**marketplace.json** declares the marketplace name `roussell-plugins` and one plugin entry pointing at `./plugins/transcribe`. Adding a future family plugin means adding one entry.

**plugin.json** declares:

```json
{
  "name": "transcribe",
  "version": "0.1.0",
  "description": "Turn audio recordings into text transcripts with Deepgram",
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

Cowork/Claude Code injects the value as the environment variable `CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY` when launching the plugin's MCP server.

**.mcp.json** launches the bundled server:

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

No shell wrapper, so it behaves the same on macOS and Windows. Node must be on PATH; the nodejs.org installers do that by default on both platforms.

**SKILL.md** tells Claude: when the user mentions a recording, voice memo, lecture, interview, or audio file, call `transcribe_audio` with the file's path. After it returns, do not paste the full transcript into chat. Say where it was saved, then do what the user asked (notes, summary, answer a question). If the tool reports a transcript already existed, say so briefly and continue.

**MCP server** exposes two tools: `transcribe_audio` and `set_deepgram_key`. The key is resolved per call: first `~/.transcribe/deepgram-key` (written by `set_deepgram_key` with user-only permissions when the kid pastes their key in chat), then `CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY`, then `DEEPGRAM_API_KEY`. The server never logs the key or echoes it in any message.

Amendment 2026-09-14 (after the first Cowork install): Cowork installs plugins through claude.ai sync and launches the bundled server with the user's home directory, login-shell PATH, and `CLAUDE_PLUGIN_ROOT`, but does not show the `userConfig` prompt or inject `CLAUDE_PLUGIN_OPTION_*`. The paste-in-chat tool is therefore the primary key path for the kids; the env variables remain as fallbacks. Trade-off accepted: the key passes through one chat message.

## 3. The tool: `transcribe_audio`

### Input

| Field | Type | Required | Notes |
|---|---|---|---|
| `file_path` | string | yes | Absolute or `~`-relative path to an audio or video file |
| `overwrite` | boolean | no, default `false` | Re-transcribe even if a transcript file already exists |

### Behavior, in order

1. **Resolve the path.** Expand a leading `~` to the home directory. Accept both `/Users/kid/Recordings/a.m4a` and `C:\Users\kid\Recordings\a.m4a` and forward-slash Windows forms. Use Node's `path` module throughout; no manual string splitting on separators.
2. **Validate the file.** It must exist and be a regular file. Its extension, compared case-insensitively, must be one of: `mp3, m4a, wav, aac, flac, ogg, opus, webm, mp4, mov`. Files over 2 GB (Deepgram's pre-recorded limit) are rejected before any upload.
3. **Short-circuit on an existing transcript.** The output path is the audio path with its extension replaced by `.transcript.md` (so `lecture.m4a` → `lecture.transcript.md`, beside the audio). If that file exists and `overwrite` is false, return its contents with `already_existed: true` and do not call Deepgram.
4. **Transcribe.** Stream the file to Deepgram with the v5 SDK:
   ```ts
   const client = new DeepgramClient({ apiKey });
   const data = await client.listen.v1.media.transcribeFile(createReadStream(path), {
     model: "nova-3",
     smart_format: true,
     paragraphs: true,
     detect_language: true,
   });
   ```
   No diarization, no utterances.
5. **Render Markdown.** Paragraph text comes from `results.channels[0].alternatives[0].paragraphs.paragraphs[].sentences[].text`, joined per paragraph. If the paragraphs block is absent (very short clips), fall back to `alternatives[0].transcript` as a single paragraph. Duration comes from `metadata.duration` (seconds). An empty transcript (silent file) is reported as an error, not written.
6. **Write the file** with UTF-8 and `\n` line endings. Write to a temp file in the same directory and rename, so a crash never leaves a half-written transcript.
7. **Return** to Claude.

### Output (tool result)

Text content:

```
Saved transcript to /Users/kid/Recordings/bio-lecture-3.transcript.md (41 min, Deepgram Nova-3).

<full Markdown transcript>
```

Structured content alongside it: `{ transcript_path, audio_path, duration_seconds, model, already_existed }`.

### Saved file format

```
# Transcript: bio-lecture-3.m4a

Transcribed 2026-09-14 · 41 min · Deepgram Nova-3

First paragraph of the recording...

Second paragraph...
```

Duration is rounded to whole minutes when 60 s or more, otherwise shown in seconds. The date is the local date on the kid's machine.

## 4. Error handling

All failures return an MCP tool error (`isError: true`) whose text is written for the kid, not a developer. Claude relays them nearly verbatim.

| Condition | Message |
|---|---|
| No key stored or in either env var | "No Deepgram key is set. Ask Dad for your key, then paste it here and I'll save it." |
| Pasted key blank or contains spaces (`set_deepgram_key`) | "That doesn't look like a Deepgram key. Ask Dad to send it again." |
| Key file could not be written | "I couldn't save your key: <one-line reason>. Tell Dad if it keeps happening." |
| Deepgram 401 / 403 | "Deepgram rejected your key. Ask Dad to check it." |
| Deepgram 402 or insufficient-credits response | "The Deepgram account is out of credit. Tell Dad." |
| File not found | "I couldn't find a file at <path>. Check the name and folder." |
| Not a regular file | "<path> is a folder, not a file." |
| Unsupported extension | "<name> isn't a supported audio type. Try exporting it as MP3 or M4A." |
| Over 2 GB | "<name> is too big to transcribe (over 2 GB). Try splitting it or exporting a smaller version." |
| Empty transcript | "Deepgram didn't hear any speech in <name>. Check that it recorded properly." |
| Network error / timeout / 5xx | "Deepgram isn't responding right now. Try again in a few minutes." |
| Anything else | "Something went wrong transcribing <name>: <one-line reason>. Tell Dad if it keeps happening." |

The Deepgram SDK error object's status code drives the mapping; the raw error body is never shown to the kid and never logged with the key present.

### Key management (Mike's side)

- One Deepgram API key per kid, created in Mike's Deepgram project and named after the kid, so the console shows usage per key.
- Mike's prepaid balance is the ceiling on total spend.
- To cut a kid off or rotate: delete that key in the console, create a new one, kid re-enters it in Cowork. Others unaffected.

## 5. Distribution and setup

The repo is public because the kids' machines have no GitHub credentials and a public marketplace needs none. The repo contains no secrets.

`dist/index.js` is committed. `npm run build` runs esbuild with `--bundle --platform=node --format=esm --target=node20` into a single file, so a fresh install needs Node and nothing else. A CI check (GitHub Actions) fails the build if `dist/` is stale relative to `src/`.

Kid setup (README, one section per platform):

1. Install Node LTS from nodejs.org (Mac `.pkg` or Windows `.msi`, defaults).
2. In Cowork, open plugins, add marketplace `mikeroussell/roussell-plugins`.
3. Install "Transcribe". When prompted, paste the key Dad gave you.
4. Put recordings in a folder Cowork can see (for example `Documents/Recordings`) and ask Claude to transcribe one.

## 6. Testing

Unit tests (vitest), Deepgram wrapper mocked:

- Path resolution: `~` expansion, posix and win32 inputs, mixed separators, output path derivation on both platforms (using `path.posix` and `path.win32` explicitly so both are exercised on any host)
- Extension validation, case-insensitive, allowed and rejected cases
- Size guard at the 2 GB boundary
- Short-circuit: existing transcript returned without a Deepgram call; `overwrite: true` bypasses it
- Markdown rendering: paragraphs, single-paragraph fallback, duration formatting (seconds vs. minutes), header line
- Empty transcript becomes an error
- Each row of the error table maps from the corresponding SDK error shape
- Atomic write: temp file then rename; no partial file on a thrown write

Integration test, skipped unless `DEEPGRAM_API_KEY` is set: transcribes a bundled 5-second WAV clip against real Deepgram and asserts a non-empty transcript and a written file.

Manual acceptance checklist:

1. Install from the local repo path in Claude Code on Mike's Mac; transcribe a real voice memo.
2. Install in Cowork on Mike's Mac from the GitHub marketplace. Confirm the `userConfig` key prompt appears and the Node server launches. If either fails, switch the README to the settings-file env var fallback and re-test.
3. Install on the Windows kid's PC from GitHub; transcribe a file with a `C:\...` path and a `.MP3` extension.
4. Ask about the same recording a second time; confirm no new Deepgram usage appears in the console.

## 7. Open risks

- **Cowork feature parity is undocumented** for custom marketplaces, `userConfig` prompts, and local stdio MCP servers. Manual checklist step 2 resolves this before any kid installs. Fallback is documented in section 2.
- **Node on PATH inside Cowork.** If Cowork does not inherit the user's PATH, `.mcp.json` may need an absolute Node path per platform. Same checklist step catches it.
- **Long recordings.** Deepgram pre-recorded handles multi-hour files, but the upload runs over the kid's connection; a 2-hour lecture is ~100 MB as M4A and takes a minute or two. Acceptable; no chunking planned.
