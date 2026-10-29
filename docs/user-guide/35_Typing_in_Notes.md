# Typing freely in notes (V238)

While the cursor is in the ⟐OmniNote text (or its title / settings fields), **every key goes to the note**. Scene movement keys (W A S D …), hand and ribbon shortcuts, Ctrl/Cmd shortcuts (OmniStarLight, undo and the like) and the typing-instrument keys do not fire. The browser's own editing still works: select all, copy, paste, undo, redo, bold and italic act on the note.

**Escape** takes the cursor out of the note and works as usual after that. Click outside the note and the shortcuts are back.

For developers: mark any element with `data-omni-typing` to give it the same behaviour (utils/OmniTypingShield.js).
