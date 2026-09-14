# Setting up Transcribe on a kid's computer

Dad's walkthrough. Takes about ten minutes per machine. Do the Deepgram step once for each kid before you sit down with them.

## Before you start (Dad only)

1. In the Deepgram console, open your project and go to API Keys.
2. Create one key per kid, named after the kid (for example `transcribe-<name>`). Copy each key somewhere safe; Deepgram shows it only once.
3. Usage in the console is broken out per key, so you can see who is transcribing how much. To cut a kid off or rotate, delete that key and create a new one. Nothing else changes.

## Mac

1. **Install Node.** Go to https://nodejs.org and download the LTS version (the green button). Open the `.pkg` and click through with the defaults.
2. **Open Cowork** (the Claude desktop app) signed in as the kid.
3. **Add the marketplace.** Settings, then Plugins, then add a marketplace and enter:

       mikeroussell/roussell-plugins

4. **Install Transcribe** from the list.
5. **Start a new chat** so the plugin's server starts.
6. **Paste the key.** In the chat, type:

       Here's my Deepgram key: <paste the key>

   Claude replies that it saved the key under the kid's home folder. It should not repeat the key back.
7. **Test it.** Put a voice memo in a folder like `Documents/Recordings`, add that folder in Cowork, and ask:

       Transcribe test.m4a and give me the key points

   Expect a line saying where the transcript was saved, then a summary. A `test.transcript.md` file appears beside the memo.

## Windows

1. **Install Node.** Go to https://nodejs.org and download the LTS version (the green button). Open the `.msi` and click through with the defaults. Leave "Add to PATH" checked.
2. **Restart the computer** once so the PATH change reaches every app.
3. **Open Cowork** signed in as the kid.
4. **Add the marketplace.** Settings, then Plugins, then add a marketplace and enter:

       mikeroussell/roussell-plugins

5. **Install Transcribe** from the list.
6. **Start a new chat.**
7. **Paste the key** the same way as on Mac:

       Here's my Deepgram key: <paste the key>

   The saved path will look like `C:\Users\<kid>\.transcribe\deepgram-key`.
8. **Test it** with a file that has an uppercase extension and a full Windows path, for example:

       Transcribe C:\Users\<kid>\Documents\Recordings\TEST.MP3 and give me the key points

   This is the first real Windows run, so if anything looks off, screenshot the reply and send it to me.

## Everyday use (what to tell the kid)

- Put recordings in a folder Cowork can see.
- Ask in plain words: "Transcribe the lecture I recorded today", "Make study notes from bio-lecture-3.m4a", "What did the teacher say about the essay deadline in this recording?"
- Asking about the same recording again is free. Claude reuses the saved transcript.
- If Claude says to tell Dad, tell Dad.

## If something goes wrong

| Claude says | What it means | What to do |
|---|---|---|
| No Deepgram key is set | The key was never pasted, or the file was deleted | Paste the key again in chat |
| That doesn't look like a Deepgram key | The paste was blank or had spaces in it | Copy the key again, paste it on its own |
| Deepgram rejected your key | The key was deleted or mistyped | Check the key in the Deepgram console, create a new one if needed |
| The Deepgram account is out of credit | Your prepaid balance ran out | Top up in the Deepgram console |
| isn't a supported audio type | Wrong file type | Export as MP3 or M4A |
| Deepgram isn't responding | Network or Deepgram outage | Try again in a few minutes |

## Updating the plugin later

When a new version is pushed to GitHub, open Settings, then Plugins in Cowork and update or reinstall Transcribe, then start a new chat. Keys are stored outside the plugin, so nothing needs to be pasted again.

## Where things live

- Plugin source and docs: https://github.com/mikeroussell/roussell-plugins
- Saved key on each machine: `~/.transcribe/deepgram-key` (Mac) or `C:\Users\<kid>\.transcribe\deepgram-key` (Windows), readable only by that user
- Acceptance checklist with what has been verified so far: `docs/acceptance-checklist.md` in the repo
