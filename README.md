# تلّ الرماد — Ashen Hill

An original first-person survival-horror game for mobile browsers, inspired by the foggy, grainy atmosphere of classic PS2 horror games. Explore a fog-drowned town under falling ash, find three keys, avoid or fight the creatures (your radio crackles when they are near), and escape through the north gate.

## Tech
- Plain HTML/CSS/JS, no build step
- Three.js (via CDN import map) for 3D rendering
- Web Audio API for fully synthesized sound (radio static, drone, effects)
- Procedurally generated textures and models — no external assets
- Hosted as a static site on Netlify (`public/`)

## Run locally
```
netlify dev --port 8889
```
or serve `public/` with any static file server.

## Controls
- Phone: left side = move joystick, drag right side = look, attack button, flashlight button, run button
- Desktop: WASD, mouse look (click to lock), click to attack, F flashlight, Shift run

## Ideas for later
Indoor areas, more enemy types, a story with notes/puzzles, save progress.
