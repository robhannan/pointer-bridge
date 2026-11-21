#!/bin/sh
# End-to-end test without incoming UDP on the Mac (a managed Mac's firewall can block it): the sender sends to a relay on
# the TV itself, and the relay's output comes back over SSH into mac/receiver.ts.
# Usage: tv/run-tunnel.sh [seconds=30] [sender options, e.g. --always --verbose] [-- receiver options, e.g. --log]
set -eu
SECS=${1:-30}; [ $# -gt 0 ] && shift
SENDER_OPTS=""; RX_OPTS=""
while [ $# -gt 0 ]; do
  if [ "$1" = "--" ]; then shift; RX_OPTS="$*"; break; fi
  SENDER_OPTS="$SENDER_OPTS $1"; shift
done
TV=${TV_HOST:?set TV_HOST to the TV address}
KEYOPT=""; [ -n "${TV_KEY:-}" ] && KEYOPT="-i $TV_KEY -o IdentitiesOnly=yes"
tv() { ssh $KEYOPT -o BatchMode=yes -o ConnectTimeout=8 -o LogLevel=ERROR root@"$TV" "$@"; }
DIR=$(cd "$(dirname "$0")" && pwd)
tv 'cat > /tmp/pointer-bridge-sender.js' < "$DIR/sender.js"
tv 'cat > /tmp/pointer-bridge-relay.js' < "$DIR/relay.js"
ssh $KEYOPT -o BatchMode=yes -o ConnectTimeout=8 -o LogLevel=ERROR root@"$TV" "(UV_THREADPOOL_SIZE=8 node /tmp/pointer-bridge-relay.js 47800 $SECS &) ; sleep 0.5; (UV_THREADPOOL_SIZE=8 node /tmp/pointer-bridge-sender.js --to 127.0.0.1 $SENDER_OPTS >/tmp/pointer-bridge-sender.log 2>&1 &) ; sleep $SECS; kill \$(cat /tmp/pointer-bridge-sender.pid) 2>/dev/null; sleep 0.3; cat /tmp/pointer-bridge-sender.log >&2" \
  | node "$DIR/../mac/receiver.ts" --stdin $RX_OPTS
