# OmniCamera: the camera idea (parked, NOT built)

Status: **parked 2026-10-11** (written in V188). Nothing in this document exists in the code yet. It records everything that was said and decided so a later build can start from it without asking again.

Owner decision on 2026-10-11: the slot under the logo now holds the **userCompass** (V188, see `docs/architecture/USER_COMPASS_DESIGN.md`). The camera is deferred to a later iteration.

---

## 1. The idea

A camera feature, "FaceTime-like" in the sense of a **self-view** (you see yourself live), with **local recording** (the video stays on the device).

How the owner first imagined it: a tiny `div` in the small slot directly under the logo (and above the top-left MENU cell) with **three sections**:

| # | Section | What it does |
|---|---------|--------------|
| 1 | Camera icon | Opens a **permission explainer panel** first (why the camera is needed, what is and is not stored), then triggers the browser's own permission prompt. |
| 2 | A second icon. The owner wrote "form icon". This is **almost certainly film / record** (the recording control). **To be confirmed with the owner.** | Recording (start / stop). |
| 3 | Settings icon | Opens the camera settings. |

Then the owner changed their mind about what goes in that slot: a clear spinning sphere with a grid, the **userCompass**, was built there in V188, and the camera was **deferred**.

**Open question: where does the camera live now?** Candidates: (a) reuse the slot later (it is only ~103 x 97 px on desktop and is hidden on narrow screens, see the design doc), (b) a ribbon button, (c) a dock icon, (d) a floating tile the user can place. Not decided.

---

## 2. Feasibility notes (device support), as given to the owner

- `getUserMedia` works on modern **desktop browsers, Android Chrome / Firefox and iOS Safari 14.3+**.
- It needs a **secure context: HTTPS or localhost only**. A plain `http://` site gets no camera.
- The **permission prompt always appears** and cannot be skipped or made silent. Design for the **blocked state** too: if the person denied it once, the page cannot ask again; it can only explain how to re-enable it in the browser's site settings.
- **iOS needs `playsinline`** on the `<video>` element, or the preview opens fullscreen / does not play inline.
- **`MediaRecorder` exists everywhere now, but the formats differ:** Chrome / Firefox record **WebM**, Safari records **MP4**. Detect with `MediaRecorder.isTypeSupported(...)` and pick the first supported type; never assume one.
- **Embedding in an iframe** needs `allow="camera; microphone"` on the iframe (and the parent's Permissions-Policy must allow it).
- It **works in fullscreen**.
- **In-app browsers** (social-app webviews and similar) may block camera access entirely. Detect failure and say so plainly.
- Phones have a **front / back camera**: offer a flip control.
- The **microphone is a separate permission** from the camera.

## 3. Design advice

- **Tiny tile -> tap opens a floating window.** V187 gave every panel window resize + maximize, so the camera window can reuse that chrome (it would be a normal class-A panel).
- **Privacy first:**
  - never start the camera automatically;
  - always show a visible **"camera on" indicator** (the tile pulses or turns red while a stream is live);
  - **local only**: no upload unless the person explicitly chooses it;
  - stop every track (`track.stop()`) when the window closes or the tab is hidden for long.
- **Recording storage:** keep a short recording in memory, then offer **Save / download**. Longer recordings go to **IndexedDB** in chunks (the app already uses IndexedDB for wallpapers, see `utils/WallpaperStorage.js`).
- **Mirror the self-view** (like a mirror); the saved file is not mirrored unless chosen.
- A **recent-recordings list** (name, length, size, play, download, delete).

## 4. Candidate settings

- Camera **device** (a list, plus a front / back **flip** on phones)
- **Resolution**: 480p / 720p / 1080p
- **Mirror** the self-view (on / off)
- **Microphone** on / off, and which microphone
- **Recording quality / bitrate**
- **Countdown timer** (3 / 5 / 10 s before recording starts)
- Maybe **frame rate**

## 5. Candidate icons

Custom SVG, so they look the same on every device (no font glyph differences):

- **Camera lens / iris** for the camera
- **Film reel** for recording (a new mark, **not** the common red-dot record button)
- **Sliders** for settings (**not** a gear)

## 6. Scope boundaries

- In scope: **self-view + local recording only**.
- **Real two-person calls are a separate, larger project:** accounts, a signalling server, a TURN relay, WebRTC. Not part of this feature.
- **Screen recording** (`getDisplayMedia`) is **not available on phones**; default: not included.

## 7. Questions still open for the owner

1. Is "form icon" really **film / record**? (Confirm.)
2. What does the **middle section** do exactly: start / stop only, or also pause, take a still photo?
3. The **settings list** (section 4): which items, which defaults?
4. Show the **permission explainer every time** or **first time only**?
5. **Audio default**: microphone on or off when recording starts?
6. **Where do recordings go**: a download only, or into a Reality / the app's storage?
7. **Where does the camera live now** that the slot under the logo is the compass? (see section 1)

## 8. Suggested build plan (small steps)

1. **Permission explainer + preview tile.** Explainer panel, then `getUserMedia({ video: true })`, a small mirrored preview with `playsinline muted`, the "camera on" indicator, a Stop button, blocked / denied / no-camera / unsupported messages. No recording yet.
2. **Recording + save.** `MediaRecorder` with `isTypeSupported` detection, start / stop, elapsed time, in-memory chunks, Save / download with the right extension (`.webm` / `.mp4`), a size warning, an upper time limit.
3. **Settings.** Device list + flip, resolution, mirror, mic, quality, countdown; persisted like the other settings (versioned key, validated on load, try/catch, events in the app's style).
4. **Polish.** Recent-recordings list (IndexedDB for long ones), custom SVG icons, OmniNotify tips (`data-omni-tip` / `-key` / `-desc`), keyboard access, reduced-motion, phone layout, user guide page and TestingChecklist category.

Conventions to follow: module contract `{init, update, destroy, onResize?}`, `addModule` calls `init()` itself, user-facing modules never import `Dev*` modules, no extra WebGL contexts (the camera preview is a `<video>`, not a canvas context), release the stream in `destroy()`.

## 9. Test plan

Real-device checks (none of these can be proven in the jsdom or software-GL harness):

| Where | What to check |
|-------|---------------|
| iOS Safari (14.3+) | permission prompt, inline preview (`playsinline`), MP4 recording, front / back flip, rotate the phone |
| Android Chrome | prompt, preview, WebM recording, flip, microphone permission separate |
| Desktop Chrome | prompt, device list, WebM, long recording to IndexedDB |
| Desktop Firefox | prompt, WebM, device list |
| Desktop Safari | prompt, MP4 |

States to force on each:

- **permission denied** (answer Block) -> the blocked-state help text, no crash, the tile stays usable;
- **blocked earlier** (site setting) -> same, without a prompt;
- **no camera present** (desktop without one) -> plain message;
- **insecure origin** (plain http) -> plain message that HTTPS is required;
- **camera busy** (used by another app) -> `NotReadableError` message;
- **fullscreen** on and off while previewing / recording;
- tab hidden / window closed while recording: stream stopped, partial recording kept or discarded as decided;
- inside an iframe with and without `allow="camera; microphone"`;
- an in-app browser (social-app webview).

Automated: pure helpers (format picking from a fake `isTypeSupported`, settings validation / clamping / hostile storage, state machine idle -> asking -> live -> recording -> stopped / denied / error) in jsdom with a fake `navigator.mediaDevices`.

## 10. Acceptance checklist

- [ ] The camera never starts without a click and the browser's own permission answer.
- [ ] A permission explainer is shown before the prompt (rule from question 4).
- [ ] A visible "camera on" indicator whenever a stream is live.
- [ ] Self-view is mirrored; the saved file is not (unless chosen).
- [ ] Recording works on iOS Safari (MP4) and desktop Chrome / Firefox (WebM); the file plays back.
- [ ] Denied, blocked, no-camera, busy and insecure-origin states each show a clear message.
- [ ] Closing the window or leaving the tab stops every track (the camera light goes off).
- [ ] Nothing is uploaded; recordings stay local unless the person chooses otherwise.
- [ ] Settings persist (versioned key, validated, try/catch) and have OmniNotify tips.
- [ ] Phone layout fits; works in fullscreen; no extra WebGL context.
- [ ] No `Dev*` import from the user-facing module (the nodev test covers it).
- [ ] User guide page + TestingChecklist category + BuildLog entry written.

## 11. Related

- `docs/architecture/USER_COMPASS_DESIGN.md`: the compass that took the slot (slot geometry with measured numbers).
- `docs/dev/Roles/Developer/buildOrder_Ideas_V01.md`: the "ideas parked for later" list (this idea is first).
- `docs/dev/Roles/Developer/DeveloperQueue.md`, item 78.
