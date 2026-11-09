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
