// Spike 0: can the TV read the Magic Remote's pointer while an HDMI input is on screen?
//
// Runs ON THE TV (root shell, webOS 5's Node 8, so plain JavaScript: no TypeScript runtime there).
// It lists the kernel input devices, opens every /dev/input/event*, decodes input_event structs for a
// few seconds without grabbing them (LG's own input handling is unaffected), and prints a summary per
// device: event types/codes seen, how many, and the value ranges. Wave the remote, press OK, roll the
// wheel while it runs.
//
//   node evdev-probe.js [seconds=15]

'use strict';
const fs = require('fs');

const SECS = Number(process.argv[2]) || 15;
const TYPES = { 0: 'SYN', 1: 'KEY', 2: 'REL', 3: 'ABS', 4: 'MSC' };
const REL = { 0: 'X', 1: 'Y', 6: 'HWHEEL', 8: 'WHEEL' };
const ABS = { 0: 'X', 1: 'Y', 2: 'Z', 3: 'RX', 4: 'RY', 5: 'RZ' };

// /proc/bus/input/devices: map eventN -> name
function devices() {
  const out = {};
  const text = fs.readFileSync('/proc/bus/input/devices', 'utf8');
  for (const block of text.split(/\n\n+/)) {
    const name = (/^N: Name="([^"]*)"/m.exec(block) || [])[1] || '?';
    const ev = (/^H: Handlers=.*\b(event\d+)\b/m.exec(block) || [])[1];
    if (ev) out[ev] = name;
  }
  return out;
}

// struct input_event: timeval + u16 type + u16 code + s32 value.
// A 32-bit process (webOS userspace is lib32) gets the compat layout: 8-byte timeval, 16 bytes total.
const SIZE = process.arch === 'arm64' || process.arch === 'x64' ? 24 : 16;
const T = SIZE - 8;

const stats = {}; // ev -> key -> {n, min, max, last}
const names = devices();
const t0 = Date.now();
const streams = [];

for (const ev of Object.keys(names)) {
  stats[ev] = {};
  let buf = Buffer.alloc(0);
  let s;
  try {
    s = fs.createReadStream('/dev/input/' + ev);
  } catch (e) {
    continue;
  }
  streams.push(s);
  s.on('error', () => {});
  s.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= SIZE) {
      const type = buf.readUInt16LE(T);
      const code = buf.readUInt16LE(T + 2);
      const value = buf.readInt32LE(T + 4);
      buf = buf.slice(SIZE);
      if (type === 0) continue; // SYN
      const tn = TYPES[type] || 'T' + type;
      const cn = (type === 2 ? REL[code] : type === 3 ? ABS[code] : null) || String(code);
      const k = tn + ':' + cn;
      const st = stats[ev][k] || (stats[ev][k] = { n: 0, min: value, max: value, last: value, first: Date.now() - t0 });
      st.n++;
      st.min = Math.min(st.min, value);
      st.max = Math.max(st.max, value);
      st.last = value;
    }
  });
}

console.log('struct size ' + SIZE + ', arch ' + process.arch + ', listening ' + SECS + ' s on ' + streams.length + ' devices');
setTimeout(() => {
  for (const ev of Object.keys(stats)) {
    const keys = Object.keys(stats[ev]);
    if (!keys.length) continue;
    console.log('\n' + ev + '  "' + names[ev] + '"');
    for (const k of keys.sort()) {
      const s = stats[ev][k];
      console.log('  ' + k + '  n=' + s.n + '  min=' + s.min + '  max=' + s.max + '  last=' + s.last + '  first@' + s.first + 'ms');
    }
  }
  console.log('\nsilent devices: ' + Object.keys(stats).filter(e => !Object.keys(stats[e]).length).map(e => e + ' "' + names[e] + '"').join(', '));
  process.exit(0);
}, SECS * 1000);
