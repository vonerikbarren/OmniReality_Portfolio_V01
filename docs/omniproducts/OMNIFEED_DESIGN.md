# OmniFeed — Blog Interface & Live Comments

Nothing in this document is built. Captures a planning conversation.

## The idea

A blog-type interface — the "OmniFeeds" children under OmniChannels in
the right drawer (Updates, Logs, Drops, Perspectives, Experiments,
Media) already exist as leaf panels, per `NAV_PANELS_DESIGN.md`, but
currently hold generic placeholder content only. OmniFeed is the real
content/interaction layer meant to go inside them.

On top of the blog-post reading experience: live comments, styled
after Mega Man Battle Network's NET feeds — anyone can comment,
visible in something close to real time.

## Why this needs the backend conversation, concretely

This is the clearest, most concrete argument yet for
`BACKEND_ARCHITECTURE_DESIGN.md`'s case, worth stating plainly: two
browsers cannot open a WebSocket directly to each other. Someone has
to relay the messages. Live comments cannot exist frontend-only, full
stop — this isn't a "harder version" of something buildable today, it
structurally requires a server in the middle.

## Pieces, once a backend exists

- **The WebSocket connection only handles live delivery.** It doesn't
  persist anything on its own. A database is still needed so comments
  are still there after a reload — the socket and the database are two
  different jobs, both required.
- **Managed realtime services** (Supabase Realtime, Firebase Realtime
  DB/Firestore, Pusher, Ably) can shortcut having to run and scale a
  hand-rolled WebSocket server, if moving faster than building that
  layer from scratch is the priority.
- **Comments needing an author** means some minimal identity system,
  even if lightweight/pseudonymous rather than full accounts.

## Status

Purely conceptual. No blog/post data model, no comment system, and no
WebSocket connection exist yet. The right-drawer OmniFeeds panels exist
as empty shortcut grids only (see `NAV_PANELS_DESIGN.md`) — this is the
real content layer intended to go inside them, once the backend work
described in `BACKEND_ARCHITECTURE_DESIGN.md` exists to support it.
