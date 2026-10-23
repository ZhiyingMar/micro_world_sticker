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
- `src/terrain-soft.js` the rounded, organic look for that terrain (natural worlds use it; the city keeps blocks)
- `src/terrain-voxel.js` the small-voxel look for pixel-style worlds (the pixel town), with `src/voxel.js` for voxel models
- `src/scenes/` one world per file, or one folder per world once it grows (e.g. `scenes/city/`, `scenes/forest/`, `scenes/pixel/`)
- Test scenes open via URL, e.g. `?test=terrain`

## Core Principles

**Evidence > Guess | Root Cause > Workaround | Communication > Action | Correctness > Convenience**

## Game Feel (游戏感)

The target is a **cozy, handcrafted, living diorama** (think Animal Crossing, A Short Hike, Tiny Glade): a miniature world that looks made by hand, is always gently moving, and answers when you touch it. The opposite, what the user called "an intern's practice project", is a tech demo: the logic works, but it's primitives on a visible grid, the same prop copied around, nothing moving, no sound. Logic may be as gridded and simple as it likes; what the player sees and hears must not be. `src/scenes/forest/` is the reference implementation.

**Looks handcrafted**

- **Hide the grid.** Cliffs and corners are rounded, shorelines and paths curve, water is one continuous surface. Natural worlds use `src/terrain-soft.js`; pixel-style worlds use `src/terrain-voxel.js` (small voxels hide the 1×1 cells); big block terrain is only for places meant to be man-made (the city's sidewalks and retaining walls).
- **Variation, not copies.** Anything that repeats comes in a few kinds (tree species, sizes, colors), each placed with its own rotation and scale. Give volumes a dark, base and light shade so they read as 3D, not as flat blobs.
- **Composition is designed, not sprinkled.** Dense at the far edges to frame the scene, open clearings in the middle, only low things near the camera so they don't block the view. Small things grow where they naturally would: flowers by doors, along path edges and around tree trunks, not a uniform random scatter.
- **Landmarks get room to breathe.** Buildings and big features each get their own spot with a clearing around it, linked by paths. Never line them up in a row or pack them into one corner.
- **Finish the edges.** The diorama's sides show soil layers; anything that reaches the edge (a stream, a path) is framed or stopped by props instead of being cut off.

**Feels alive**

- **Something is always moving:** wind in the foliage, flowing water, small creatures (butterflies, fish). Even a still frame should look like it's about to move.
- **Every world has its own sound and light:** an `ambient` sound in the world definition, and a time-of-day light: a warm key light from the front-left so the faces toward the camera are lit and shadows trail away, plus a cooler sky fill so the shadow side doesn't go grey.

**Answers your touch (game feel / "juice")**

- When the player steps on, bumps into or walks near something, it reacts right away with motion (squash and stretch, wobble, flee), particles and a sound. Footsteps follow the walk cycle (`villager.phase`), not a timer, so they land on the steps.
- Reactions are cosmetic: they never change progress or the save.
- Keep reactions readable at play zoom: scale small creatures up, and keep collectibles visually distinct from decoration (orange pickup mushrooms vs. red decorative toadstools).

**Check it like a player.** After a visual change, look at both the overview and play-height zoom, walk the routes, and ask: would this pass as a screenshot from a cozy indie game, or does it look like a tech demo? Red flags: a visible grid, one model copied many times, uniform random scatter, nothing moving, silence, flat noon light, props lined up in a row, things cut off at the edges.

**Budget:** hundreds of small things (flowers, grass) go through `InstancedMesh`. Around 250k triangles per world is fine on desktop; check on a phone when a world grows past that.

## Code Organization

Keep code split by logic. A file or function should do one job and be readable on its own.

- **Split a world by concern, not by size.** When a scene grows past a few hundred lines, turn it into a folder: layout (terrain map and named positions), props (pure model builders), and one module per system or story thread (power, traffic, quest, mini-game…). The scene's `build(world)` should read like a table of contents that wires those modules together.
- **Logic and visuals stay separate.** Heights, walkability, colliders and positions are data; meshes are placed from that data. Swapping a code-built placeholder for a model must not touch the logic.
- **No magic numbers.** No unexplained fixed values. Positions, sizes and tuning values live in named constants near the top of the module (or in the world's layout file), with a comment saying what they mean in the game. Derive dependent values from them instead of repeating literals. Never hardcode the world's size (10×10 and friends); read it from `world.size` / `world.bounds` / the terrain.
- **Place things on the ground with `world.heightAt(x, z)`**, never with a hardcoded `y = 0`, so they still sit right when the terrain changes.
- **Context integrity.** Pass the data a function needs explicitly. Don't reach for module-level globals or guessed values to fill a gap.
- **Modules talk through small explicit APIs** (return an object with a few named functions / fields) rather than sharing a pile of local variables inside one giant closure.
- **Model builders are pure:** take the kit and options, return a `THREE.Group`; placing it and registering colliders happens at the call site.
- **Fix the root cause.** Never patch symptoms; trace where the state or data goes wrong.
- **Document tech debt.** A temporary hack gets a comment saying why it's there, its limits, and what the proper fix is, plus a `console.warn()` when it's hit at runtime.

## Readability

These rules apply to code written from now on. Existing code that breaks them stays as it is for now; don't rewrite it just for style.

- **Meaningful names, no single letters or opaque abbreviations.** Name things by what they hold: `material`, not `m`; `world`, not `w`; `kit`, not `k`; `villager`, not `v`; `workCopy`, not `tmp2`. The only exceptions are coordinates (`x`, `y`, `z`) and simple loop counters (`i`, `j`).

  ```js
  // ✗
  let m = matCache.get(key);
  // ✓
  let material = materialCache.get(key);
  ```

- **Always use braces for `if` / `else if` / `else` / `for` / `while`,** even when the body is one statement. Put the body on its own line.

  ```js
  // ✗
  if (style === 'toon') m = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient(), ...opts });
  else m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...opts });

  // ✓
  if (style === 'toon') {
    material = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient(), ...opts });
  } else {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...opts });
  }
  ```

- **Don't pack several conditions into one expression.** No nested ternaries, no ternaries whose condition combines `||` / `&&`. Give the condition a name, or use `if` / `else`. A ternary is fine only for one simple condition picking between two simple values.

  ```js
  // ✗
  const geo = this.pixel || rr <= 0.001 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 3, rr);

  // ✓
  // 像素风和几乎没有圆角时，用普通方块就够了
  const sharpCorners = this.pixel || radius <= 0.001;
  let geometry;
  if (sharpCorners) {
    geometry = new THREE.BoxGeometry(width, height, depth);
  } else {
    geometry = new RoundedBoxGeometry(width, height, depth, 3, radius);
  }
  ```

- **At most 3 levels of nested loops.** If it would go deeper, pull the inner loops into a function named for what it walks over (e.g. `buildTerrainRow` for map rows → cells).

- **Split a function body into logical blocks with blank lines,** e.g. read inputs → compute → apply → return. A function over ~8 lines with no blank lines is a smell. If a block needs a heading comment to be understood, consider pulling it out into its own function.

- **Every function gets a structured JSDoc comment (in Chinese).** A one-sentence summary first; then an optional `@description` for the *why* (game reason, not "what the code does"); then one `@param` per parameter (what it holds, units or allowed values when not obvious) and `@returns` for what comes back (omit when nothing is returned). One fact per tag line; don't pack parameter meanings into one dense sentence. Functions without parameters need only the summary.

  ```js
  /**
   * 在世界里摆一盏路灯，并让它跟着 street 电力开关
   * @description 停电时路灯全黑，车流动起来以后才一盏盏亮，提示玩家路通了
   * @param {World} world 要摆进去的世界
   * @param {number} x 灯杆的 x 坐标
   * @param {number} z 灯杆的 z 坐标
   * @param {number} facing 灯头朝向，弧度，0 朝 +x
   * @returns {{ bulb, halo, light }} 电力系统要控制的几个部件
   */
  function placeLamp(world, x, z, facing) {
  ```

  Small inline arrow functions passed as callbacks (`list.map((item) => ...)`) don't need a comment. Inside functions, keep comments short and about *why*, not *what*.

- **Comments explain the current game reason** and must make sense on their own, without pointing readers to other records (no "see TODO section 3" as the only explanation).

## Error Handling

- No silent failures: `catch (e) {}`, `catch (e) { return; }`, `catch (e) { return []; }` are forbidden in new code.
- Errors must be thrown, logged, or flagged. When a failure is genuinely safe to continue past (e.g. `localStorage` blocked in private mode), say why in a comment and `console.warn()` it.

## Communication & Process

- **Plan before larger changes:** for anything beyond a small fix, first lay out the current state, the plan, the files affected, and the risks.
- **No unapproved large refactors:** no mass rewrites, changes to how worlds/saves are structured, or deleting old code paths (e.g. legacy save handling) without the user's OK.
- **Independent evaluation:** evaluate any proposed solution (the user's, or one in `TODO.md`) before acting on it: what problem it solves, whether there's a better option. Push back with evidence when it seems wrong; don't blindly follow, and don't object just to seem assertive.
- **Stuck? Say so right away.** If a command or the dev server hangs, or the browser check can't be done, tell the user what is stuck and the suspected reason instead of waiting silently.
- **Verify in the browser:** after changing anything visible, run the dev server and check it (console errors, a screenshot, walk around the affected area). Report what was and wasn't verified.
- **Old saves must keep working:** when changing progress flags, repairs or items, stay compatible with existing save data (see `src/state.js` and the legacy handling in scenes). If you change the save in the browser while testing, restore it afterwards.

## Git

- **Atomic commits, right away:** commit each logical change as soon as it's done (a code change, a doc update, a config change), with a short Chinese message describing it. Don't let uncommitted work pile up; if interrupted, commit what's done first.
- **Commit the user's changes first:** if the working tree has uncommitted changes the user made, commit them as their own commit before starting; never mix them into your commits or stash them away.
- **Don't push unless asked.**
- **No force commands:** `git push --force` / `-f`, `npm install --force` are forbidden. If one is truly needed, explain why, the exact command, the risks and alternatives, and wait for approval.

## Pre-Commit Checklist

- No magic numbers, no silent errors
- New code follows the readability rules
- No unapproved large refactors
- Old saves still load
- Checked in the browser (or said why not)
- Visible changes pass the Game Feel check (overview and play-height zoom, no red flags)
- Tech debt commented
- No `--force` used
