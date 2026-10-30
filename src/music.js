// 收音机里放的轻音乐：没有录好的曲子，照着和弦进行现场编，一首接一首放下去
// 一首歌四句：A A' B A。第一句的旋律后面还会再出现，听起来像一首写好的小曲，不是一串随机的音
// 白天是 4/4 拍的轻快小曲；夜里换成 3/4 拍的摇篮曲，伴奏是八音盒那样一个个往上数的分解和弦
// 这里只管编曲、按时间排音；什么时候开关、白天还是夜里，由用它的地方（小屋的收音机）决定
import { sfx } from './audio.js';

// 和弦：根音（MIDI 音高，低音那一八度）和组成音（离根音几个半音：根音、三音、五音、七音或六音）；都在 C 大调里
const CHORDS = {
  Cmaj7: { root: 48, intervals: [0, 4, 7, 11] },
  Dm7: { root: 50, intervals: [0, 3, 7, 10] },
  Em7: { root: 52, intervals: [0, 3, 7, 10] },
  Fmaj7: { root: 53, intervals: [0, 4, 7, 11] },
  G6: { root: 55, intervals: [0, 4, 7, 9] },
  Am7: { root: 57, intervals: [0, 3, 7, 10] },
};
// 一首歌最后停在哪个和弦上：主和弦，听起来"唱完了"
const HOME_CHORD = 'Cmaj7';
// 和弦里稳的那几个音（根音、三音、五音），一句话收尾时落在它们上面
const STABLE_TONES = 3;
// 旋律平时用的音阶：C 大调五声音阶（离 C 几个半音），怎么连都不难听
const PENTATONIC = [0, 2, 4, 7, 9];
const SEMITONES_PER_OCTAVE = 12;
// MIDI 音高换成赫兹：A4（69 号）是 440 赫兹
const A4_MIDI = 69;
const A4_FREQUENCY = 440;

// 白天、夜里两种曲风
//   tempo：每分钟几拍；beatsPerBar：一小节几拍；strongBeats：哪几拍是重拍（旋律在重拍上落在和弦音上）
//   progressions：和弦进行，一句四小节、一小节一个和弦，每首歌挑一种
//   melodyRange：旋律在哪两个音之间（MIDI）
//   rhythms：旋律一小节里的节奏，[第几拍开始, 占几拍]；cadences：每句最后一小节，音少、最后一个拖长
//   restChance：一小节旋律整个空着的机会（夜里留白多一些）
//   accompaniment：伴奏怎么弹：strum 低音加扫和弦，arpeggio 八音盒那样一个个往上数
const STYLES = {
  day: {
    tempo: 76,
    beatsPerBar: 4,
    strongBeats: [0, 2],
    progressions: [
      ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
      ['Cmaj7', 'Am7', 'Fmaj7', 'G6'],
      ['Fmaj7', 'G6', 'Em7', 'Am7'],
      ['Cmaj7', 'Em7', 'Fmaj7', 'G6'],
    ],
    melodyRange: [72, 86],
    rhythms: [
      [[0, 1], [1, 1], [2, 2]],
      [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]],
      [[0, 2], [2.5, 0.5], [3, 1]],
      [[0.5, 0.5], [1, 1], [2, 1.5], [3.5, 0.5]],
      [[0, 1], [1.5, 1], [2.5, 1.5]],
      [[0, 3], [3, 1]],
    ],
    cadences: [
      [[0, 1], [1, 3]],
      [[0, 4]],
      [[0, 0.5], [0.5, 0.5], [1, 3]],
    ],
    restChance: 0.1,
    accompaniment: 'strum',
  },
  night: {
    tempo: 58,
    beatsPerBar: 3,
    strongBeats: [0],
    progressions: [
      ['Cmaj7', 'Fmaj7', 'Cmaj7', 'G6'],
      ['Am7', 'Fmaj7', 'Cmaj7', 'G6'],
      ['Fmaj7', 'Cmaj7', 'Dm7', 'G6'],
    ],
    melodyRange: [67, 81],
    rhythms: [
      [[0, 2], [2, 1]],
      [[0, 1], [1, 1], [2, 1]],
      [[0, 3]],
      [[0, 1.5], [1.5, 0.5], [2, 1]],
    ],
    cadences: [
      [[0, 3]],
      [[0, 1], [1, 2]],
    ],
    restChance: 0.25,
    accompaniment: 'arpeggio',
  },
};

// 一首歌：四句按这个顺序（同一个名字是同一句旋律；A2 是 A 换了最后一小节）
const SONG_FORM = ['A', 'A2', 'B', 'A'];
const BARS_PER_PHRASE = 4;
// 一首放完：停在主和弦上收一小节，再空几小节放下一首（像电台换歌）
const GAP_BARS = 1;

// 挑下一个旋律音：最远跳几个半音（五度，再远就唱不顺了）；跳得越远越不容易选中（跳几个半音时机会减半）；同一个音不太重复
const MAX_LEAP = 7;
const LEAP_SOFTNESS = 3;
const REPEAT_WEIGHT = 0.25;

// 白天的伴奏：低音在第几拍、占几拍，第二下有多大机会弹五音（不然还是根音）；和弦在哪几拍扫、占几拍、多响
const DAY_BASS = [[0, 2], [2, 2]];
const BASS_FIFTH_CHANCE = 0.5;
const DAY_STRUMS = [[0, 2.5, 1], [2.5, 1.5, 0.6]];
// 扫和弦时几个音一个接一个，隔多久（秒）
const STRUM_GAP = 0.025;
// 伴奏的和弦摆在哪个音以下（MIDI，C5）：低音弹根音，和弦只弹上面三个音，不和旋律挤在一起
const KEYS_TOP = 72;
// 夜里的分解和弦：一小节里按八分音符走，依次弹和弦里第几个音（往上数再往下回）；根音那一下长一点、重一点
const ARPEGGIO_ORDER = [0, 1, 2, 3, 2, 1];
const ARPEGGIO_STEP = 0.5;
const ARPEGGIO_ROOT = { length: 3, velocity: 1.4 };

// 几种乐器：wave 波形；volume 多响；attack 多快响到最响（秒）
//   partials：一起响的几个泛音，[几倍的频率, 多响, 响多久]（后两个是乘在这个音上的比例），都是一下拨响、慢慢变弱
const INSTRUMENTS = {
  // 旋律：八音盒 / 电钢琴那样"叮"的一声，高一个八度的泛音很快就没了
  bell: { wave: 'sine', volume: 0.05, attack: 0.004, partials: [[1, 1, 1], [2, 0.22, 0.35], [3, 0.07, 0.18]] },
  // 白天的和弦：软软的三角波
  keys: { wave: 'triangle', volume: 0.016, attack: 0.02, partials: [[1, 1, 1]] },
  // 白天的低音：圆圆的正弦波
  bass: { wave: 'sine', volume: 0.07, attack: 0.03, partials: [[1, 1, 1]] },
  // 夜里的分解和弦：轻轻的八音盒
  musicBox: { wave: 'sine', volume: 0.03, attack: 0.004, partials: [[1, 1, 1], [3, 0.1, 0.25]] },
};
// 旋律在重拍上重一点，别的拍轻一点
const OFFBEAT_VELOCITY = 0.8;
// 像人弹的：每个音早晚差一点（秒），轻重差一点（比例）
const HUMAN_TIMING = 0.012;
const HUMAN_VELOCITY = 0.15;
// 一个音响多久：按它占几拍算，再乘这个（音尾巴连到下一个音），最短、最长多少秒
const SUSTAIN = 1.3;
const NOTE_SECONDS = [0.4, 2.6];

// 每帧把多远以内（秒）要响的音交给音频去排：慢的手机一秒只有几帧也不会断
const LOOKAHEAD = 0.6;
// 一个音过了该响的时刻多久（秒）还补上；再晚就不补了（切到后台、卡了一下时落下的音），像真的收音机一直在放
const LATE_TOLERANCE = 0.1;

/**
 * 一台会自己编曲的收音机
 * @description 每帧把现在的时间给它，它把快要响的音交给音频去排；白天黑夜在下一首歌开始时才换，一首歌不会唱到一半变调
 * @param {object} options
 * @param {(wait: number) => void} options.onMelody 旋律要响一个音了：wait 是再过几秒响
 * @returns {{ start(delay: number): void, stop(): void, setNight(night: boolean): void, update(now: number): void }}
 *   start：过几秒从一首新歌开始放；stop：不放了；setNight：下一首放白天的还是夜里的；update：每帧给它现在的时间（秒）
 */
export function createRadioMusic({ onMelody }) {
  let nextStyle = STYLES.day;
  let playing = false;
  // 正在放的歌、放到第几小节、下一小节从几秒开始
  let song = null;
  let barIndex = 0;
  let barStart = 0;
  // 等着开始放：第一次拿到时间以后再过几秒开始（null 是没在等）
  let startDelay = null;
  // 排好了、还没交给音频的音，按时间排
  let queue = [];
  let lastNow = null;

  const queueNextBar = () => {
    if (!song || barIndex >= song.bars.length) {
      song = writeSong(nextStyle);
      barIndex = 0;
    }

    const bar = song.bars[barIndex];
    barIndex++;
    const beatSeconds = 60 / song.style.tempo;
    queue.push(...barEvents(song.style, bar, barStart, beatSeconds));
    queue.sort((a, b) => a.time - b.time);
    barStart += song.style.beatsPerBar * beatSeconds;
  };

  const followClock = (now) => {
    const jump = lastNow === null ? 0 : now - lastNow;
    lastNow = now;
    // 钟往回走了：刚从画面的时间换成音频的钟，排好的音整体挪到新的钟上
    if (jump < 0) {
      barStart += jump;
      for (const event of queue) {
        event.time += jump;
      }
    }
    // 停了一阵（切到后台、卡了一下），整小节都错过了：不补，从现在接着放下一小节
    if (barStart < now) {
      barStart = now;
    }
  };

  return {
    start(delay) {
      playing = true;
      song = null;
      queue = [];
      startDelay = delay;
    },
    stop() {
      playing = false;
      queue = [];
      startDelay = null;
    },
    setNight(night) {
      nextStyle = night ? STYLES.night : STYLES.day;
    },
    update(now) {
      if (!playing) {
        return;
      }

      if (startDelay !== null) {
        barStart = now + startDelay;
        startDelay = null;
        lastNow = now;
      }
      followClock(now);

      while (barStart < now + LOOKAHEAD) {
        queueNextBar();
      }
      while (queue.length && queue[0].time < now + LOOKAHEAD) {
        const event = queue.shift();
        const missed = event.time < now - LATE_TOLERANCE;
        if (missed) {
          continue;
        }
        playEvent(event);
        if (event.melody) {
          onMelody(event.time - now);
        }
      }
    },
  };
}

// ---------- 编曲 ----------

/**
 * 编一首歌：挑一种和弦进行，写两句旋律（A、B），按 A A' B A 排好，最后收在主和弦上，再空一小节
 * @param {object} style STYLES 里的一种曲风
 * @returns {{ style: object, bars: { chord: string | null, notes: object[], kind: 'play' | 'ending' | 'gap' }[] }}
 *   每一小节：什么和弦（空着的小节是 null）、旋律的音、是平常的小节还是收尾、空着
 */
function writeSong(style) {
  const progression = pickOne(style.progressions);
  const [low, high] = style.melodyRange;
  const middle = Math.round((low + high) / 2);

  const phrases = {};
  phrases.A = writePhrase(style, progression, middle);
  const lastBar = BARS_PER_PHRASE - 1;
  const lastChord = progression[lastBar];
  phrases.A2 = [...phrases.A.slice(0, lastBar), writeBar(style, lastChord, phrases.A[lastBar - 1].lastPitch, true)];
  phrases.B = writePhrase(style, progression, phrases.A2[lastBar].lastPitch);

  const bars = [];
  for (const name of SONG_FORM) {
    phrases[name].forEach((bar, index) => {
      bars.push({ chord: progression[index], notes: bar.notes, kind: 'play' });
    });
  }

  const finalPitch = phrases.A[lastBar].lastPitch;
  const homePitch = pickPitch(finalPitch, pitchesInRange(style.melodyRange, chordPitchClasses(HOME_CHORD, STABLE_TONES)));
  bars.push({ chord: HOME_CHORD, notes: [{ beat: 0, length: style.beatsPerBar, pitch: homePitch }], kind: 'ending' });
  for (let i = 0; i < GAP_BARS; i++) {
    bars.push({ chord: null, notes: [], kind: 'gap' });
  }
  return { style, bars };
}

/**
 * 写一句旋律：四小节，跟着和弦进行走，最后一小节收住
 * @param {object} style 曲风
 * @param {string[]} progression 这一句的四个和弦
 * @param {number} startPitch 从哪个音附近开始（MIDI，接着上一句的最后一个音）
 * @returns {{ notes: object[], lastPitch: number }[]} 每一小节的音，和这一小节最后落在哪个音上
 */
function writePhrase(style, progression, startPitch) {
  const bars = [];
  let pitch = startPitch;
  progression.forEach((chord, index) => {
    const cadence = index === progression.length - 1;
    const bar = writeBar(style, chord, pitch, cadence);
    bars.push(bar);
    pitch = bar.lastPitch;
  });
  return bars;
}

/**
 * 写一小节旋律：挑一种节奏，一个音一个音地往下走
 * @description 重拍上落在和弦音上，别的拍走五声音阶；一句最后那个音落在和弦里稳的音上，听起来这句话说完了
 * @param {object} style 曲风
 * @param {string} chord 这一小节的和弦
 * @param {number} previousPitch 上一个音（MIDI）
 * @param {boolean} cadence 是不是一句的最后一小节
 * @returns {{ notes: { beat: number, length: number, pitch: number }[], lastPitch: number }}
 */
function writeBar(style, chord, previousPitch, cadence) {
  const rest = !cadence && Math.random() < style.restChance;
  if (rest) {
    return { notes: [], lastPitch: previousPitch };
  }

  const rhythm = pickOne(cadence ? style.cadences : style.rhythms);
  const stable = pitchesInRange(style.melodyRange, chordPitchClasses(chord, STABLE_TONES));
  const chordTones = pitchesInRange(style.melodyRange, chordPitchClasses(chord));
  const scale = pitchesInRange(style.melodyRange, PENTATONIC);

  let pitch = previousPitch;
  const notes = rhythm.map(([beat, length], index) => {
    const phraseEnd = cadence && index === rhythm.length - 1;
    let candidates = scale;
    if (phraseEnd) {
      candidates = stable;
    } else if (style.strongBeats.includes(beat)) {
      candidates = chordTones;
    }
    pitch = pickPitch(pitch, candidates);
    return { beat, length, pitch };
  });
  return { notes, lastPitch: pitch };
}

/**
 * 从几个能用的音里挑下一个：离上一个音越近越容易选中，太远的不选
 * @param {number} previous 上一个音（MIDI）
 * @param {number[]} candidates 能用的音（MIDI）
 * @returns {number}
 */
function pickPitch(previous, candidates) {
  const near = candidates.filter((pitch) => Math.abs(pitch - previous) <= MAX_LEAP);
  // 附近一个能用的都没有（以后加了音域很窄的曲风）时，就从全部里挑
  const choices = near.length > 0 ? near : candidates;
  const weights = choices.map((pitch) => leapWeight(previous, pitch));
  return weightedPick(choices, weights);
}

/**
 * 从上一个音跳到这个音有多大的机会
 * @param {number} previous 上一个音（MIDI）
 * @param {number} pitch 想跳到的音（MIDI）
 * @returns {number} 相对的机会，越大越容易选中
 */
function leapWeight(previous, pitch) {
  const leap = Math.abs(pitch - previous);
  if (leap === 0) {
    return REPEAT_WEIGHT;
  }
  return 1 / (1 + (leap / LEAP_SOFTNESS) ** 2);
}

/**
 * 一个和弦里的音是哪几个音名（0 是 C，不管高低）
 * @param {string} chord 和弦名
 * @param {number} [count] 只要前几个（根音、三音、五音……）；不写就是全部
 * @returns {number[]} 0~11
 */
function chordPitchClasses(chord, count) {
  const { root, intervals } = CHORDS[chord];
  return intervals.slice(0, count).map((interval) => (root + interval) % SEMITONES_PER_OCTAVE);
}

/**
 * 在一段音域里，挑出属于这几个音名的音
 * @param {number[]} range [最低, 最高]（MIDI）
 * @param {number[]} pitchClasses 要哪些音名（0~11）
 * @returns {number[]} MIDI 音高，从低到高
 */
function pitchesInRange([low, high], pitchClasses) {
  const pitches = [];
  for (let pitch = low; pitch <= high; pitch++) {
    if (pitchClasses.includes(pitch % SEMITONES_PER_OCTAVE)) {
      pitches.push(pitch);
    }
  }
  return pitches;
}

// ---------- 排音 ----------

/**
 * 把一小节写好的东西变成一个个要响的音：旋律加伴奏
 * @param {object} style 曲风
 * @param {{ chord: string | null, notes: object[], kind: string }} bar 这一小节
 * @param {number} start 这一小节从几秒开始
 * @param {number} beatSeconds 一拍几秒
 * @returns {{ time: number, instrument: string, pitch: number, seconds: number, velocity: number, melody: boolean }[]}
 */
function barEvents(style, bar, start, beatSeconds) {
  if (!bar.chord) {
    return [];
  }

  const melody = bar.notes.map((note) => {
    const strong = style.strongBeats.includes(note.beat);
    return {
      time: start + note.beat * beatSeconds,
      instrument: 'bell',
      pitch: note.pitch,
      seconds: noteSeconds(note.length * beatSeconds),
      velocity: strong ? 1 : OFFBEAT_VELOCITY,
      melody: true,
    };
  });

  const ending = bar.kind === 'ending';
  let accompaniment;
  if (style.accompaniment === 'arpeggio') {
    accompaniment = arpeggioEvents(style, bar.chord, start, beatSeconds, ending);
  } else {
    accompaniment = strumEvents(style, bar.chord, start, beatSeconds, ending);
  }
  return [...melody, ...accompaniment];
}

/**
 * 白天的伴奏：低音弹根音（有时弹五音），和弦一拍扫一下；收尾那小节只弹一下，拖满整小节
 * @param {object} style 曲风
 * @param {string} chord 和弦名
 * @param {number} start 这一小节从几秒开始
 * @param {number} beatSeconds 一拍几秒
 * @param {boolean} ending 是不是一首歌收尾那一小节
 * @returns {object[]} 要响的音，格式同 barEvents
 */
function strumEvents(style, chord, start, beatSeconds, ending) {
  const { root, intervals } = CHORDS[chord];
  const fifth = root + intervals[2];
  const voicing = keysVoicing(chord);
  const wholeBar = [[0, style.beatsPerBar, 1]];
  const bassHits = ending ? [[0, style.beatsPerBar]] : DAY_BASS;
  const strums = ending ? wholeBar : DAY_STRUMS;
  const events = [];

  bassHits.forEach(([beat, length], index) => {
    const offbeatFifth = index > 0 && Math.random() < BASS_FIFTH_CHANCE;
    events.push({
      time: start + beat * beatSeconds,
      instrument: 'bass',
      pitch: offbeatFifth ? fifth : root,
      seconds: noteSeconds(length * beatSeconds),
      velocity: 1,
      melody: false,
    });
  });

  for (const [beat, length, velocity] of strums) {
    voicing.forEach((pitch, index) => {
      events.push({
        time: start + beat * beatSeconds + index * STRUM_GAP,
        instrument: 'keys',
        pitch,
        seconds: noteSeconds(length * beatSeconds),
        velocity,
        melody: false,
      });
    });
  }
  return events;
}

/**
 * 白天的和弦弹哪几个音：根音留给低音，弹上面的三音、五音、七音，都摆在 KEYS_TOP 以下
 * @param {string} chord 和弦名
 * @returns {number[]} MIDI 音高，从低到高
 */
function keysVoicing(chord) {
  const { root, intervals } = CHORDS[chord];
  const pitches = intervals.slice(1).map((interval) => {
    const pitch = root + SEMITONES_PER_OCTAVE + interval;
    return pitch > KEYS_TOP ? pitch - SEMITONES_PER_OCTAVE : pitch;
  });
  return pitches.sort((a, b) => a - b);
}

/**
 * 夜里的伴奏：八音盒那样，和弦里的音按八分音符一个个往上数再往下回；收尾那小节只往上数一遍
 * @param {object} style 曲风
 * @param {string} chord 和弦名
 * @param {number} start 这一小节从几秒开始
 * @param {number} beatSeconds 一拍几秒
 * @param {boolean} ending 是不是一首歌收尾那一小节
 * @returns {object[]} 要响的音，格式同 barEvents
 */
function arpeggioEvents(style, chord, start, beatSeconds, ending) {
  const { root, intervals } = CHORDS[chord];
  const steps = Math.round(style.beatsPerBar / ARPEGGIO_STEP);
  const order = ending ? [...intervals.keys()] : ARPEGGIO_ORDER.slice(0, steps);

  return order.map((toneIndex, step) => {
    const isRoot = step === 0;
    let length = ARPEGGIO_STEP * 2;
    if (isRoot) {
      length = ARPEGGIO_ROOT.length;
    } else if (ending) {
      length = style.beatsPerBar;
    }
    return {
      time: start + step * ARPEGGIO_STEP * beatSeconds,
      instrument: 'musicBox',
      pitch: root + intervals[toneIndex],
      seconds: noteSeconds(length * beatSeconds),
      velocity: isRoot ? ARPEGGIO_ROOT.velocity : 1,
      melody: false,
    };
  });
}

/**
 * 一个音响多久：按它占的时间拖长一点，限在最短、最长之间
 * @param {number} span 这个音占多少秒
 * @returns {number} 秒
 */
function noteSeconds(span) {
  const [shortest, longest] = NOTE_SECONDS;
  return Math.min(longest, Math.max(shortest, span * SUSTAIN));
}

/**
 * 把一个音交给音频：按乐器的几个泛音一起响，早晚轻重随手差一点
 * @param {{ time: number, instrument: string, pitch: number, seconds: number, velocity: number }} event
 */
function playEvent(event) {
  const instrument = INSTRUMENTS[event.instrument];
  const time = event.time + (Math.random() * 2 - 1) * HUMAN_TIMING;
  const velocity = event.velocity * (1 + (Math.random() * 2 - 1) * HUMAN_VELOCITY);
  const frequency = A4_FREQUENCY * 2 ** ((event.pitch - A4_MIDI) / SEMITONES_PER_OCTAVE);

  for (const [ratio, loudness, length] of instrument.partials) {
    sfx.musicNote(frequency * ratio, time, event.seconds * length, {
      wave: instrument.wave,
      volume: instrument.volume * velocity * loudness,
      attack: instrument.attack,
    });
  }
}

// ---------- 随机 ----------

/**
 * 随便挑一个
 * @param {any[]} list
 * @returns {any}
 */
function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 按机会大小挑一个
 * @param {any[]} items 几个选项
 * @param {number[]} weights 每个选项的机会（相对大小）
 * @returns {any}
 */
function weightedPick(items, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}
