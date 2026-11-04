# 50. Select and Connect (V265)

Applies to: V265 · Status: built, tested in headless Chromium only · Real devices: not verified.

## What it does
Pick one node as the **origin**, then click other nodes to collect them and join them with lines.

## How
1. Right-click a node (or click its tooltip header) and choose **☑ Select / Connect…**. The node gets a gold ring and a small bar appears under the ribbon.
2. Click other nodes. Each pick gets a blue ring and a dotted preview line to the origin. Click a picked node again to un-pick it.
3. Press **⟡ Connect**. Everything picked is joined to the origin with ordinary lines, and from then on **every node you click gets a line at once**.
4. **Pattern**: *Star* (every line starts at the origin) or *Chain* (each pick joins the one before it, the first joins the origin).
5. **Clear** forgets the picks (lines already drawn stay). **🗑 Delete picked** deletes the picked nodes after asking. **Done** or **Esc** leaves.

The rings and preview lines are an overlay and are never saved. The lines drawn by Connect are ordinary lines and are saved with the scene.

## Commands
`Omni Select start id(node)` · `pick id(node)` · `connect [pattern(star|chain)]` · `clear` · `delete confirm` · `done` · `status`

## Not built yet
Line meanings (step, flow, optional ...), arrowheads and the travelling light are designed but not built; every line is still a plain link. The transform bar (move / rotate / scale of a selection) comes next.
