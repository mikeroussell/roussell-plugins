# Transcribe plugin acceptance checklist

Run these in order. Each one answers a question the spec left open.

## 1. Claude Code on Mike's Mac, local marketplace

    claude plugin marketplace add /Users/mikeroussell/Documents/development/apps/roussell-plugins
    claude plugin install transcribe@roussell-plugins

- [ ] Enabling the plugin prompts for the Deepgram API Key (userConfig works in Claude Code)
- [ ] "Transcribe ~/Recordings/test.m4a" produces `test.transcript.md` beside the file
- [ ] Asking again does not add usage in the Deepgram console
- [ ] Renaming the transcript file and asking again re-transcribes
- [ ] Run the live Deepgram check once: from plugins/transcribe/server, DEEPGRAM_API_KEY=<key> npm run test:integration (this was deferred during implementation because no key was on the build machine)

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
