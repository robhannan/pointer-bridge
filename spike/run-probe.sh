#!/bin/sh
# Copy the probe to the TV and run it. Usage: spike/run-probe.sh [seconds]
# Needs root SSH on the TV (Homebrew Channel) with the key in $TV_KEY.
set -eu
TV=${TV_HOST:-192.168.1.193}
KEY=${TV_KEY:-$HOME/.ssh/lg_cx}
SSH="ssh -i $KEY -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=8 root@$TV"
DIR=$(cd "$(dirname "$0")" && pwd)
$SSH 'cat > /tmp/evdev-probe.js' < "$DIR/evdev-probe.js"
$SSH "echo fg: \$(luna-send -n 1 -w 4000 -f luna://com.webos.applicationManager/getForegroundAppInfo '{}' 2>&1 | grep appId); UV_THREADPOOL_SIZE=64 node /tmp/evdev-probe.js ${1:-15}"
