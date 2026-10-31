# 47 · Pictures and videos on the meaning cube, and reskinning voxel rooms

[Guide index](README.md)

## Pictures and videos on a face (V257)
Any face of a poly node, including the six-face meaning cube, can now show a **video** as well as a picture.

1. Select the cube and open its face settings (tap a face, then *Open face settings*).
2. Set the face's content to **image** or **video**, then **Import…** a file (or pick one already in the library).
3. A video face shows a still picture with a ▶ badge. Tap the face and choose **Play the video**; tap again and choose **Pause the video**. A small red dot shows it is playing.

From a script: `Omni Semantics face id(cube) axiom(time) video(libraryId)`, or `image(libraryId)`. `image(none)` / `video(none)` takes it off again. Changing only the label or event keeps the picture.

**Limits:** a video file can be up to **40 MB** (mp4, mov, webm, ogg video). **Two videos play at once**; starting a third stops the one that started first. The picture on the face updates about 12 times a second and the sound plays normally. If the browser will not play a video, you get a plain message. Videos are kept in the browser's library like documents (the library total stays at 270 MB).

## Reskin a voxel-room node
A voxel node (the small diamond in a room's centre) is the **skeleton**; a meaning cube is its **skin**.
- `Omni Semantics reskin id(voxelNodeId) skin(contrast)` puts a cube above the voxel; it follows the voxel when it moves.
- Run it again with another skin (`default`, `plain`, `contrast`, `blank`) to swap the skin without touching the voxel.
- `Omni Semantics reskin all(true) skin(plain)` does every voxel node.
- `Omni Semantics unskin id(voxelNodeId) confirm` takes the cube off.
The cube is named `skin_<voxel id>`, so it saves, loads and travels in the scene file like any node.
