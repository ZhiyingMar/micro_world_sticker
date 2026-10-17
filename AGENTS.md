# AGENTS.md

Guidance for AI coding agents working on this repo. The game itself, its UI text and code comments are in Chinese; keep it that way. `TODO.md` holds the agreed plans and specs; read it before larger changes.

## Project

A browser game built with Three.js + Vite (plain ES modules, no framework, no TypeScript).

```bash
npm install
npm run dev     # Vite dev server
npm run build   # static build into dist/
```

- `src/main.js` rendering, camera, input, collecting and switching worlds
- `src/world.js` one world's container: colliders, items, villagers, repairs, pathfinding
- `src/terrain.js` height map from a text map (see the spec in `TODO.md`, section 0)
- `src/scenes/` one world per file, or one folder per world once it grows (e.g. `scenes/city/`)
- Test scenes open via URL, e.g. `?test=terrain`

## Code organization

Keep code split by logic. A file or function should do one job and be readable on its own.

- **Split a world by concern, not by size.** When a scene grows past a few hundred lines, turn it into a folder: layout (terrain map and named positions), props (pure model builders), and one module per system or story thread (power, traffic, quest, mini-game…). The scene's `build(w)` should read like a table of contents that wires those modules together.
- **Logic and visuals stay separate.** Heights, walkability, colliders and positions are data; meshes are placed from that data. Swapping a code-built placeholder for a model must not touch the logic.
- **No magic numbers scattered through code.** Positions, sizes and tuning values live in named constants near the top of the module (or in the world's layout file). Derive dependent values from them instead of repeating literals. Never hardcode the world's size (10×10 and friends); read it from `w.size` / `w.bounds` / the terrain.
- **Place things on the ground with `w.heightAt(x, z)`**, never with a hardcoded `y = 0`, so they still sit right when the terrain changes.
- **Modules talk through small explicit APIs** (return an object with a few named functions / fields) rather than sharing a pile of local variables inside one giant closure.
- **Model builders are pure:** take the kit and options, return a `THREE.Group`; placing it and registering colliders happens at the call site.
- Match the surrounding style: short Chinese comments that explain *why*, not *what*; no comment noise.

## Workflow

- Commit locally after each change round with a short Chinese message describing the change. Don't push unless asked.
- After changing anything visible, run the dev server and check it in the browser (console errors, a screenshot, walk around the affected area).
- Old saves must keep working: when changing progress flags or repairs, keep compatibility with existing save data (see `src/state.js` and the legacy handling in scenes).
