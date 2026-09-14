---
name: transcribe
description: Turn an audio or video recording (voice memo, lecture, interview, MP3/M4A/WAV file) into a text transcript saved beside the file, then summarize it, make study notes, or answer questions about it. Use whenever the user mentions a recording or audio file, or pastes a Deepgram key.
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

## Setting up the key

- If `transcribe_audio` says no Deepgram key is set, relay that message: the user needs to ask Dad for their key and paste it in the chat.
- When the user pastes a key, or says Dad gave them a key and includes it, call `set_deepgram_key` with the key exactly as pasted, then retry what they originally asked.
- Never repeat the key back in the chat and never write it anywhere else.

## If it fails

The tool's error text is written for the user. Relay it as is, in one or two sentences, without technical detail. Do not retry automatically more than once.
