# OrbitTunnel (V283)

Every reality has two OrbitTunnels: a **horizontal** ring lying flat round the middle, and a **vertical** ring standing up. They are torus tubes, drawn as a wireframe by default, and they sit as far out as the regular tunnels end (ring radius 8440, the far end of the longest tunnel).

Open the panel with the **◯ OrbitTunnel** button in the ribbon (Fire & tunnels), or `Omni OrbitTunnel open`.

## Settings (per tunnel, saved in this browser)
- **Look**: visible, style (wireframe or solid), colour, opacity.
- **Scale**: ring radius, tube width, turn (vertical ring only). "Reach of the regular tunnels" puts the size back.
- **Image or video** on the inner wall: paste an https link, or pick a file (a picked file lasts for this session only). Media shows in Solid style. Repeat along / round tiles it.
- **Particles**: on/off, speed (× the regular tunnel speed), count.
- **orbitTraversal** (your ride): your speed along the ring, roll speed round the wall, distance from the wall. Speed 0 = just circling the wall.

## The ride
**Enter horizontal / Enter vertical** flies you to the inside wall of that tunnel and rides a corkscrew: forward along the ring while circling the inside of the tube.
- The tunnel you enter first is ridden **Loops** times (laps each).
- Then the other tunnel follows, if it has its tick ("Takes part in the ride"). Then you fly back to where you were.
- **Auto enter**: reaching a tube (for example at the end of a regular tunnel) starts the ride by itself.
- Pause / go holds the camera; **Esc** or **Exit** leaves at any time.

## Commands
`Omni OrbitTunnel enter tunnel(vertical)` · `Omni OrbitTunnel exit` · `Omni OrbitTunnel open` · `Omni OrbitTunnel set tunnel(horizontal) key(radius|tube|opacity|speed|roll|particleSpeed|mode|visible|loops) value(...)`

Coming next (V284): the **OrbitTunnelNode**, a tunnel you place in the scene with the same settings saved in the scene file.

## Take Me There delay (V283)
⟐CameraTravelSettings has a new **Start delay** (default 0.15 s, 0 to 2 s). The camera waits that long before it moves. 0 = no pause.

## Hand orbs (V283)
The orbs of all four hands are white by default. In ⟐OmniHands → the hand → ◉ Orb, **Panel colour** has White and Black buttons and a colour picker for any colour; words, rings and the core switch to dark ink on a light panel. While you hold the core to charge, the whole system inside the orb turns faster (up to about 6x at full charge, easing back after release) and energy particles spiral into the core, more of them the longer you hold.
