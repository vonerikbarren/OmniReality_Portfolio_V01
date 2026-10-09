# 0. How to Maintain This Guide

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md)

This guide is for people who use the app. Keep it true.

## Rules

1. **Code is the source of truth.** Read the code, not older docs. If they disagree, follow the code and add a line to the "Doc/code mismatches" appendix in the [index](README.md).
2. **Only document what exists.** Anything planned goes in a "Planned (not available yet)" box with a link to the build order, never in the steps.
3. **Verify every name.** Each key, button label, menu name, panel name and event cited must be found in the code. Search for it before you publish.
4. **Update with the feature.** Any change to a key, label, ribbon button, panel or limit updates the matching page in the same build. Also update the header date.
5. **Plain words.** Short sentences, numbered steps, small tables, no marketing language, no emojis except the app's own glyphs (⟐ ⚇ ⚉ ☰ ⬢). Explain a term the first time it appears.
6. **Phone vs desktop.** State differences; the breakpoint is 700px (PHONE_MAX in utils/OmniLayout.js).
7. **Under five minutes per page.** Split if longer. Cross-link neighbours.
8. **Say what was not checked.** Anything not tried on a real device goes in the "Unverified" appendix.
9. **Developer Queue.** Item 61 tracks this guide's follow-ups.

## Page template

```
# N. Title

Applies to: Vxxx · Status: verified against code on YYYY-MM-DD · Real devices: not verified.

[Guide index](README.md) · Previous: ... · Next: ...

One-paragraph summary: what this is, in plain words, with new terms explained.

## Steps (numbered)
## Reference table (control | what it does)
## Phone vs desktop (if different)
Planned (not available yet): ... link to build order
```
