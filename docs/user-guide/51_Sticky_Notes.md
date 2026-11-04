# Sticky Notes

A sticky note is a small note node that can stick to another node and follow it.

**Make one**
- Click a node, open its tooltip menu, choose "Stick a note on this".
- Or Ribbon > Create > Nodes > Sticky note (sticks to the selected node, if any).
- Or the draw-mode picker tile "sticky".
- Or by command: `Omni Sticky create text "hello" color pink`.

**Colours:** yellow, pink, blue, green, orange, purple. Change them in the note inspector swatches or with `Omni Sticky color <id> <name>`.

**Moving:** the note follows its target. Drag the note and it keeps the new offset. Several notes on one node stack.

**Unstick:** the Unstick button in the inspector, or `Omni Sticky detach <id>`. Deleting the target frees its notes.

**Other commands:** `Omni Sticky attach`, `text`, `list`.
