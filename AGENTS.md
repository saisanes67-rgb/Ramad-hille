# AGENTS.md
Static site, no build. Publish dir: `public/` (see netlify.toml).
- `public/index.html` — Arabic (RTL) UI: menus, HUD, touch controls; loads Three.js via import map.
- `public/style.css` — atmosphere overlays (vignette, grain, hurt), HUD, touch buttons, screens.
- `public/game.js` — whole game: seeded procedural town, colliders (AABB list), pickups (3 keys + health), monster AI (wander/chase), synthesized audio, input (pointer events for touch, pointer lock for desktop), main loop.
Conventions: everything procedural (no asset files); keep mobile performance in mind (no extra dynamic lights, capped pixel ratio). UI text is Arabic. Town layout uses a fixed seed (1999).
