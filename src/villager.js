import * as THREE from 'three';
import { makeBubble, bubbleTexture } from './fx.js';

const IDLE_EMOTES = ['♪', '…', '✿', '?', '♥'];

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Villager {
  constructor(world, opts) {
    this.world = world;
    this.name = opts.name;
    this.lines = opts.lines || [];
    this.lineIdx = 0;
    this.speed = opts.speed || 0.85;
    this.radius = 0.22;
    this.controlled = !!opts.controlled;

    this.root = new THREE.Group();
    this.root.userData.villager = this;
    this.voxel = world.kit.pixel;
    this.buildBody(opts.look || {});

    this.bubble = makeBubble();
    this.bubble.position.y = 1.45;
    this.root.add(this.bubble);
    this.bubbleTimer = 0;

    this.state = 'idle';
    this.timer = 0.5 + Math.random() * 2;
    this.target = null;
    this.poi = null;
    this.stuck = 0;
    this.avoidSide = Math.random() < 0.5 ? 1 : -1;
    this.heading = Math.random() * Math.PI * 2;
    this.root.rotation.y = this.heading;
    this.phase = Math.random() * 10;
    this.moving = 0;
    this.sitting = false;
    this.moveTarget = null;
  }

  get x() {
    return this.root.position.x;
  }
  get z() {
    return this.root.position.z;
  }

  // ---------------- 外形 ----------------
  buildBody(look) {
    const k = this.world.kit;
    const c = {
      skin: '#ffe0c2',
      hair: '#7a4b2a',
      shirt: '#f6a6b8',
      pants: '#5b6b9a',
      shoes: '#5a3d2b',
      hatColor: '#e85d5d',
      ...look,
    };
    const body = new THREE.Group();
    this.body = body;
    this.root.add(body);

    const legGeo = (pivot, x) => {
      pivot.position.set(x, 0.2, 0);
      if (this.voxel) {
        const leg = k.box(0.11, 0.2, 0.12, c.pants);
        leg.position.y = -0.1;
        pivot.add(leg);
      } else {
        const leg = k.cyl(0.055, 0.06, 0.2, c.pants, 12);
        leg.position.y = -0.1;
        const shoe = k.sphere(0.07, c.shoes, 12);
        shoe.scale.set(1, 0.6, 1.3);
        shoe.position.set(0, -0.19, 0.02);
        pivot.add(leg, shoe);
      }
      body.add(pivot);
      return pivot;
    };
    this.legL = legGeo(new THREE.Group(), -0.08);
    this.legR = legGeo(new THREE.Group(), 0.08);

    const torso = this.voxel ? k.box(0.34, 0.3, 0.22, c.shirt) : k.cyl(0.13, 0.19, 0.32, c.shirt, 16);
    torso.position.y = 0.36;
    body.add(torso);

    const armGeo = (x, side) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.49, 0);
      pivot.rotation.z = side * 0.18;
      if (this.voxel) {
        const arm = k.box(0.09, 0.24, 0.1, c.shirt);
        arm.position.y = -0.1;
        const hand = k.box(0.09, 0.07, 0.1, c.skin);
        hand.position.y = -0.25;
        pivot.add(arm, hand);
      } else {
        const arm = k.cyl(0.04, 0.05, 0.2, c.shirt, 10);
        arm.position.y = -0.1;
        const hand = k.sphere(0.05, c.skin, 10);
        hand.position.y = -0.22;
        pivot.add(arm, hand);
      }
      body.add(pivot);
      return pivot;
    };
    this.armL = armGeo(this.voxel ? -0.22 : -0.18, -1);
    this.armR = armGeo(this.voxel ? 0.22 : 0.18, 1);

    const head = new THREE.Group();
    head.position.y = this.voxel ? 0.74 : 0.76;
    this.head = head;
    body.add(head);

    if (this.voxel) {
      head.add(k.box(0.44, 0.4, 0.4, c.skin));
      const hair = k.box(0.46, 0.12, 0.42, c.hair);
      hair.position.y = 0.17;
      const back = k.box(0.46, 0.3, 0.1, c.hair);
      back.position.set(0, 0.04, -0.17);
      head.add(hair, back);
      for (const s of [-1, 1]) {
        const eye = k.box(0.06, 0.09, 0.02, '#2b211c');
        eye.position.set(s * 0.1, 0, 0.205);
        const blush = k.box(0.08, 0.04, 0.02, '#ff9ea8');
        blush.position.set(s * 0.15, -0.08, 0.205);
        head.add(eye, blush);
      }
    } else {
      head.add(k.sphere(0.27, c.skin, 24));
      const hair = k.dome(0.285, c.hair, 1.35, 24);
      hair.rotation.x = -0.35;
      head.add(hair);
      for (const s of [-1, 1]) {
        const eye = k.sphere(0.034, '#2b211c', 10);
        eye.scale.set(1, 1.45, 0.6);
        eye.position.set(s * 0.09, -0.01, 0.245);
        const blush = k.cyl(0.042, 0.042, 0.01, '#ffb0b0', 12);
        blush.rotation.x = Math.PI / 2;
        blush.position.set(s * 0.155, -0.075, 0.222);
        blush.rotation.y = s * 0.55;
        blush.castShadow = false;
        head.add(eye, blush);
      }
    }
    this.addHat(look.hat, c);
    if (look.umbrella) this.addUmbrella(look.umbrella);
  }

  // 撑着的雨伞：右手举着，伞面在头顶
  addUmbrella(color) {
    const k = this.world.kit;
    const g = new THREE.Group();
    const stick = k.cyl(0.015, 0.015, 0.95, '#3a3a3a', 6);
    stick.position.y = 0.47;
    const canopy = k.mesh(new THREE.ConeGeometry(0.62, 0.28, 10, 1, true), k.m(color, { side: THREE.DoubleSide }));
    canopy.position.y = 1.0;
    const tip = k.sphere(0.03, '#3a3a3a', 6);
    tip.position.y = 1.16;
    const handle = k.torus(0.05, 0.015, '#6b4f3a');
    handle.scale.set(1, 1, 1);
    handle.position.set(0.05, 0, 0);
    g.add(stick, canopy, tip, handle);
    g.position.set(0.14, 0.42, 0.06);
    g.rotation.z = -0.08;
    this.body.add(g);
    this.umbrella = g;
  }

  addHat(type, c) {
    if (!type) return;
    const k = this.world.kit;
    const h = this.head;
    if (type === 'gnome') {
      const hat = k.cone(0.29, 0.55, c.hatColor, 20);
      hat.position.set(0, 0.36, -0.02);
      hat.rotation.x = -0.2;
      hat.rotation.z = 0.12;
      const brim = k.torus(0.25, 0.04, c.hatColor);
      brim.rotation.x = Math.PI / 2 - 0.2;
      brim.position.set(0, 0.13, -0.01);
      h.add(hat, brim);
    } else if (type === 'leaf') {
      const leaf = k.sphere(0.12, '#6fc46a', 12);
      leaf.scale.set(1.3, 0.25, 0.7);
      leaf.position.set(0.04, 0.3, 0);
      leaf.rotation.z = -0.4;
      const stem = k.cyl(0.012, 0.012, 0.08, '#4f9a4a', 6);
      stem.position.set(-0.04, 0.28, 0);
      h.add(leaf, stem);
    } else if (type === 'bow') {
      for (const s of [-1, 1]) {
        const b = k.sphere(0.08, c.hatColor, 12);
        b.scale.set(1.2, 0.8, 0.5);
        b.position.set(0.12 + s * 0.08, 0.22, 0.05);
        h.add(b);
      }
      const knot = k.sphere(0.04, c.hatColor, 10);
      knot.position.set(0.12, 0.22, 0.07);
      h.add(knot);
    } else if (type === 'mushroom') {
      const cap = k.dome(0.36, c.hatColor, Math.PI / 2, 24);
      cap.scale.y = 0.75;
      cap.position.y = 0.12;
      h.add(cap);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const dot = k.sphere(0.05, '#ffffff', 8);
        dot.scale.y = 0.4;
        dot.position.set(Math.cos(a) * 0.22, 0.3, Math.sin(a) * 0.22);
        dot.lookAt(dot.position.clone().multiplyScalar(3));
        h.add(dot);
      }
    } else if (type === 'cap') {
      if (this.voxel) {
        const top = k.box(0.48, 0.12, 0.44, c.hatColor);
        top.position.y = 0.24;
        const brim = k.box(0.4, 0.04, 0.16, c.hatColor);
        brim.position.set(0, 0.2, 0.26);
        h.add(top, brim);
      } else {
        const top = k.dome(0.29, c.hatColor, Math.PI / 2, 20);
        top.position.y = 0.06;
        const brim = k.cyl(0.16, 0.16, 0.025, c.hatColor, 16);
        brim.scale.z = 1.4;
        brim.position.set(0, 0.07, 0.25);
        h.add(top, brim);
      }
    } else if (type === 'tophat') {
      const crown = k.cyl(0.17, 0.18, 0.3, c.hatColor, 18);
      crown.position.y = 0.38;
      const brim = k.cyl(0.29, 0.29, 0.025, c.hatColor, 20);
      brim.position.y = 0.23;
      const band = k.cyl(0.182, 0.182, 0.06, '#c8102e', 18);
      band.position.y = 0.27;
      h.add(crown, brim, band);
    } else if (type === 'busby') {
      const fur = k.cyl(0.26, 0.3, 0.6, '#1c1c22', 18);
      fur.position.y = 0.36;
      const top = k.sphere(0.26, '#1c1c22', 16);
      top.scale.y = 0.4;
      top.position.y = 0.66;
      const strap = k.torus(0.27, 0.015, '#d4a82a');
      strap.rotation.y = Math.PI / 2;
      strap.position.y = -0.05;
      h.add(fur, top, strap);
    } else if (type === 'beanie') {
      const top = this.voxel ? k.box(0.48, 0.16, 0.44, c.hatColor) : k.dome(0.29, c.hatColor, Math.PI / 2, 20);
      top.position.y = this.voxel ? 0.25 : 0.05;
      const pom = this.voxel ? k.box(0.1, 0.1, 0.1, '#ffffff') : k.sphere(0.07, '#ffffff', 10);
      pom.position.y = this.voxel ? 0.37 : 0.33;
      h.add(top, pom);
    }
  }

  // ---------------- 气泡 ----------------
  showBubble(text, dur = 0) {
    this.bubble.material.map = bubbleTexture(text);
    this.bubble.material.needsUpdate = true;
    this.bubble.visible = true;
    this.bubbleTimer = dur;
  }

  hideBubble() {
    this.bubble.visible = false;
    this.bubbleTimer = 0;
  }

  // ---------------- 移动 ----------------
  moveToward(tx, tz, dt, speed) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.06) return true;
    const step = Math.min(d, speed * dt);
    const w = this.world;
    const p = this.root.position;
    const base = Math.atan2(dx, dz);
    // 正前方被挡住时，左右逐步偏转绕过去（偏向一侧，避免来回抖）
    let moved = false;
    for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35]) {
      const a = base + off * this.avoidSide;
      const nx = p.x + Math.sin(a) * step;
      const nz = p.z + Math.cos(a) * step;
      if (!w.blocked(nx, nz, this.radius, this)) {
        p.x = nx;
        p.z = nz;
        this.heading = a;
        moved = true;
        this.stuck = off === 0 ? Math.max(0, this.stuck - dt) : this.stuck + dt * 0.15;
        break;
      }
    }
    if (!moved) {
      this.stuck += dt;
      this.heading = base;
      if (Math.random() < 0.1) this.avoidSide *= -1;
    }
    this.moving = 1;
    return false;
  }

  face(x, z) {
    this.heading = Math.atan2(x - this.x, z - this.z);
  }

  setSit(on, seatY = 0) {
    this.sitting = on;
    this.root.position.y = on ? seatY - 0.15 : 0;
  }

  // ---------------- 日常 AI ----------------
  chooseNext() {
    const w = this.world;
    if (Math.random() < 0.55) {
      const free = w.pois.filter((p) => !p.taken);
      if (free.length) {
        const poi = free[Math.floor(Math.random() * free.length)];
        poi.taken = this;
        this.poi = poi;
        this.target = { x: poi.x, z: poi.z };
        this.state = 'walk';
        this.stuck = 0;
        return;
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 3;
      const x = this.x + Math.cos(a) * r;
      const z = this.z + Math.sin(a) * r;
      if (!w.blocked(x, z, this.radius + 0.1, this)) {
        this.target = { x, z };
        this.state = 'walk';
        this.stuck = 0;
        return;
      }
    }
    this.timer = 1;
  }

  // 钉在原地做一件事（睡觉、发呆……），直到 unpin
  pin({ emote, sit = false, seatY = 0, face } = {}) {
    this.releasePoi();
    this.pinned = true;
    this.poi = { x: this.x, z: this.z, dur: Infinity, emote, sit, seatY, face };
    this.state = 'act';
    this.timer = Infinity;
    if (face !== undefined) this.heading = face;
    if (emote) this.showBubble(emote);
    else this.hideBubble();
    if (sit) this.setSit(true, seatY);
  }

  unpin() {
    this.pinned = false;
    this.releasePoi();
    this.hideBubble();
    this.state = 'idle';
    this.timer = 0.4;
  }

  releasePoi() {
    if (this.poi) this.poi.taken = null;
    this.poi = null;
    if (this.sitting) this.setSit(false);
  }

  ai(dt) {
    switch (this.state) {
      case 'idle':
        this.moving = 0;
        this.timer -= dt;
        if (this.timer <= 0) this.chooseNext();
        break;
      case 'walk': {
        const arrived = this.moveToward(this.target.x, this.target.z, dt, this.speed);
        if (arrived) {
          if (this.poi) {
            this.state = 'act';
            this.timer = this.poi.dur * (0.7 + Math.random() * 0.6);
            if (this.poi.face !== undefined) this.heading = this.poi.face;
            if (this.poi.emote) this.showBubble(this.poi.emote);
            if (this.poi.sit) this.setSit(true, this.poi.seatY);
          } else {
            this.state = 'idle';
            this.timer = 1.5 + Math.random() * 3;
            if (Math.random() < 0.3) this.showBubble(IDLE_EMOTES[Math.floor(Math.random() * IDLE_EMOTES.length)], 1.6);
          }
          this.moving = 0;
        } else if (this.stuck > 0.8) {
          this.releasePoi();
          this.state = 'idle';
          this.timer = 0.3;
        }
        break;
      }
      case 'act':
        this.moving = 0;
        this.timer -= dt;
        if (this.timer <= 0) {
          this.releasePoi();
          this.hideBubble();
          this.state = 'idle';
          this.timer = 0.8 + Math.random() * 1.5;
        }
        break;
      case 'talk':
        this.moving = 0;
        break;
    }
  }

  startTalk(fx, fz) {
    if (this.state === 'talk') return;
    this.talkSeated = this.sitting || this.pinned;
    if (this.talkSeated) {
      // 坐着的人不站起来（否则会卡进椅子里），只把头转过来
      let d = Math.atan2(fx - this.x, fz - this.z) - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.headTurn = THREE.MathUtils.clamp(d, -1.1, 1.1);
    } else {
      this.releasePoi();
      this.face(fx, fz);
    }
    this.state = 'talk';
    this.showBubble('!', 0);
  }

  endTalk() {
    if (this.state !== 'talk') return;
    this.headTurn = 0;
    if (this.talkSeated && this.poi) {
      // 聊完接着坐，继续刚才在做的事
      this.state = 'act';
      this.timer = Math.max(this.timer, 2.5);
      if (this.poi.emote) this.showBubble(this.poi.emote);
      else this.hideBubble();
    } else {
      this.state = 'idle';
      this.timer = 1.2 + Math.random();
      this.hideBubble();
    }
    this.talkSeated = false;
  }

  nextLine() {
    if (!this.lines.length) return '……';
    const line = this.lines[this.lineIdx % this.lines.length];
    this.lineIdx++;
    return line;
  }

  // ---------------- 玩家操控 ----------------
  control(dt, input) {
    let ix = 0;
    let iz = 0;
    if (input.left) ix -= 1;
    if (input.right) ix += 1;
    if (input.up) iz -= 1;
    if (input.down) iz += 1;
    let mag = ix || iz ? 1 : 0;
    // 虚拟摇杆：模拟量，推得越远走得越快
    const jl = Math.hypot(input.ax || 0, input.az || 0);
    if (jl > 0.15) {
      ix = input.ax;
      iz = input.az;
      mag = Math.min(1, jl);
    }
    if (mag) {
      this.moveTarget = null;
      const l = Math.hypot(ix, iz);
      this.moveToward(this.x + (ix / l) * 2, this.z + (iz / l) * 2, dt, this.speed * (0.35 + 0.65 * mag));
    } else if (this.moveTarget) {
      if (this.moveToward(this.moveTarget.x, this.moveTarget.z, dt, this.speed) || this.stuck > 1.2) {
        this.moveTarget = null;
        this.stuck = 0;
      }
    } else {
      this.moving = 0;
    }
  }

  // ---------------- 每帧 ----------------
  update(dt, t, input) {
    if (this.controlled) this.control(dt, input);
    else this.ai(dt);

    this.root.rotation.y = lerpAngle(this.root.rotation.y, this.heading, 1 - Math.exp(-dt * 10));

    const m = this.moving;
    this.phase += dt * (this.controlled ? 13 : 10) * (m ? 1 : 0);
    const swing = Math.sin(this.phase) * 0.7 * m;
    if (this.sitting) {
      this.legL.rotation.x = this.legR.rotation.x = -1.45;
      this.armL.rotation.x = this.armR.rotation.x = -0.5;
      this.body.position.y = 0;
    } else {
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.8;
      this.armR.rotation.x = this.umbrella ? -0.9 : swing * 0.8;
      this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.04 * m;
    }
    this.head.rotation.z = Math.sin(t * 1.3 + this.phase) * 0.05;
    this.head.rotation.x = this.state === 'talk' ? -0.08 : 0;
    this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, this.headTurn || 0, 1 - Math.exp(-dt * 8));

    if (this.bubble.visible) {
      this.bubble.position.y = 1.45 + Math.sin(t * 3) * 0.03;
      if (this.bubbleTimer > 0) {
        this.bubbleTimer -= dt;
        if (this.bubbleTimer <= 0) this.hideBubble();
      }
    }
  }
}
