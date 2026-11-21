// Stands in for the Pico W while it isn't here: receives the TV's UDP packets (docs/PROTOCOL.md) and shows them.
//
//   node mac/receiver.ts [--port 47800] [--log]
//   ssh root@tv 'node /tmp/relay.js' | node mac/receiver.ts --stdin [--log]     (tv/run-tunnel.sh does this)
//
// Draws a live 64x18 map of the screen with the cursor, the button state, wheel total, packet rate and loss.
// --log prints every packet instead.

import dgram from 'node:dgram';
import process from 'node:process';
import readline from 'node:readline';

const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const PORT = portArg >= 0 ? Number(argv[portArg + 1]) : 47800;
const LOG = argv.includes('--log');
const STDIN = argv.includes('--stdin');

type Packet =
  | { kind: 'pos'; seq: number; x: number; y: number }
  | { kind: 'button'; seq: number; button: number; down: boolean }
  | { kind: 'wheel'; seq: number; notches: number }
  | { kind: 'state'; seq: number; active: boolean };

export function decode(b: Buffer): Packet | null {
  if (b.length < 8 || b[0] !== 0x50 || b[1] !== 0x42 || b[2] !== 1) return null;
  const seq = b.readUInt16LE(4);
  switch (b[3]) {
    case 1:
      return b.length >= 10 ? { kind: 'pos', seq, x: b.readUInt16LE(6), y: b.readUInt16LE(8) } : null;
    case 2:
      return { kind: 'button', seq, button: b[6] ?? 0, down: b[7] === 1 };
    case 3:
      return { kind: 'wheel', seq, notches: b.readInt8(6) };
    case 4:
      return { kind: 'state', seq, active: b[6] === 1 };
    default:
      return null;
  }
}

const W = 64;
const H = 18;
let x = -1;
let y = -1;
let down = false;
let wheel = 0;
let active = false;
let lastSeq = -1;
let lost = 0;
let total = 0;
let from = '';
const stamps: number[] = [];
let lastAt = 0;

function render(): void {
  const now = Date.now();
  while (stamps.length && (stamps[0] ?? 0) < now - 1000) stamps.shift();
  const cx = x < 0 ? -1 : Math.round((x / 32767) * (W - 1));
  const cy = y < 0 ? -1 : Math.round((y / 32767) * (H - 1));
  const rows: string[] = [];
  rows.push('+' + '-'.repeat(W) + '+');
  for (let r = 0; r < H; r++) {
    let line = '';
    for (let c = 0; c < W; c++) line += r === cy && c === cx ? (down ? '@' : '+') : ' ';
    rows.push('|' + line + '|');
  }
  rows.push('+' + '-'.repeat(W) + '+');
  const age = lastAt ? ((now - lastAt) / 1000).toFixed(1) + ' s ago' : 'nothing yet';
  rows.push(
    `from ${from || '-'}  ${active ? 'ACTIVE' : 'inactive'}  pos ${x},${y}  button ${down ? 'DOWN' : 'up'}  ` +
      `wheel ${wheel}  ${stamps.length}/s  packets ${total} lost ${lost}  last ${age}`
  );
  process.stdout.write('\x1b[H\x1b[2J' + rows.join('\n') + '\n');
}

function onPacket(msg: Buffer, address: string): void {
  const p = decode(msg);
  if (!p) return;
  from = address;
  total++;
  lastAt = Date.now();
  stamps.push(lastAt);
  if (lastSeq >= 0) lost += (p.seq - lastSeq - 1 + 0x10000) & 0xffff;
  lastSeq = p.seq;
  if (p.kind === 'pos') ({ x, y } = p);
  else if (p.kind === 'button') down = p.down;
  else if (p.kind === 'wheel') wheel += p.notches;
  else active = p.active;
  if (LOG) console.log(new Date().toISOString().slice(11, 23), address, JSON.stringify(p));
}

if (STDIN) {
  // hex lines from tv/relay.js through SSH (for a Mac whose firewall blocks incoming UDP)
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', line => {
    if (/^[0-9a-f]+$/.test(line.trim())) onPacket(Buffer.from(line.trim(), 'hex'), 'relay');
  });
  rl.on('close', () => {
    if (!LOG) render();
    process.exit(0);
  });
  if (!LOG) setInterval(render, 50);
} else {
  const sock = dgram.createSocket('udp4');
  sock.on('message', (msg, rinfo) => onPacket(msg, rinfo.address));
  sock.bind(PORT, () => {
    console.log(`listening on UDP ${PORT}`);
    if (!LOG) setInterval(render, 50);
  });
}
