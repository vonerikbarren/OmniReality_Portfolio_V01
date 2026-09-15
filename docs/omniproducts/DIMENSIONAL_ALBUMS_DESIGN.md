# Dimensional Albums

Nothing here is built. Captures a real strategic idea raised while
planning the marketing/funding path toward a sustainable business,
not a feature request in isolation.

## The core idea

An album — real music, held back for years specifically because it
needed a platform that matched its own ideology rather than treating
it as background noise — released not as audio files, but as guided,
spatial tours through the OS itself. Edutainment, stated plainly: not
a tutorial with music under it, and not a music video with UI in the
background, but the same underlying mechanism doing both jobs at
once. A formation blooming into being while a track plays isn't a
demo with music added — it's the album.

Framed as the natural next tier of entertainment specifically because
it's also functioning as the product's own most honest possible
marketing material — showing real, working capability rather than a
pitch deck describing hypothetical capability.

## Why this isn't speculative — what already exists to build it on

OmniExpression's presenter avatar already has the real mechanism this
needs, not a coincidentally-similar one: record a sequence of
waypoints (mode, position, hold duration), play them back, and the
listener's own camera stays completely free the entire time —
`ui/OmniExpression.js`'s waypoint system, `holdMs` field, GSAP
timeline playback. A Dimensional Album, mechanically, is a longer,
music-backed waypoint sequence built on exactly this.

Two other already-real systems are the natural visual and atmospheric
layers per track, not new builds:
- **OmniSystem's formations** (Cross/Ring/Sphere) as the visual
  centerpiece — a Sphere formation blooming open during a specific
  verse, say, rather than a static backdrop.
- **OmniExpressionator's particle presets** for per-track mood and
  atmosphere — the entrance preset's light-speed streaks are one
  example of the kind of shift a track's own emotional turn could
  trigger.

## The real gap — named precisely, not glossed over

Waypoints currently hold for a fixed duration each (`holdMs`,
milliseconds, hardcoded per waypoint at recording time) — there is no
concept of syncing that duration to a specific position in an audio
track's own timeline. Playing music underneath a waypoint sequence
today means hoping the hold durations roughly line up with the music,
not a real, reliable sync between the two.

This is the one concrete thing that has to be solved before
"Dimensional Album" is a real mechanism rather than a coincidence.
The natural shape of the fix: waypoints gain an optional timestamp
field keyed to the track's own playback position (seconds into the
track) rather than only a duration — so a waypoint fires *because*
the track reached 1:04, not because the previous hold happened to run
out around then. Whether this replaces `holdMs` outright or exists
alongside it (duration as a fallback when no track is attached) isn't
decided.

## What's genuinely undecided beyond the sync gap

- Whether an album's waypoint sequence is authored once per track
  manually (the same Inspector-driven recording flow OmniExpression
  already has), or whether some part of it could eventually be
  audio-analysis-driven (beat/tempo detection triggering formation
  changes automatically) — the second is a much bigger, separate
  piece of work, not assumed here.
- Whether Dimensional Albums live as their own dedicated panel/mode,
  or as a specific way of using the existing OmniExpression Presenter
  system with a track attached.
- Licensing/hosting for the actual audio files themselves — not
  addressed here at all.

## Status

Purely conceptual. No timestamp-keyed waypoint field, no audio-track
attachment point, and no dedicated album authoring UI exist yet. The
mechanism it would be built on (OmniExpression's waypoint record/
playback) is real and already working; the fixed-duration limitation
is the one specific, named blocker between that mechanism and this
idea.
