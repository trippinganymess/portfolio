# Kill a Spirit

Open `/dreams` (सपने Dreams) from the portfolio navigation, then **Play game**. The standalone
game lives at `/games/kill-a-spirit/index.html` and is copied into `dist` by Vite.
Click **Enter the dream** to start gameplay and unlock the soundtrack.

The spirit model, chasing, shattering, and reincarnation mechanics are adapted
from the supplied `Night Chalk Spirit 3D Model (1).html`.

- `game.js`: original spirit, game state, controls, and shared gust clock.
- `scenery.js`: procedural Japanese twilight landscape, waves, trees, clouds,
  petals, mountain dust, and the arriving flocks of crows.
- `audio.js`: supplied Kyoto music, wind/waves, and crow recordings, with
  gesture activation, mute, pause, and playback error handling.
- `vendor/three`: Three.js 0.186.1 and bloom dependencies, with MIT license.
  The game has no runtime CDN dependencies.

Move the pointer or touch the canvas to lure and catch the spirit. There are no
in-game option controls or glow indicator. Each catch reduces the returning
spirit's opacity by one eighth; the eighth catch takes every spirit material to
exactly zero and ends reincarnation. The scene reveals “You have successfully
killed the spirit. You are the Spirit Slayer.”, followed three seconds later by
“Now you will be haunted forever.”

Automatic gusts last 12 seconds in a 22-second cycle. The same envelope drives
water, foliage, dust, clouds, and wave volume. Beginning 12 seconds after
starting, one to three crows fly in from outside the screen every 12 seconds.
They settle on separate branches across both trees and sway with the branches.
Their recording plays while birds are flying and stops after the last landing.
When the branches fill up, older birds fly away to make room for new arrivals.
Switching tabs pauses animation, the arrival clock, and audio.
The trees and shrine share grounded island anchors, including portrait layouts.

Shattering the spirit briefly shakes the view and sends ripples across the lake.
When the disturbance reaches a resting crow, it takes a short flight and settles
back onto its original branch. Screen shake respects reduced-motion preferences.

The supplied MP3s are copied into `audio/` with portable filenames. Background
music is **Fun in Kyoto — Steve Oxen**. Playback starts only after the start
gesture. A WebGL 2 capable browser is required.

For local use, run `npm run dev` from the project root. Run `npm run build`
for the production output. Deploy with the same SPA fallback used by the
portfolio's `/biography` route so `/dreams` also opens directly. `/games` remains
an alias for the Dreams page.

Run `node --test tests/kill-a-spirit-flock.test.mjs` from the project root for
flock timing, offscreen entrances, perching, capacity, and shatter reactions.
