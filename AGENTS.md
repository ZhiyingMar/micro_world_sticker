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

## Readability

These rules apply to all new and changed code. When touching old code that breaks them, fix the parts you touch.

- **No single-letter names.** Name things by what they are: `material`, not `m`; `world`, not `w`; `kit`, not `k`; `villager`, not `v`. The only exceptions are coordinates (`x`, `y`, `z`) and simple loop counters (`i`, `j`).

  ```js
  // ✗
  let m = matCache.get(key);
  // ✓
  let material = materialCache.get(key);
  ```

- **Always use braces for `if` / `else` / `for` / `while`,** even when the body is one line. Put the body on its own line.

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

- **Don't pack several conditions into one expression.** No ternaries with `||` / `&&` conditions, no nested ternaries. Give the condition a name, or use `if` / `else`. A ternary is fine only for one simple condition picking between two simple values.

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

- **Split a function body into logical blocks with blank lines,** e.g. read inputs → compute → apply → return. A function with no blank lines over ~8 lines is a smell. If a block needs a heading comment to be understood, consider pulling it out into its own function.

- **Every function gets a comment (in Chinese)** saying what it does, written above it. If it takes parameters, document each one with JSDoc `@param` (what it means, units or allowed values when not obvious). Functions without parameters need only the description. Also comment the return value when it isn't obvious.

  ```js
  /**
   * 在世界里摆一盏路灯，并让它跟着 street 电力开关
   * @param {World} world 要摆进去的世界
   * @param {number} x 灯杆位置
   * @param {number} z 灯杆位置
   * @param {number} facing 灯头朝向（弧度，0 朝 +x）
   * @returns {{ bulb, halo, light }} 电力系统要控制的几个部件
   */
  function placeLamp(world, x, z, facing) {
  ```

  Small inline arrow functions passed as callbacks (`list.map((item) => ...)`) don't need a comment. Inside functions, keep comments short and about *why*, not *what*.

## Workflow

- Commit locally after each change round with a short Chinese message describing the change. Don't push unless asked.
- After changing anything visible, run the dev server and check it in the browser (console errors, a screenshot, walk around the affected area).
- Old saves must keep working: when changing progress flags or repairs, keep compatibility with existing save data (see `src/state.js` and the legacy handling in scenes).
