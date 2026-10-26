# 18. Audio library

Applies to: V198 · Status: written from the V198 code; the import, the list, the waveform, the preview and the storage were checked in jsdom with a fake IndexedDB and in Chromium with generated files · Real devices: not verified.

[Guide index](README.md) · Related: [Music nodes](16_Music_Nodes.md)

The **audio library** keeps the sound files you import (a drum hit, a vocal, a whole backing track) inside your browser. A song can then use any of them as an **audio clip** next to its pattern clips. The library window is where you add, hear, rename and delete the files.

## Open it

- **Ribbon**: Home > Tools > **Audio library**. It opens the window `⟐OmniAudioLibrary`.
- **OmniStarLight** search (Ctrl/Cmd+K): type *audio* or *import*.
- From a song: the song panel opens the same list in a small chooser (`openAudioPicker`) when you add an audio clip.

## Add sound files

- Press **Import audio** and pick one or more files, or
- **drag files from your computer onto the screen** while the library window is open. The whole screen turns into a drop zone.

Each file is checked, opened by your browser and stored. A short message for every file appears in the window (a green line when it worked, a red line with the reason when it did not) and as a notification.

## Which formats work

**The browser decides.** The app does not carry its own decoders; it asks your browser to open the file. In practice:

| Format | Usually works |
|---|---|
| WAV (PCM) | Everywhere |
| MP3 | Everywhere |
| OGG (Vorbis, Opus) | Chrome, Edge, Firefox; Safari only in newer versions |
| M4A / AAC | Chrome, Edge, Safari; Firefox usually |
| FLAC | Current Chrome, Edge, Firefox, Safari |
| AIFF, WebM audio, MP4 audio | Depends on the browser |

The file name and type are only a hint. The app looks at the first bytes of the file: a picture or a PDF is refused at once, even if it is named `.wav`, and a real sound file with the wrong name still imports. If a file looks like sound but your browser cannot open it, you get a message that says so; convert it to WAV or MP3 and try again.

## Limits

- **40 MB per file.** Longer recordings: save a compressed copy (MP3, OGG) or trim them.
- **300 MB for the whole library.** The meter at the top of the window shows how much is used. Delete files you do not need to make room.
- The browser has its own storage limit too. If it says there is no room, free some disk space or delete audio from the library.
- A very long file that would take too much memory once opened is refused with a "too long" message.

## What you can do with a file

| Button | What it does |
|---|---|
| **▶ / ■** | Plays the file so you can hear it. Click again to stop. Clicking the waveform plays from that point. The preview stops when you close the window. Nothing makes a sound until you press it. |
| **Rename** | Changes the name. Songs keep using the file (they point to it, not to its name). Names are kept unique: a second "Pad" becomes "Pad (2)". |
| **Delete** | Asks first. If songs use the file it says how many; their clips then show as **missing** (they never crash), and you can import the file again and re-pick it. |

Every row shows the length, the format guess, mono or stereo, the sample rate (read from the WAV header; for other formats the browser's rate), the size and the date it was added.

## How clips reach songs

A song never contains the sound itself. An audio clip in a song holds only the **id** of a library file. When the song plays, the file is opened by the browser and scheduled on the song's timeline. So:

- the song and the library stay small to save;
- renaming a file changes it everywhere;
- deleting a file leaves the clip in the song as a "missing" clip;
- moving a song to another browser or computer does **not** move the audio (the files live in each browser's storage). Import the same files there.

## Private mode and "NOT saved"

The files live in the browser's **IndexedDB**. In a private or incognito window, or when the browser blocks site storage, IndexedDB may be unavailable. The library then keeps your files **in memory only**: everything works, but it is gone when you close the tab. The window shows a yellow warning and the meter says **NOT saved (memory only)**. Open the app in a normal window to keep your files. Clearing site data for the app also removes the library.

## Not done yet

- No recording from the microphone, no trimming or editing of the audio itself, no time stretch or pitch shift.
- No export of the library, and no sharing of audio between browsers.
- Formats the browser cannot open are not converted.
- Not tried on real phones or tablets, and nobody listened to the previews: the sound was checked by reading an analyser.
