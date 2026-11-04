# Rhythm node

A **beat source**. Every beat can animate any node you bind to it, so geometry can have a beat. beat = animation, and what the beat *means* is up to you.

**Make one:** Ribbon > Create > Nodes > Rhythm, the draw-mode picker tile "Rhythm", or `Omni Rhythm create`. If a node is selected when you press the Ribbon button, that node is bound to the new rhythm and it starts.
**Put any node on a beat:** its tooltip menu > "Put this on a beat" (uses your active rhythm, or makes one).

**The panel** (Inspector > Edit rhythm): Start / Stop, Tap tempo, BPM, swing, 4..32 steps (click to cycle rest, soft, accent; or type a pattern like `x...o...x...o...`), "start when the scene loads", and the list of what it moves.

**Animations:** pulse, bounce, kick (one full spin), squash, flash, wobble, shake, sway, breathe. Each binding has amount, decay, ease, "every Nth beat", "accents only", and a free "what it means" (heartbeat, tick, breath, alarm, engine, dance...).

**Follow a music node:** pick a MusicNode (and a track) and its hits become the beats, with the hit's loudness as the accent.

**Lines:** binding draws a **Drives** line (rhythm to node). On accents a light travels along it (switch off in the panel).

**Safe by design:** the animation is an offset. It never changes the saved scale / position / rotation, and the node is put back exactly when the last animation ends. Move or scale it with the TransformBar mid-beat and it keeps your new place.

**Commands:** `Omni Rhythm create|start|stop|tempo|pattern|bind|unbind|trigger|follow|edit|list|anims`, for example `Omni Rhythm bind id(r) to(cube) anim(bounce) means(heartbeat)`.

Not in this version: an audible click, several patterns in one node, recording taps into the pattern.
