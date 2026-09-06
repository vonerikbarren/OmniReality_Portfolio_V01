# Backend Architecture — Why Frontend-Only Hits a Wall

Nothing in this document is built. This captures the reasoning from a
planning conversation, for whenever the actual backend work starts.

## The realization

Everything today lives in each user's own browser (`localStorage` /
`IndexedDB`). Two people looking at the "same" OmniReality are actually
looking at two independent copies. That's fine for a single-user
creative tool. It stops being enough the moment other people's data or
actions need to matter to each other.

## Three distinct limitations — not one generic "need a server"

1. **Cross-user shared state.** A shared reality — where one person's
   created object is visible to another — requires a server both
   browsers talk to. There is no frontend-only way around this.

2. **Real-world side effects.** SMS is the clearest example: you
   cannot call an SMS gateway (Twilio, etc.) directly from client-side
   JavaScript, because that means shipping your API secret key to
   every visitor's browser, where anyone can extract and abuse it.
   Anything reaching outside the browser — texting, email, payments —
   structurally has to go through a server you control.

3. **Trust/authority.** Right now, anyone can open DevTools and edit
   their own `localStorage` to grant themselves anything. Fine for a
   single-user tool; not fine once other people's data or actions
   depend on that data being honest.

## The good news — the current data shape is already backend-friendly

Nodes, edges, admin settings, spaces, wallpaper/particle settings —
all of it is already plain JSON objects, read/written as a unit. That
maps almost directly onto a document database (Firestore, MongoDB) or
a relational DB with JSONB columns. This is not a rewrite - it's
putting a real database under the same shapes that already exist, and
adding a thin API layer in front of it for the things the browser
structurally can't do (auth, SMS, shared state), while keeping the
rich client-side rendering exactly where it is.

## Hosting — GitHub Pages question, answered

GitHub Pages serves static files only - no server-side code execution,
no database, ever. If a real backend gets built, GitHub Pages cannot
host it, full stop; that part isn't a judgment call, it's just what
static hosting is.

What *is* a judgment call is whether GitHub Pages goes away entirely
or stays for part of the picture:

- **Full migration** - if the choice is a "batteries included"
  platform (Firebase, Supabase, or a full-stack host like Render/
  Railway/Fly.io that serves both frontend and backend from one
  place), everything likely consolidates there and GitHub Pages stops
  being used at all.
- **Hybrid** - GitHub Pages can keep serving the static frontend
  (free, already working) while a separate, small backend service
  handles just the things that need a server (WebSockets, SMS, shared
  DB), called via API from the GitHub-Pages-hosted client. Common,
  cost-effective pattern - not required to throw away what already
  works just because part of the app now needs a server somewhere.

## What this unlocks, and where it connects to other conversations

OmniFeed's live comments (WebSockets - see OMNIFEED_DESIGN.md),
cross-device sync, and the OmniFolder System (not yet described to
Claude - no assumptions made about its needs here) all point at the
same missing piece: a backend + database + light auth. Worth treating
as one infrastructure decision rather than three separate side quests.

## Status

Purely conceptual. No backend framework, database, or hosting decision
has been made. No code exists for this yet.
