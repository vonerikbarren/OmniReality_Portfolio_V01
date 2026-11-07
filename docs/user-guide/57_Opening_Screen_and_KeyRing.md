# Opening screen and the key ring (OmniPassKeyRing)

**Light by default.** White background, black words, stars and loading bar, at about 68 percent opacity. The stars are a **plexus**: points joined by faint lines when they are near each other, written for this app (no library). Open the **gear** (bottom left) to change anything. Everything is saved in this browser.

## The gear
- **Look**: Light or Dark, background colour, colour of words and stars, overall opacity, logo star opacity, star field opacity.
- **Plexus**: points, link distance, line opacity, speed, point size.
- **Spaces**: tick the spaces you want. By default all twelve rotate behind the logo, smallest to largest (or the other way round), each zooming into the next like Powers of Ten: Planck, subatomic, atomic, molecular, cellular, tissue, terrestrial, planetary, stellar, galactic, intergalactic, universal. You can set how long each stays and how long the zoom takes, and show or hide the name of the space at the bottom.
- **Loading bar**: plain, or a moving rainbow spectrum. Light moves inside the beam and small particles ride just outside it.
- **Key ring**: ask for the key ring on Enter (on by default) and the digit key length (6 or 10).
- **Motion**: Reduce motion shows one still frame. Your system's reduced-motion setting is always honoured.

The version label sits at the bottom right: `OmniOS_sandbox_A00_V276`.

## Enter and the key ring
Press **Enter**. The words and bar let go, the fall begins from twice the old height, and halfway down (where the old fall began) it holds while a glass panel slides in from the right:
1. **Visitor**: who is visiting. "Guest" is fine; the last name you used is remembered.
2. **Glyph**: pick one of 50 generic glyphs. The glyph alone says nothing; you decide what it stands for.
3. **String bound to the glyph**: type the string the glyph stands for. The glyph and the string go together.
4. **Digit key**: 6 or 10 digits.

This is a **showcase**. Any complete entry opens the gate, except the demo code: digits all zeros (000000, or ten zeros). That is denied, so you can see the error. The message never says which field was wrong. The third wrong try pauses the gate for 5 seconds, then 15, then 45 (the last repeats), and a correct entry resets it. When the gate opens, the opening screen fades and the fall carries on to the landing, exactly as before. It is not security: the check runs in the page. Real protection needs a server check or an encrypted Reality.

Embedded copies (an OmniBrowser inside the app) never ask. Add `?gate=off` to the address to skip it.

## For builders
- `utils/OmniSpaces.js`: the twelve spaces as pure functions (where point i of n sits at time t), the rotation and the zoom between two. One fixed pool of points is moved between formations, so memory does not grow.
- `utils/OmniKeyGlyphs.js`: the 50 glyphs (10 outlines x 5 marks), drawn as svg from numbers.
- `utils/OmniGate.js`: the entry rules and the wait protocol (time is passed in).
- `utils/OmniGateSettings.js`: the saved settings (`omni:gate-v1`). `look` set in the gear wins over the dev intro colours (`omni:dev-intro-v1`); both default to light.
- `ui/OmniGateGear.js`, `ui/OmniGateForm.js`: the gear panel and the form. `boot/OmniStarBoot.js` draws the spaces, plexus, beam particles and the fall's streaks.

Later: the glyph made from the typed string (a typo check), deriving the real password from the keys, an encrypted vault, and a server check. See claude/OMNIPASSKEYRING_DESIGN.md.
