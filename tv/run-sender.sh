#!/bin/sh
# Copy tv/sender.js to the TV and run it in the foreground (Ctrl-C stops it on the TV too).
# Usage: tv/run-sender.sh <host>[:port] [sender options, e.g. --always --verbose]
#   tv/run-sender.sh stop    stops a sender left running on the TV
set -eu
[ $# -ge 1 ] || { echo "usage: $0 <host[:port]> [--always] [--verbose] [--input com.webos.app.hdmi1] | stop" >&2; exit 2; }
TV=${TV_HOST:-192.168.1.193}
KEY=${TV_KEY:-$HOME/.ssh/lg_cx}
tv() { ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 "$@"; }
if [ "$1" = stop ]; then
  tv root@"$TV" 'kill $(cat /tmp/pointer-bridge-sender.pid) 2>/dev/null; rm -f /tmp/pointer-bridge-sender.pid'
  exit 0
fi
TO=$1; shift
DIR=$(cd "$(dirname "$0")" && pwd)
tv root@"$TV" 'cat > /tmp/pointer-bridge-sender.js' < "$DIR/sender.js"
# -t gives the remote process a terminal, so Ctrl-C here stops it there; the sender stops any earlier copy itself
exec ssh -t -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes root@"$TV" "UV_THREADPOOL_SIZE=8 exec node /tmp/pointer-bridge-sender.js --to $TO $*"
