# CoordinateNode System & Timeline Animation

Nothing in this document is built. Captures a planning conversation.

## The idea

A menu/system for placing "CoordinateNodes" in the space — built from
the existing `OmniDraw` object as a base, using Position, Rotation, and
Scale to lock in a specific location and orientation. Once placed,
these become waypoints for a GSAP-driven timeline: transition from one
CoordinateNode's transform to the next, with duration and easing
filled in through the Inspector.

Worth naming directly: this is the same underlying pattern already
built once, at smaller scope — `ui/OmniExpression.js`'s waypoint
timeline (record a state, hold, transition to the next) is a working
version of exactly this idea, applied to one presenter avatar. The
CoordinateNode system generalizes that mechanism from "one object" to
"any object," using `OmniDraw`'s object as the reusable base rather
than inventing a new placement tool. This mirrors a pattern that's
shown up repeatedly while building this project — reaching for
`OmniDraw`'s object as the reference point for new, differently-
purposed tools rather than building each one from scratch.

## The GSAP-parameters-in-the-Inspector question

Confirmed as the right shape: yes, the actual GSAP parameters
(duration, ease, delay, repeat, yoyo) would be the fields a user fills
in per-waypoint in the Inspector, the same way `OmniExpression`
already exposes hold duration per waypoint today.

One open design choice, not yet decided: raw GSAP vocabulary
(`power2.inOut`, `back.out(1.4)`) is developer language. Given
everything discussed about OmniSense — communicating intent and
experience, not just data — there's a real option to put a thin
translation layer on top ("Slow start" instead of `power2.in`, etc.)
rather than defaulting to GSAP's own naming just because that's what's
underneath. Not required, but worth deciding on purpose rather than by
default whenever this gets built.

## The "detailed timeline view under OmniVisor" question — resolved simpler

Originally floated as an Adobe-Premiere-style multi-track editor,
revealed under OmniVisor's perception-gating. Feedback: not that
complex — closer to **YouTube's video timeline** as the reference: a
simple scrubbable bar with a playhead, much simpler than a full
multi-track NLE. See OMNIVISOR_DESIGN.md for where this now lives.

## Status

Purely conceptual. No CoordinateNode placement tool, no timeline
authoring UI, and no GSAP-parameter Inspector fields exist yet. The
reusable mechanism (record/hold/transition) already exists in
`OmniExpression`, narrowly scoped to one avatar — generalizing it is
the concrete next step whenever this gets built.
