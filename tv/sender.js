// Reads the Magic Remote's pointer on the TV and sends it over UDP (docs/PROTOCOL.md) while the box's HDMI input is on screen.
//
// Runs ON THE TV as root (webOS 5's Node 8: plain JavaScript). It never grabs the input device, so LG's handling is unchanged.
//
//   node sender.js --to 192.168.1.182[:47800] [--input com.webos.app.hdmi1] [--always] [--screen 1920x1080] [--verbose]
//
// --always sends regardless of what is on screen (for testing).

'use strict';
const fs = require('fs');
const dgram = require('dgram');
const execFile = require('child_process').execFile;

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.indexOf('--') === 0 ? true : v;
}

const to = String(arg('to', '') || '');
if (!to) {
  console.error('usage: node sender.js --to <host[:port]> [--input com.webos.app.hdmi1] [--always] [--screen WxH] [--verbose]');
  process.exit(2);
}
const HOST = to.split(':')[0];
const PORT = Number(to.split(':')[1]) || 47800;
const INPUT = String(arg('input', 'com.webos.app.hdmi1'));
const ALWAYS = arg('always', false) === true;
const VERBOSE = arg('verbose', false) === true;
const SCREEN = String(arg('screen', '1920x1080')).split('x').map(Number);
const DEVICE_NAME = 'LGE M-RCU - Builtin [0]';

const log = s => fs.writeSync(2, new Date().toISOString().slice(11, 23) + ' ' + s + '\n');

// One sender at a time: stop the previous one (by its PID file, since `pkill -f` from a shell whose own command line names
// this script kills that shell too).
const PIDFILE = '/tmp/pointer-bridge-sender.pid';
try {
  const old = Number(fs.readFileSync(PIDFILE, 'utf8'));
  if (old && old !== process.pid && /pointer-bridge-sender/.test(fs.readFileSync('/proc/' + old + '/cmdline', 'utf8'))) {
    process.kill(old, 'SIGTERM');
    log('stopped the previous sender (' + old + ')');
  }
} catch (_) {}
fs.writeFileSync(PIDFILE, String(process.pid));

// ---- the Magic Remote's event device ----
function findDevice() {
  const text = fs.readFileSync('/proc/bus/input/devices', 'utf8');
  for (const block of text.split(/\n\n+/)) {
    const name = (/^N: Name="([^"]*)"/m.exec(block) || [])[1];
    const ev = (/^H: Handlers=.*\b(event\d+)\b/m.exec(block) || [])[1];
    if (name === DEVICE_NAME && ev) return '/dev/input/' + ev;
  }
  return null;
}

// ---- UDP out ----
const sock = dgram.createSocket('udp4');
let seq = 0;
function send(type, body) {
  const b = Buffer.alloc(6 + body.length);
  b.write('PB', 0, 'ascii');
  b[2] = 1;
  b[3] = type;
  b.writeUInt16LE(seq, 4);
  seq = (seq + 1) & 0xffff;
  body.copy(b, 6);
  sock.send(b, 0, b.length, PORT, HOST);
}
const scale = (v, max) => Math.max(0, Math.min(32767, Math.round((v * 32767) / (max - 1))));
function sendPos(x, y) {
  const body = Buffer.alloc(4);
  body.writeUInt16LE(scale(x, SCREEN[0]), 0);
  body.writeUInt16LE(scale(y, SCREEN[1]), 2);
  send(1, body);
}
const sendButton = down => send(2, Buffer.from([1, down ? 1 : 0]));
const sendWheel = n => send(3, Buffer.from([n & 0xff, 0]));
const sendState = on => send(4, Buffer.from([on ? 1 : 0, 0]));

// ---- what is on screen: poll the app manager (a luna subscription's output arrives late through luna-send's buffering) ----
let active = ALWAYS;
function setActive(on) {
  if (on === active) return;
  active = on;
  log('pointer ' + (on ? 'active' : 'inactive'));
  if (!on && buttonDown) {
    buttonDown = false;
    sendButton(false);
  }
  sendState(on);
}
function pollForeground() {
  execFile(
    'luna-send',
    ['-n', '1', '-w', '2000', '-f', 'luna://com.webos.applicationManager/getForegroundAppInfo', '{}'],
    { timeout: 4000 },
    (e, out, err) => {
      const m = /"appId":\s*"([^"]*)"/.exec(String(out) + String(err)); // luna-send prints to stderr on this TV
      if (m) setActive(m[1] === INPUT);
    }
  );
}
if (!ALWAYS) {
  pollForeground();
  setInterval(pollForeground, 1000);
}
setInterval(() => sendState(active), 2000);

// ---- reading input_event structs (16 bytes for a 32-bit process: 8-byte compat timeval) ----
const SIZE = process.arch === 'arm64' || process.arch === 'x64' ? 24 : 16;
const T = SIZE - 8;
const EV_SYN = 0, EV_KEY = 1, EV_REL = 2, EV_ABS = 3;
const ABS_X = 0, ABS_Y = 1, REL_WHEEL = 8, KEY_ENTER = 28;

let x = -1, y = -1, sentX = -1, sentY = -1;
let buttonDown = false;
let wheel = 0;

function onEvent(type, code, value) {
  if (VERBOSE && type === EV_KEY) log('key ' + code + ' ' + ['up', 'down', 'repeat'][value]);
  if (type === EV_ABS && code === ABS_X) x = value;
  else if (type === EV_ABS && code === ABS_Y) y = value;
  else if (type === EV_REL && code === REL_WHEEL) wheel += value;
  else if (type === EV_KEY && code === KEY_ENTER && value !== 2) {
    if (!active) return;
    buttonDown = value === 1;
    sendButton(buttonDown);
    if (VERBOSE) log('button ' + (buttonDown ? 'down' : 'up'));
  } else if (type === EV_SYN && code === 0) {
    if (!active) {
      wheel = 0;
      return;
    }
    if (x >= 0 && y >= 0 && (x !== sentX || y !== sentY)) {
      sentX = x;
      sentY = y;
      sendPos(x, y);
      if (VERBOSE) log('pos ' + x + ',' + y);
    }
    if (wheel) {
      sendWheel(Math.max(-127, Math.min(127, wheel)));
      if (VERBOSE) log('wheel ' + wheel);
      wheel = 0;
    }
  }
}

function open() {
  const dev = findDevice();
  if (!dev) {
    log('"' + DEVICE_NAME + '" not found; retrying in 5 s');
    return setTimeout(open, 5000);
  }
  log('reading ' + dev + ', sending to ' + HOST + ':' + PORT + (ALWAYS ? ' (always)' : ' while ' + INPUT + ' is on screen'));
  let buf = Buffer.alloc(0);
  const s = fs.createReadStream(dev);
  s.on('data', chunk => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    let off = 0;
    for (; off + SIZE <= buf.length; off += SIZE) onEvent(buf.readUInt16LE(off + T), buf.readUInt16LE(off + T + 2), buf.readInt32LE(off + T + 4));
    buf = buf.slice(off);
  });
  s.on('error', e => {
    log('read error: ' + e.message + '; reopening in 2 s');
    setTimeout(open, 2000);
  });
  s.on('end', () => setTimeout(open, 2000));
}
open();

function stop() {
  if (buttonDown) sendButton(false);
  sendState(false);
  setTimeout(() => process.kill(process.pid, 'SIGKILL'), 100); // a blocked device read keeps process.exit() waiting
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
