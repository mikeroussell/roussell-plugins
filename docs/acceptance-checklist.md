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
- [x] Transcribe installs (Cowork syncs the marketplace through claude.ai; no key prompt, resolved by the paste-in-chat tool)
- [x] The Node server launches (Cowork finds `node` on the login-shell PATH)
- [ ] Paste the key in chat ("Here's my Deepgram key: ...") and confirm Claude replies that it was saved to ~/.transcribe/deepgram-key
- [ ] A real voice memo transcribes and Claude summarizes it without dumping the transcript

Resolved 2026-09-14: the key prompt does not appear in Cowork, so the kid pastes the key in chat and the `set_deepgram_key` tool stores it. `node` was found via the login-shell PATH.

## 3. Windows kid's PC, GitHub marketplace

- [ ] Node LTS installs with defaults and `node --version` works in a new terminal
- [ ] Marketplace add + Transcribe install work in Cowork for Windows, and pasting the key in chat saves it (path will be under C:\Users\<kid>\.transcribe)
- [ ] A file with a `C:\Users\...` path and an uppercase `.MP3` extension transcribes
- [ ] The transcript lands beside the audio with a Windows path

## 4. Kid-language errors

- [ ] Delete ~/.transcribe/deepgram-key, ask to transcribe: Claude relays the "paste it here and I'll save it" message
- [ ] Paste a blank or broken key: Claude relays "That doesn't look like a Deepgram key"
- [ ] Ask to transcribe a `.txt` file: Claude relays the "isn't a supported audio type" message
- [ ] Ask to transcribe a file that doesn't exist: Claude relays the "couldn't find a file" message
