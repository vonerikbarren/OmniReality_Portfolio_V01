# Flashcards node

One node is one deck. Each card has a front and a back; each side can hold text, a picture and a sound clip.

**Make one:** Ribbon > Create > Nodes > Flashcards, the draw-mode picker tile "Flashcards", or `Omni Flash create title(Spanish) cards(hola|hello;adios|goodbye)`.

**Edit:** select the node, then Inspector > "Edit cards" (or its tooltip menu > "Study / edit cards"). Add, delete and move cards, type each side, add a picture (it is shrunk to fit) and a short sound clip (about 100 KB or less). "Read aloud" speaks each side as it appears.

**Study:** the study bar sits at the bottom. Flip (Space), Again (1), Got it (2), Previous ([), Next (]).
- *Got it* takes the card out of this round. *Again* sends it to the back to come round once more.
- When the queue is empty the card shows "Round done". Restart goes again; the shuffle button starts in a new order.

**Files:** Export JSON (keeps pictures and sounds) or CSV (text only: front,back). Import replaces the deck or adds to it.

**Commands:** `Omni Flash create|add|flip|next|prev|got|again|restart|study|edit|list|export|import`.
