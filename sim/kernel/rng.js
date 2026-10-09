// sim/kernel/rng.js — deterministic seeded RNG streams (M001).
// One stream per subsystem: adding rolls in one stream never reshuffles another.
// RNG is for flavour and tie-breaking ONLY — never for "does the NPC lie".

function xfnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(rootSeed) {
  let root = rootSeed;
  const streams = new Map(); // name -> { s: uint32 }

  function stream(name) {
    let st = streams.get(name);
    if (!st) {
      st = { s: xfnv1a(`${root}|${name}`) || 1 };
      streams.set(name, st);
    }
    return st;
  }

  /** Uniform [0,1). Advances only the named stream. */
  function next(name) {
    const st = stream(name);
    st.s = (st.s + 0x6d2b79f5) >>> 0;
    let t = st.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, max). */
  function int(name, max) {
    if (!Number.isInteger(max) || max <= 0) throw new Error(`bad_max: ${max}`);
    return Math.floor(next(name) * max);
  }

  function getState() {
    return { rootSeed: root, streams: [...streams.entries()].map(([k, v]) => [k, v.s]) };
  }

  function setState(snap) {
    // A restore fully determines the future: root seed comes from the save,
    // never from whatever seed the kernel was constructed with.
    root = snap.rootSeed;
    streams.clear();
    for (const [k, v] of snap.streams) streams.set(k, { s: v >>> 0 });
  }

  return { next, int, getState, setState };
}
