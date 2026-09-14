# Roussell family Claude plugins

Plugins for the Claude app that Dad built for the family.

## Transcribe

Turns a recording (a voice memo, a recorded class, an MP3 or M4A file) into text you can search, study from, or ask Claude about. The transcript is saved next to the recording as a `.transcript.md` file.

### Set it up once

You need three things: Node, the plugin, and your key from Dad.

**1. Install Node**

Go to https://nodejs.org and download the LTS version (the green button).

- Mac: open the `.pkg` and click through with the defaults.
- Windows: open the `.msi` and click through with the defaults. Leave "Add to PATH" checked.

**2. Add the plugin in Claude**

In the Claude app, open Plugins, choose Add marketplace, and enter:

    mikeroussell/roussell-plugins

Then install **Transcribe** from the list.

**3. Give Claude your key**

Ask Dad for your Deepgram key. Then, in a Claude chat, paste it like this:

    Here's my Deepgram key: (paste the key)

Claude saves it on your computer and tells you it's set. You only do this once. If you ever get a new key from Dad, paste it the same way and it replaces the old one.

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
- The pasted key is saved to `~/.transcribe/deepgram-key` (user-only permissions) by the `set_deepgram_key` tool. To rotate, the kid pastes the new key; to revoke, delete the key in the Deepgram console. The plugin also honors `CLAUDE_PLUGIN_OPTION_DEEPGRAM_API_KEY` (Claude Code's `/plugin configure`) and `DEEPGRAM_API_KEY` as fallbacks.
- Cowork installs plugins through claude.ai sync and does not show Claude Code's `userConfig` prompt, which is why the paste-in-chat flow exists.
- Development lives in `plugins/transcribe/server`. Run `npm test`, `npm run typecheck`, and `npm run build` before committing. The `dist/` bundle is committed on purpose; CI fails if it is stale.
- The live Deepgram integration test is opt-in: DEEPGRAM_API_KEY=<key> npm run test:integration.
- Local install for testing: `claude plugin marketplace add /path/to/roussell-plugins` then `claude plugin install transcribe@roussell-plugins`.
