// 彩蛋：大楼窗户上的俄罗斯方块（来电以后才能玩）
// 来电后楼上一直在放待机演示；玩的时候楼下的人越聚越多，消行拍手，通关放烟花
import * as THREE from 'three';
import { rng } from '../../kit.js';
import { sfx } from '../../audio.js';
import { repairedIn } from '../../state.js';
import { Tetris } from '../../tetris.js';
import { TOWER, TOWER_FRONT, CROWD_SPOTS, STREET_ENDS } from './layout.js';

const LOOK = { wall: '#5b6285', frame: '#3e4463', dark: '#1d2136' };
// 大楼正面中间：围观的人朝这儿看，烟花贴着这面墙放
const FACING = [TOWER.x, TOWER_FRONT];

export function createTowerGame(w, { power, tower, story }) {
  const powered = () => repairedIn('city').includes('sax');
  const crowd = createCrowd(w);

  const boardTex = (board) => {
    const t = { map: new THREE.CanvasTexture(board.map), emissive: new THREE.CanvasTexture(board.emit) };
    t.map.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // 把一块棋盘贴到大楼正面（接管那面墙，电力系统先别管它）
  // glow：发光强度（待机演示亮一点，远远就能看到；真正玩的时候柔和些，颜色看得清）
  const front = tower.front;
  const showOnTower = (t, glow = 0.6) => {
    front.game = true;
    front.mat.map = t.map;
    front.mat.emissiveMap = t.emissive;
    front.mat.emissiveIntensity = glow;
    front.mat.needsUpdate = true;
  };

  // 待机演示：来电以后，楼上的窗户自己一直在落方块，一看就知道这栋楼能玩
  let playing = false;
  let demo = null;
  let demoTex = null;
  w.onUpdate((dt) => {
    if (playing) return;
    if (!(powered() && power.level('city') > 0.7)) {
      front.game = false;
      return;
    }
    if (!demo) {
      demo = new Tetris({ demo: true, look: LOOK });
      demoTex = boardTex(demo);
    }
    if (front.mat.map !== demoTex.map) showOnTower(demoTex, 1.3);
    demo.update(dt);
    if (demo.draw()) demoTex.map.needsUpdate = demoTex.emissive.needsUpdate = true;
  });

  // 走到大楼门口：提示可以玩（手机上没有鼠标悬停，靠这个发现）
  w.interact('tower', new THREE.Object3D(), TOWER.x, TOWER_FRONT + 0.45, {
    reach: 1.3,
    icon: '🎮',
    short: '玩方块',
    label: '玩大楼俄罗斯方块',
    available: powered,
    fn: () => w.env.startGame?.('tetris'),
  });

  let tetris = null;
  let tex = null;
  let won = false;
  let disperseTimer = null;
  const fireworks = () => {
    let n = 0;
    const id = setInterval(() => {
      const p = new THREE.Vector3(FACING[0] + (Math.random() - 0.5) * 2, 0.5 + Math.random() * 4.6, FACING[1] + 0.2);
      w.fx.emit(p, { count: 10, spread: 0.3, size: 0.45, rise: 0.8, color: ['#ff5fa2', '#4ff0ff', '#ffd84a'][n % 3] });
      if (++n > 14) clearInterval(id);
    }, 160);
  };
  w.game('tetris', tower.body, {
    title: '🏢 大楼俄罗斯方块',
    hover: '这栋楼的窗户好像能玩？',
    help: '← → 移动 · ↑ 旋转 · ↓ 加速 · 空格 一落到底 · Esc 不玩了',
    view: { target: [TOWER.x, 2.8, FACING[1]], halfW: 1.3, halfH: 2.7 },
    can: powered,
    start(api) {
      clearTimeout(disperseTimer);
      won = false;
      playing = true;
      crowd.gather();
      tetris = this.board = new Tetris({
        goal: 4,
        look: LOOK,
        onStatus: api.status,
        onLines: crowd.cheer,
        onWin() {
          won = true;
          sfx.fanfare();
          w.setFlag('tetris');
          story.refreshLines();
          // 整面墙放烟花，街上的人都转过来欢呼
          fireworks();
          for (const v of w.villagers) {
            if (!v.pinned) v.face(...FACING);
            v.showBubble('🎉', 6);
          }
          api.exitSoon(2600);
        },
      });
      tex = boardTex(tetris);
      showOnTower(tex);
      // 竖着的“夜猫”招牌会挡住右边几列
      for (const o of tower.sign) o.visible = false;
    },
    update(dt) {
      crowd.update(dt);
      tetris.update(dt);
      if (tetris.draw()) tex.map.needsUpdate = tex.emissive.needsUpdate = true;
    },
    key: (k2) => tetris.key(k2),
    stop() {
      // 交还给待机演示（下一帧接着自己落方块）
      playing = false;
      front.game = false;
      for (const o of tower.sign) o.visible = true;
      // 通关了多欢呼一会儿再散
      disperseTimer = setTimeout(crowd.disperse, won ? 3200 : 400);
      tex.map.dispose();
      tex.emissive.dispose();
      tetris = tex = null;
    },
  });
}

// 围观的人群：先叫街上的熟人，没人了就从街两头来路人；散场时路人走回街边消失
function createCrowd(w) {
  const crowd = []; // { v, extra, x, z }：extra 是从街边走进来的路人
  const leaving = [];
  let timer = 0;
  const r = rng(Date.now() % 100000);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const passerLook = () => ({
    hair: pick(['#2b2b33', '#5a3d2b', '#d8a24a', '#8a4a2b', '#c9c9d4']),
    shirt: pick(['#4fa3ff', '#ff6b8b', '#59d98a', '#ffb84f', '#9a7bff', '#f4f1ea']),
    pants: pick(['#2a2d38', '#3d4a6b', '#5b6b9a', '#4a3a30']),
    ...(r() < 0.4 ? { hat: pick(['cap', 'beanie']), hatColor: pick(['#ff7a3a', '#4ff0ff', '#ffd23f', '#e8443a']) } : {}),
  });
  const pop = (v) => w.fx.emit(v.root.position.clone().setY(v.root.position.y + 0.6), { count: 14, spread: 0.4, rise: 1.2, color: '#ffe9a8' });
  const nearestEnd = (x) => (x < 0 ? STREET_ENDS[0] : STREET_ENDS[1]);
  // 走到街两头就算离开了
  const offStreet = (x) => x < STREET_ENDS[0][0] + 0.3 || x > STREET_ENDS[1][0] - 0.3;

  // 让小人走到某处；poi 为 null 时到了就自己闲逛
  const sendTo = (v, x, z, poi) => {
    v.releasePoi();
    v.hideBubble();
    v.poi = poi;
    v.target = { x, z };
    v.state = 'walk';
    v.stuck = 0;
  };
  // 不顶表情气泡，免得挡住楼下几行；消行时拍手 👏，通关时欢呼 🎉
  const watchPoi = (x, z) => ({ x, z, dur: Infinity, face: Math.atan2(FACING[0] - x, FACING[1] - z) });
  const addWatcher = () => {
    if (crowd.length >= CROWD_SPOTS.length) return;
    const [x, z] = CROWD_SPOTS[crowd.length];
    // 先叫街上的熟人（在吹萨克斯、在睡觉的除外），没人了就来路人
    let v = w.villagers.find((o) => !o.pinned && !crowd.some((c) => c.v === o) && !leaving.includes(o));
    const extra = !v;
    if (extra) {
      const [sx, sz] = r() < 0.5 ? STREET_ENDS[0] : STREET_ENDS[1];
      v = w.villager({ name: '路人', look: passerLook(), lines: ['这栋楼在玩俄罗斯方块！', '加油加油！', '我在楼上加班，窗户突然就亮了。'] }, sx, sz);
      pop(v);
    }
    sendTo(v, x, z, watchPoi(x, z));
    crowd.push({ v, extra, x, z });
  };

  w.onUpdate((dt) => {
    for (let i = leaving.length - 1; i >= 0; i--) {
      const v = leaving[i];
      v.leaveT += dt;
      if (offStreet(v.x) || v.leaveT > 8) {
        pop(v);
        v.root.removeFromParent();
        const j = w.villagers.indexOf(v);
        if (j >= 0) w.villagers.splice(j, 1);
        leaving.splice(i, 1);
      }
    }
  });

  return {
    gather() {
      timer = 1.2;
    },
    cheer() {
      for (const c of crowd) c.v.showBubble('👏', 1.6);
      addWatcher();
    },
    // 每隔一会儿多来一个人；走着走着被挡住、跑去闲逛的，再叫回来
    update(dt) {
      timer -= dt;
      if (timer > 0) return;
      timer = 2.6;
      addWatcher();
      for (const c of crowd) if (!c.v.poi) sendTo(c.v, c.x, c.z, watchPoi(c.x, c.z));
    },
    disperse() {
      for (const c of crowd) {
        if (c.extra) {
          // 路人走回街边，消失
          c.v.leaveT = 0;
          sendTo(c.v, ...nearestEnd(c.v.x), null);
          leaving.push(c.v);
        } else {
          c.v.releasePoi();
          c.v.hideBubble();
          c.v.state = 'idle';
          c.v.timer = r() * 1.2;
        }
      }
      crowd.length = 0;
    },
  };
}
