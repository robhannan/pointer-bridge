// Test helper for Macs whose firewall blocks incoming UDP: listens on the TV and writes each datagram as a hex line to stdout,
// which `mac/receiver.ts --stdin` reads through SSH. Runs on the TV (Node 8).
//
//   node relay.js [port=47800]

'use strict';
const fs = require('fs');
const sock = require('dgram').createSocket('udp4');
sock.on('message', msg => fs.writeSync(1, msg.toString('hex') + '\n'));
sock.bind(Number(process.argv[2]) || 47800, '127.0.0.1');
// stop when SSH goes away (stdout closed) or after the time limit, so nothing is left running on the TV
process.stdout.on('error', () => process.exit(0));
setTimeout(() => process.exit(0), (Number(process.argv[3]) || 600) * 1000);
