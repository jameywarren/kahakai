// The playable sketch's physics and rules. Side view, metres, z up, fixed step. No randomness.
// Positions are the scene's own (blender/shore.py), projected onto the wall plane as the camera sees them.
//
// One bar, thirteen things to do, in ANY order. Nothing resets and nothing is undone: what is lit stays lit, what is
// open stays open, what is broken stays broken. When all thirteen are done the surfboard lets go, lands in the window, and
// takes the front wall down with it: the bar is left standing open on the beach. That is the end, and you can keep flipping.
//   the big five:  through the life ring (the string of bulbs comes on)
//                  into the bucket (the lantern is lit, and the cooler's lid springs open)
//                  into the open cooler (the ring starts to swing, and the surfboard is jolted half off its rack)
//                  smash the lantern (three hits: a crack, another crack, then it goes)
//                  drop the surfboard (four knocks; the cooler counts as one). It hangs high, so it takes a hard, straight shot
//   and the eight bulbs, knocked out one at a time by high shots. Dead bulbs never relight.
const SIM = (() => {
  const T = {
    dt: 1 / 480, g: 9.8,
    ballR: 0.066,
    piv: { L: [-0.899, 0.863], R: [0.899, 0.863] },
    len: 0.614, thick: 0.028,
    rest: -22 * Math.PI / 180, up: 30 * Math.PI / 180,
    wUp: 20, wDown: 9,             // slipper swing speeds, radians a second
    aim0: 0.03, aim1: 0.5, v0: 9.08, v1: -5.6, vTip: { L: 4.1, R: 4.33 }, vMax: 7.0,   // the throw, by where the float sits on the footbed
    roll: 5.2,                     // how much the footbed slows a rolling float
    bucket: { x: -0.536, top: 1.462, r: 0.130, mouth: 0.095 },
    cooler: { x0: 0.278, x1: 0.690, z1: 1.347, slot: 0.10 },
    ring: { x: -0.124, z: 1.950, hole: 0.10, out: 0.30, swing: 0.16, period: 3.4 },
    board: { z: 2.785, x0: -0.92, x1: 0.92, hard: 2.9, knocks: 4, crook: [-0.55, 2.80, 0.95, 2.49] },   // high over the window; when it drops, its tip stays above the bulbs
    lantern: { x: 0.350, z: 1.905, r: 0.085, hits: 3 },
    bulbs: Array.from({ length: 8 }, (_, i) => { const k = i + 1, x = -0.99 + 1.98 * k / 9, z = 2.47 - 0.05 * Math.sin(Math.PI * k / 9) - 0.045; return [x * 1.0526, 1.62 + (z - 1.62) * 1.0526]; }),
    bulbR: 0.06, pop: 0.8,
    drink: -0.425,                 // the glass on the bar: a float that comes down in it makes a splash
    // Nothing vanishes. A float that is caught is HELD where you can see it, and then thrown back by the thing that caught it:
    // the bucket bounces it out on its spring, the cooler's lid claps shut and flings it, and the bowl on the bar kicks it back up.
    out: { bucket: { t: 0.55, vx: -0.62, vz: 2.7 }, cooler: { t: 0.75, vx: 0.66, vz: 2.7 }, bowl: { t: 0.8, roll: 0.45, vx: 1.02, vz: 4.45, z: 0.50 } },
    wall: 0.975, lostZ: 0.55, e: 0.32, dropZ: 1.02, dropX: 0.84, things: 13,
  };
  function make() {
    return {
      t: 0, steps: 0, phase: 'play',             // play, fall (it is all done and the wall is coming down)
      ball: { x: 0, z: 0, vx: 0, vz: 0, live: true },
      fl: { L: { a: T.rest, w: 0, down: false, lock: 0 }, R: { a: T.rest, w: 0, down: false, lock: 0 } },
      lights: false, bucket: false, cooler: false, smashed: false, crooked: false, alive: Array(8).fill(true), lanHits: 0,
      knocks: 0, swingT: 0, stillT: 0, inRing: false, lanLock: 0, boardLock: 0, hold: null, outLock: 0, kick: 'R', lastSide: 'R', endT: 0, events: [],
    };
  }
  const tip = (side, a) => { const p = T.piv[side], sx = side === 'L' ? 1 : -1; return [p[0] + sx * T.len * Math.cos(a), p[1] + T.len * Math.sin(a)]; };
  const big = s => [s.lights, s.bucket, s.cooler, s.smashed, s.crooked];
  const done = s => big(s).filter(Boolean).length + s.alive.filter(a => !a).length;
  const ringX = s => T.ring.x + (s.cooler ? T.ring.swing * Math.sin(2 * Math.PI * s.swingT / T.ring.period) : 0);
  const night = s => s.alive.every(a => !a);
  const bulbPos = (s, i) => T.bulbs[i];        // the bulbs stay on their string: the board hangs higher now and does not reach them
  function seg(s, ax, az, bx, bz, r, e) {         // bounce the float off a fixed capsule
    const b = s.ball, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    let u = L2 ? ((b.x - ax) * dx + (b.z - az) * dz) / L2 : 0; u = Math.max(0, Math.min(1, u));
    const cx = ax + dx * u, cz = az + dz * u; let nx = b.x - cx, nz = b.z - cz; const d = Math.hypot(nx, nz), R = r + T.ballR;
    if (d >= R || d === 0) return false;
    nx /= d; nz /= d; const vn = b.vx * nx + b.vz * nz;
    if (vn < 0) { const k = (1 + (Math.abs(vn) > 1.2 ? e : 0)) * vn; b.vx -= k * nx; b.vz -= k * nz; }
    b.x = cx + nx * R; b.z = cz + nz * R; return true;
  }
  // catch the float: it stays in sight, held by `kind`, until that thing throws it back
  function hold(s, kind) { const b = s.ball; b.live = false; s.hold = { kind, t: 0, x0: b.x, z0: b.z }; b.vx = b.vz = 0; }
  function held(s, dt) {
    const h = s.hold, b = s.ball, O = T.out[h.kind]; h.t += dt;
    if (h.kind === 'bucket') { b.x = T.bucket.x; b.z = T.bucket.top + 0.02 - 0.05 * Math.sin(Math.PI * Math.min(1, h.t / O.t)); }
    else if (h.kind === 'cooler') { b.x = (T.cooler.x0 + T.cooler.x1) / 2; b.z = T.cooler.z1 - 0.04; }
    else { const k = Math.min(1, h.t / O.roll), e = 1 - (1 - k) * (1 - k); b.x = h.x0 * (1 - e) * Math.cos(k * 5); b.z = O.z + (Math.min(h.z0, T.lostZ) - O.z) * (1 - e) - (h.t > O.t - 0.12 ? 0.03 * (h.t - O.t + 0.12) / 0.12 : 0); }
    if (h.t < O.t) return;
    s.hold = null; b.live = true; s.outLock = 0.8; s.stillT = 0;
    if (h.kind === 'bowl') { const sx = s.kick === 'L' ? -1 : 1; b.vx = sx * O.vx; b.vz = O.vz; s.kick = s.kick === 'L' ? 'R' : 'L'; s.events.push('kick'); }
    else { b.z = (h.kind === 'bucket' ? T.bucket.top : T.cooler.z1) + T.ballR; b.vx = O.vx; b.vz = O.vz; s.events.push(h.kind === 'bucket' ? 'boing' : 'fling'); }
  }
  function drop(s, side) { const b = s.ball; b.live = true; b.x = side === 'L' ? -T.dropX : T.dropX; b.z = T.dropZ; b.vx = 0; b.vz = 0; }
  function did(s, name) { s.events.push(name); if (done(s) >= T.things && s.phase === 'play') { s.phase = 'fall'; s.endT = 0; s.events.push('fall'); } }
  function step(s) {
    const dt = T.dt, b = s.ball; s.t += dt; s.steps++;
    for (const side of ['L', 'R']) {
      const f = s.fl[side], goal = f.down ? T.up : T.rest, w = f.down ? T.wUp : T.wDown, a0 = f.a;
      f.a = goal > f.a ? Math.min(goal, f.a + w * dt) : Math.max(goal, f.a - w * dt); f.w = (f.a - a0) / dt;
    }
    if (s.cooler) s.swingT += dt;
    if (s.phase === 'fall') s.endT += dt;
    if (s.lanLock > 0) s.lanLock -= dt; if (s.boardLock > 0) s.boardLock -= dt;
    if (s.outLock > 0) s.outLock -= dt;
    if (s.hold) { held(s, dt); return s; }
    if (!b.live) return s;
    b.vz -= T.g * dt; b.x += b.vx * dt; b.z += b.vz * dt;
    const pz = b.z - b.vz * dt, R = T.ballR;
    for (const side of ['L', 'R']) {
      const f = s.fl[side], p = T.piv[side], q = tip(side, f.a), sx = side === 'L' ? -1 : 1;
      if (f.lock > 0) f.lock -= dt;
      else {
        const dx = q[0] - p[0], dz = q[1] - p[1]; let u = ((b.x - p[0]) * dx + (b.z - p[1]) * dz) / (T.len * T.len); u = Math.max(0, Math.min(1, u));
        const cx = p[0] + dx * u, cz = p[1] + dz * u; let nx = b.x - cx, nz = b.z - cz; const d = Math.hypot(nx, nz), RR = T.thick + R;
        if (d < RR && d > 0) {
          nx /= d; nz /= d;
          if (f.w > 1 && nz > 0) {
            // where the float sits on the footbed chooses the shot: by the post nearly straight up and hard (the
            // bulbs, the surfboard), in the middle a loft across the window, at the heel tip flat and far
            const ph = T.aim0 + T.aim1 * u - 0.16 * Math.max(0, 1 - u / 0.15), v = Math.max(T.vTip[side], Math.min(T.vMax, T.v0 + T.v1 * u));
            b.vx = (side === 'L' ? 1 : -1) * Math.sin(ph) * v; b.vz = Math.cos(ph) * v; f.lock = 0.3; s.events.push('throw');
          } else {
            const vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= vn * nx; b.vz -= vn * nz; }
            const tx = -nz, tz = nx, vt = b.vx * tx + b.vz * tz, k = Math.min(1, T.roll * dt); b.vx -= k * vt * tx; b.vz -= k * vt * tz;
          }
          b.x = cx + nx * RR; b.z = cz + nz * RR;
        }
      }
      seg(s, p[0], p[1], p[0], p[1], 0.05, 0.1); seg(s, sx * T.wall, p[1] + 0.2, p[0], p[1] + 0.03, 0.02, 0.1);   // the post's cap, and a little slope from the wall onto the slipper
    }
    // the bulbs, strung under the surfboard: a float that reaches one knocks it out, for good
    const play = s.phase === 'play';          // once the wall is going, there is nothing left on it to hit
    if (play) for (let i = 0; i < 8; i++) if (s.alive[i]) { const q = bulbPos(s, i); if (Math.hypot(b.x - q[0], b.z - q[1]) < T.bulbR + R && Math.hypot(b.vx, b.vz) > T.pop) { s.alive[i] = false; b.vz *= 0.9; did(s, 'pop' + i); if (night(s)) s.events.push('night'); } }
    // the surfboard overhead: a bank shot. Knock it three times (once, after the cooler has jolted it) and it drops off its right rack
    const BD = T.board, vUp = b.vz;
    // Once it has dropped, the board and the wall make one ceiling: nothing can get up past its ends, so nothing can lodge above it.
    let hit;
    if (!play) hit = false;
    else if (s.crooked) { const c = BD.crook; hit = seg(s, c[0], c[1], c[2], c[3], 0.02, 0.5);
      seg(s, -T.wall, c[1], c[0], c[1], 0.02, 0.5); seg(s, c[2], c[3], T.wall, c[3], 0.02, 0.5);
      const top = b.x < c[0] ? c[1] : (b.x > c[2] ? c[3] : c[1] + (c[3] - c[1]) * (b.x - c[0]) / (c[2] - c[0]));
      if (b.z > top) { b.z = top - 0.02 - R; if (b.vz > 0) b.vz = -b.vz * 0.4; }          // and if it ever is above, it is put back under
    } else hit = b.vz > 0 && seg(s, BD.x0, BD.z, BD.x1, BD.z, 0.02, 0.55);
    if (hit && s.boardLock <= 0) { s.boardLock = 0.3; s.events.push('board');
      if (!s.crooked && vUp > BD.hard && ++s.knocks >= BD.knocks) { s.crooked = true; did(s, 'crook'); } else if (!s.crooked && vUp > BD.hard) s.events.push('loosen' + s.knocks); }
    // the lantern: the float passes in front of it. A gentle touch sets it swinging; a hard one smashes it, for good
    const LN = T.lantern;
    if (play && s.lanLock <= 0 && Math.hypot(b.x - LN.x, b.z - LN.z) < LN.r + R * 0.6) { s.lanLock = 0.5;
      if (!s.smashed && ++s.lanHits >= LN.hits) { s.smashed = true; did(s, 'smash'); } else s.events.push(s.smashed ? 'lanternTap' : 'crack' + s.lanHits); }
    // the life ring: a hoop
    const RG = T.ring, rx = ringX(s), rd = Math.hypot(b.x - rx, b.z - RG.z);
    if (play && !s.inRing && rd < RG.hole) { s.inRing = true; if (!s.lights) { s.lights = true; did(s, 'ring'); } else s.events.push('ringAgain'); }
    if (s.inRing && rd > RG.out) s.inRing = false;
    // the bucket and the cooler only matter from above. The float has to come down through the middle of the mouth
    const B = T.bucket, C = T.cooler;
    if (play && s.outLock <= 0 && b.vz < 0 && pz > B.top + R * 0.5 && b.z <= B.top + R * 0.5 && Math.abs(b.x - B.x) < B.r + R * 0.6) {
      if (Math.abs(b.x - B.x) < B.mouth) { hold(s, 'bucket'); if (!s.bucket) { s.bucket = true; did(s, 'bucket'); } else s.events.push('bucketAgain'); return s; }
      b.vz = -b.vz * 0.45; b.vx += (b.x < B.x ? -1 : 1) * 1.1; b.z = B.top + R * 0.5; s.events.push('rim');
    }
    const cm = (C.x0 + C.x1) / 2;
    if (play && s.outLock <= 0 && b.vz < 0 && pz > C.z1 + R * 0.5 && b.z <= C.z1 + R * 0.5 && b.x > C.x0 - R * 0.6 && b.x < C.x1 + R * 0.6) {
      if (s.bucket && Math.abs(b.x - cm) < C.slot) { hold(s, 'cooler');
        if (!s.cooler) { s.cooler = true; if (!s.crooked) s.knocks = Math.min(BD.knocks - 1, s.knocks + 1); did(s, 'cooler'); } else s.events.push('coolerAgain'); return s; }
      const hard = b.vz < -1.5; b.vz = -b.vz * 0.45; b.vx += (b.x < cm ? -1 : 1) * (s.bucket ? 1.1 : 0.5); b.z = C.z1 + R * 0.5; if (hard) s.events.push(s.bucket ? 'rim' : 'lidShut');
    }
    if (b.x < -T.wall + R) { b.x = -T.wall + R; b.vx = Math.abs(b.vx) * 0.4; }
    if (b.x > T.wall - R) { b.x = T.wall - R; b.vx = -Math.abs(b.vx) * 0.4; }
    // a safety net: a float that has come to rest anywhere but on a held-up slipper, or has got somewhere it should not be, is handed back
    const slow = Math.hypot(b.vx, b.vz) < 0.12, heldUp = (s.fl.L.down && b.x < 0 && b.z < 1.2) || (s.fl.R.down && b.x > 0 && b.z < 1.2);
    s.stillT = slow && !heldUp ? s.stillT + dt : 0;
    if (s.stillT > 2.5 || b.z > 3.6 || !Number.isFinite(b.x + b.z + b.vx + b.vz)) { s.stillT = 0; b.x = Math.max(-0.2, Math.min(0.2, b.x || 0)); b.z = T.lostZ; hold(s, 'bowl'); s.events.push('unstuck'); return s; }
    if (b.vz < 0 && b.z < T.lostZ) { s.events.push(Math.abs(b.x - T.drink) < 0.085 ? 'drink' : 'bowl'); hold(s, 'bowl'); }   // into the bowl on the bar, which kicks it back up, to one slipper and then the other
    return s;
  }
  function press(s, side, down) { s.fl[side].down = down; if (down) s.lastSide = side; }
  function reset() { const s = make(); drop(s, 'R'); return s; }
  function start() { const s = make(); s.ball.x = 0; s.ball.z = T.out.bowl.z; hold(s, 'bowl'); s.hold.t = T.out.bowl.roll; return s; }   // a game begins with the float in the bowl, and the bowl kicks it up
  // what is worth keeping between visits: only what has been done
  const keep = s => ({ lights: s.lights, bucket: s.bucket, cooler: s.cooler, smashed: s.smashed, crooked: s.crooked, alive: s.alive, knocks: s.knocks, lanHits: s.lanHits });
  return { T, make, reset, start, step, press, tip, big, done, ringX, night, keep, bulbPos };
})();
if (typeof module !== 'undefined') module.exports = SIM;
