# 3D Parkour — Build Steps

> 🧑 **Eric — read [STEPS-FOR-ERIC.md](STEPS-FOR-ERIC.md) instead.** This file is the
> technical checklist and is full of programmer jargon. That one says the exact same
> thing in normal words, with every term explained.

A Minecraft-style 3D parkour game: 5 biome levels + endless mode, playable on
computer and phone.

**Stack:** JavaScript (ES2022) + HTML5 + Three.js (WebGL). No build step, no Node,
no install. Run a local web server and open it in a browser.

**Run it:**
```
python3 serve.py
```
then open http://localhost:8100 — or on your phone, http://<your-mac-ip>:8100

---

## Phase 0 — Setup
- [x] Create folder structure (`src/`, `lib/`, `src/levels/`, etc.)
- [x] `.claude/launch.json` on port 8100
- [x] Vendor `lib/three.module.js` (pinned to r160, works offline)
- [x] `STEPS.md` + `README.md`

## Phase 1 — Skeleton
- [x] `index.html` with import map mapping `"three"` -> `./lib/three.module.js`
- [x] Renderer, sky, fog, lighting
- [x] A flat grass platform you can look at

## Phase 2 — Minecraft physics  ** the most important phase **
Get this right BEFORE building levels. If the physics are wrong, every level has
to be rebuilt.
- [x] Fixed **20 ticks per second** simulation (a Minecraft tick) + render interpolation,
      so a jump behaves identically on a 60 Hz laptop and a 120 Hz phone
- [x] `constants.js` — all real Minecraft numbers in one place:
      - player box 0.6 x 1.8, eye height 1.62
      - jump 0.42/tick, gravity 0.08/tick, drag 0.98 -> apex **1.2522 blocks**
      - walk 4.317 b/s, sprint 5.612 b/s, sneak 1.295 b/s
      - sprint-jump boost 0.2, ground friction 0.6, air drag 0.91
      - slipperiness: ice 0.98, blue ice 0.989, slime 0.8, honey 0.4
- [x] Swept AABB collision, resolved axis by axis (X, then Z, then Y) so you slide
      along walls instead of sticking
- [x] Assist mode (default ON): coyote time + jump buffering
- [x] Physics test harness (`tests.html`): asserts 4-block sprint jump, 3-block walk
      jump, apex height, "you cannot jump a fence"

## Phase 3 — Blocks, textures, level format
- [x] Block registry: id, texture, solid, friction, bounce, damage, climbable, tags
- [x] Procedural 16x16 textures drawn in a canvas at runtime (NO Mojang files),
      `NearestFilter` for the crisp pixel look
- [x] `InstancedMesh` batching per block type (keeps 5,000 blocks at 60 fps on a phone)
- [x] Levels are **JSON data, not code** — new levels never touch engine code

## Phase 4 — Controls (computer + phone)
- [x] Desktop: WASD, Space jump, Shift sneak, Ctrl sprint, mouse look (Pointer Lock),
      R respawn, V camera toggle, Esc pause
- [x] Mobile: left thumb joystick, right-half drag to look, big jump button,
      sprint toggle, respawn button
- [x] First-person <-> third-person camera toggle
- [ ] Test on the real phone over LAN  ← **needs you, Eric**

## Phase 5 — Level flow
- [x] Checkpoints, void/lava death, respawn with fade
- [x] HUD: level name, timer, deaths, checkpoints, active potion effects
- [x] Save to localStorage: unlocked levels, best times, deaths, settings

## Phase 6 — The five levels
Each level unlocks ONE new mechanic family, then mixes it with everything before it.

- [x] **Level 1 — Plains.** Core movement: 1-block ups, gaps, slabs, stairs, fences
      (1.5 tall = unjumpable, on purpose), ladders, cobwebs. Teaches the 4-block sprint jump.
- [x] **Level 2 — Snowy Tundra / Ice Spikes.** Ice, packed ice, blue ice (momentum
      and slide control), snow layers, powder snow.
- [x] **Level 3 — Jungle.** Slime blocks (bounce chains), honey blocks (stick to walls,
      slow you down, cancel jumps), vines and scaffolding climbing, water landings.
- [x] **Level 4 — Badlands / Deep Dark.** Pistons and sticky pistons (moving and
      launching platforms), buttons, pressure plates, trapdoors, **neo jumps**,
      headhitters. The technical level.
- [x] **Level 5 — Nether Wastes.** Soul sand (slow), magma blocks (damage), lava, fire,
      and **potions**: Speed, Jump Boost (actually changes your jump height), Slow
      Falling. Ends at a nether portal.

## Phase 7 — Endless mode
- [x] Seeded random generator (same seed = same course, so you can share runs)
- [x] Streams platforms ahead of you, disposes them behind you
- [x] Checkpoint every 10 platforms
- [x] Biome changes every 25 platforms, cycling all five
- [x] Difficulty ramps: wider gaps, mechanics only from levels you've unlocked

## Phase 8 — Audio & menus
- [x] Web Audio synthesized sounds (no Mojang audio): footsteps per block type,
      jump, land, splash, slime boing, portal hum, checkpoint chime
- [x] Title screen, level select with locks + best times, pause menu
- [x] Settings: assist mode, mouse sensitivity, camera, sound, FOV

## Status: Phases 0-8 are done. 26 automated tests pass.
Remaining: real-phone testing (Phase 4), the level editor (Phase 9), and the
performance/PWA pass (Phase 10).

## Phase 9 — Level editor (optional, high value)
- [ ] `editor.html` — place/remove blocks, set spawn/checkpoints/goal, export JSON
- [ ] Because levels are already data, this is mostly just UI

## Phase 10 — Performance & ship
- [ ] Frustum culling, verify instancing, one draw call per block material
- [ ] 60 fps target on the phone (test Level 5, the heaviest)
- [ ] Optional: `manifest.json` + service worker so it installs to the phone home
      screen and plays with no internet

---

## Extra ideas worth doing
1. **Ghost replay** — record your best run and race a translucent copy of yourself.
2. **Par time per level** + speedrun timer + death counter.
3. **Assist mode on by default**, purist toggle for later.
4. **Shareable endless seeds.**
5. **Physics tests** so a tweak can never silently break every level.

## Note on Minecraft
This game uses no Mojang files. All textures are drawn by code at runtime and all
sounds are synthesized. It is a *Minecraft-style* game, not Minecraft, and should be
described that way if it is ever shared publicly.
