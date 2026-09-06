# NavMenu (Right Drawer) Leaf Panels

## What's built

Same rule as the left drawer's `INDEXED_PANELS_DESIGN.md`, applied to
the right drawer (NavMenu): any node with no subpage beneath it gets
its own panel, via the same `ui/IndexedPanel.js` factory. A parent
*with* children (Account, About, Portfolio, SocialNetworks,
OmniChannels) does not get a panel itself — only its leaf children do.

8 slots each (not 20), and wider (440px vs. the left drawer's default)
— both per explicit request.

24 panels total: Home, Work, Products, Services, Resources, Contact
(top-level leaves) + Login, Profile, Dashboard (Account's children) +
About-Me, About-TheVision, About-TheSupporters (About's children) +
2D-Projects, 3D-Projects, XD-Projects (Portfolio's children) +
LinkTree, Communities, Collaborators (SocialNetworks' children) +
OmniFeeds: Updates/Logs/Drops/Perspectives/Experiments/Media
(OmniChannels' children).

`ui/Drawer.js`'s `RIGHT_ITEMS` tree updated to match: About's children
renamed to the hyphenated `About-Me` / `About-TheVision` /
`About-TheSupporters` (TheVision is new), Portfolio's children renamed
to `2D-Projects` / `3D-Projects` / `XD-Projects`. Everything else in
the tree was already correct as-is, including `Contact`, which already
existed.

## What's explicitly NOT built yet — and why

The brief described these panels as eventually being "controllers for
what will be in the space," built with something like `OmniDraw`'s own
component, but wider, since some could function as mini-webpages
depending on the page. That's a real, different thing from what got
built this pass, and it wasn't attempted here — not because it isn't
worth doing, but because "it just depends" (the brief's own words)
means the actual shape of that isn't settled yet, and guessing wrong
here would mean building the wrong thing 24 times over.

Concretely unresolved, that would need answering before that version
gets built:

- Does "controller for what will be in the space" mean each of the 8
  slots inside a nav panel places/configures an object, the way
  `OmniDraw`'s create panel does today — or does it mean the *panel
  itself* is the space-object, and the 8 slots are something else
  entirely (sub-views, settings, content blocks)?
- "Could be mini-webpages" — is that the embedded, CSS3D-rendered kind
  of "webpage" discussed earlier this session (a real, live, clickable
  iframe positioned in 3D space), or a simpler in-panel content view
  that just visually resembles a webpage without literally being one?
  These are very different builds — the CSS3D route needs a whole
  second renderer running alongside the normal one.
- Would every one of the 24 panels get this treatment eventually, or
  only some (a "mini-webpage" reading makes obvious sense for Home or
  About-TheVision; less obvious for something like Dashboard)?

This pass deliberately stayed at "the panels exist, with the same
proven chrome every other indexed panel already uses" — the default
being "the OmniDraw object" was read as: don't invent new panel
machinery, reuse what's already proven. Once the above is answered,
the natural next step is extending `IndexedPanel` (or building a
sibling class) with a genuine per-slot object/content authoring
surface — not a rewrite of what exists now.
