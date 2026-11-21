---
name: video-making
description: Use before making a new video. Not for editing a video file the user supplied.
---
# Video
- Before the first full render, draw a few frames at full size at the busiest moments and look at them.
- Render one encoded file per scene, all with the same size, frame rate and encoder settings. Join them with the ffmpeg concat demuxer and `-c copy`, then add sound with `-c:v copy`. Put crossfades inside a scene file.
- Write each scene to a temporary name ending in .mp4 and rename it only when ffmpeg exits 0.
- Draw at the output size, 30 fps unless asked otherwise.
- Changing one scene: re-render only that file (and the next, if it holds a crossfade from it).
- New audio or a shorter ending: `-c:v copy`.
